import "dotenv/config";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { getStripe } from "../lib/stripe";
import {
  syncSubscriptionFromStripeObject,
  syncInvoiceFromStripeObject,
  type StripeSubscriptionLike,
  type StripeInvoiceLike,
} from "../lib/billing/webhook-sync";
import { getTestAdminClient, disconnectTestAdminClient } from "./test-admin-client";
import { POST } from "../app/api/webhooks/stripe/route";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative
const CUSTOMER_A = "cus_test_webhook_a";
const CUSTOMER_B = "cus_test_webhook_b";

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  OK   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

async function seedBillingAccount(tenantId: string, stripeCustomerId: string) {
  await withTenantContext(tenantId, (tx) =>
    tx.tenantBillingAccount.upsert({
      where: { tenantId },
      update: { stripeCustomerId },
      create: { tenantId, stripeCustomerId },
    })
  );
}

async function cleanup() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await withTenantContext(tenantId, (tx) => tx.subscription.deleteMany({ where: { tenantId } }));
    await withTenantContext(tenantId, (tx) => tx.invoice.deleteMany({ where: { tenantId } }));
    await withTenantContext(tenantId, (tx) => tx.tenantBillingAccount.deleteMany({ where: { tenantId } }));
  }
  const admin = getTestAdminClient();
  await admin.processedStripeEvent.deleteMany({
    where: { stripeEventId: { startsWith: "evt_test_webhook_" } },
  });
}

function fakeSubscription(overrides: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: "sub_test_1",
    status: "active",
    cancel_at_period_end: false,
    customer: CUSTOMER_A,
    items: { data: [{ price: { id: "price_basic_test" }, current_period_end: 1893456000 }] },
    ...overrides,
  };
}

function fakeInvoice(overrides: Partial<StripeInvoiceLike> = {}): StripeInvoiceLike {
  return {
    id: "in_test_1",
    amount_paid: 2900,
    currency: "usd",
    status: "paid",
    hosted_invoice_url: "https://invoice.stripe.test/fake",
    period_start: 1893456000,
    period_end: 1896134400,
    created: 1893456000,
    customer: CUSTOMER_A,
    ...overrides,
  };
}

// --- Unit tests: sync functions directly ---

async function testSubscriptionMapping() {
  console.log("\n-- Subscription data mapping --");
  await seedBillingAccount(TENANT_A, CUSTOMER_A);

  await withTenantContext(TENANT_A, (tx) =>
    syncSubscriptionFromStripeObject(tx, TENANT_A, fakeSubscription(), new Date("2026-01-01T00:00:00Z"))
  );

  const row = await withTenantContext(TENANT_A, (tx) => tx.subscription.findUnique({ where: { tenantId: TENANT_A } }));
  check("Subscription created for correct tenant", row?.tenantId === TENANT_A);
  check("status mapped ACTIVE", row?.status === "ACTIVE");
  check("planKey resolved from known price (or 'unrecognized' if STRIPE_PRICE_ID_BASIC unset)", !!row?.planKey);
  check("currentPeriodEnd read from items.data[0], not top-level", row?.currentPeriodEnd.getTime() === 1893456000 * 1000);
}

async function testStaleEventGuard() {
  console.log("\n-- Stale subscription event protection --");
  const newer = new Date("2026-02-01T00:00:00Z");
  const older = new Date("2026-01-15T00:00:00Z");

  await withTenantContext(TENANT_A, (tx) =>
    syncSubscriptionFromStripeObject(tx, TENANT_A, fakeSubscription({ status: "active" }), newer)
  );
  await withTenantContext(TENANT_A, (tx) =>
    syncSubscriptionFromStripeObject(tx, TENANT_A, fakeSubscription({ status: "canceled" }), older)
  );

  const row = await withTenantContext(TENANT_A, (tx) => tx.subscription.findUnique({ where: { tenantId: TENANT_A } }));
  check("Older event did not overwrite newer status", row?.status === "ACTIVE");
  check("lastStripeEventAt still reflects the newer event", row?.lastStripeEventAt.getTime() === newer.getTime());
}

async function testInvoiceMapping() {
  console.log("\n-- Invoice data mapping --");
  await withTenantContext(TENANT_A, (tx) => syncInvoiceFromStripeObject(tx, TENANT_A, fakeInvoice()));
  const row = await withTenantContext(TENANT_A, (tx) => tx.invoice.findUnique({ where: { stripeInvoiceId: "in_test_1" } }));
  check("Invoice created for correct tenant", row?.tenantId === TENANT_A);
  check("status PAID", row?.status === "PAID");
  check("amountPaid stored in minor units as given", row?.amountPaid === 2900);
}

async function testCrossTenantProtection() {
  console.log("\n-- Cross-tenant protection --");
  await seedBillingAccount(TENANT_B, CUSTOMER_B);
  await withTenantContext(TENANT_A, (tx) =>
    syncSubscriptionFromStripeObject(tx, TENANT_A, fakeSubscription({ customer: CUSTOMER_A }), new Date())
  );
  const admin = getTestAdminClient();
  const tenantBRow = await admin.subscription.findUnique({ where: { tenantId: TENANT_B } });
  check("Tenant B has no subscription after only Tenant A's event was processed", tenantBRow === null);
}

// --- End-to-end: real route, real signature verification (local secret, not a live Stripe account) ---

function buildEventPayload(id: string, type: string, object: object) {
  return JSON.stringify({
    id,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
}

async function postSignedEvent(payload: string): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });

  const request = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
  return POST(request);
}

async function testEndToEnd() {
  console.log("\n-- End-to-end route: signature verification, dedup, dispatch --");
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("  SKIP  STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set locally.");
    console.log("        LIMITATION: this exercises real HMAC signature verification using a");
    console.log("        locally-configured test secret, not a request Stripe's own servers");
    console.log("        actually sent. End-to-end testing against Stripe's live webhook");
    console.log("        dispatch requires the Stripe CLI (`stripe listen --forward-to`) or a");
    console.log("        real test-mode account — not covered by this automated script.");
    return;
  }

  await seedBillingAccount(TENANT_A, CUSTOMER_A);

  const payload1 = buildEventPayload("evt_test_webhook_1", "customer.subscription.created", fakeSubscription());
  const res1 = await postSignedEvent(payload1);
  check("Supported event returns 200", res1.status === 200);
  const body1 = await res1.json();
  check("Supported event marked handled", body1.data?.handled === true);

  const res2 = await postSignedEvent(payload1);
  check("Duplicate event returns 200", res2.status === 200);

  const payload3 = buildEventPayload("evt_test_webhook_unknown", "payment_intent.succeeded", { id: "pi_test" });
  const res3 = await postSignedEvent(payload3);
  check("Unknown event type returns 200", res3.status === 200);
  const body3 = await res3.json();
  check("Unknown event type marked NOT handled", body3.data?.handled === false);

  const badRequest = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
    body: payload1,
  });
  const res4 = await POST(badRequest);
  check("Invalid signature rejected with 400", res4.status === 400);

  // 5. Missing signature header
  const noSigRequest = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body: payload1,
  });
  const res5 = await POST(noSigRequest);
  check("Missing signature rejected with 400", res5.status === 400);
}

async function main() {
  try {
    await cleanup();
    await testSubscriptionMapping();
    await testStaleEventGuard();
    await testInvoiceMapping();
    await testCrossTenantProtection();
    await testEndToEnd();
  } finally {
    await cleanup();
    await prisma.$disconnect();
    await disconnectTestAdminClient();
  }
  console.log(failures === 0 ? "\nAll Stripe webhook checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();