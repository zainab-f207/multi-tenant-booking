import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { requirePermission, ForbiddenError, Permission } from "../lib/rbac";
import { checkoutRequestSchema } from "../lib/validation/billing";
import { ensureStripeCustomer } from "../lib/billing/stripe-customer";
import { createSubscriptionCheckoutSession } from "../lib/billing/checkout";
import type { StripeBillingClient } from "../lib/billing/stripe-client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  OK   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

function makeFakeStripeClient(): StripeBillingClient {
  return {
    customers: {
      async create(params) {
        return { id: `cus_fake_${params.metadata.tenantId}` };
      },
    },
    checkout: {
      sessions: {
        async create(params) {
          return { id: "cs_fake_123", url: `https://checkout.stripe.test/fake-session?customer=${params.customer}` };
        },
      },
    },
  };
}

async function clearTenantBillingAccount(tenantId: string) {
  await withTenantContext(tenantId, (tx) =>
    tx.tenantBillingAccount.deleteMany({ where: { tenantId } })
  );
}

function testValidation() {
  console.log("\n-- Request validation (Zod) --");
  check("Accepts basic", checkoutRequestSchema.safeParse({ planKey: "basic" }).success);
  check("Accepts pro", checkoutRequestSchema.safeParse({ planKey: "pro" }).success);
  check("Rejects missing planKey", !checkoutRequestSchema.safeParse({}).success);
  check("Rejects empty planKey", !checkoutRequestSchema.safeParse({ planKey: "" }).success);
  check("Rejects unknown planKey", !checkoutRequestSchema.safeParse({ planKey: "enterprise" }).success);
  check("Rejects client-supplied tenantId", !checkoutRequestSchema.safeParse({ planKey: "basic", tenantId: "x" }).success);
  check("Rejects client-supplied stripePriceId", !checkoutRequestSchema.safeParse({ planKey: "basic", stripePriceId: "price_evil" }).success);
}

function testRbac() {
  console.log("\n-- Authorization (requirePermission — same check the route uses) --");
  check("ADMIN authorized", (() => { try { requirePermission("ADMIN", Permission.MANAGE_BILLING); return true; } catch { return false; } })());
  check("MANAGER forbidden", (() => { try { requirePermission("MANAGER", Permission.MANAGE_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  check("STAFF forbidden", (() => { try { requirePermission("STAFF", Permission.MANAGE_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  console.log("  NOTE  401 unauthenticated and full HTTP routing aren't exercised");
  console.log("        here — see README manual-test note.");
}

async function testStripeCustomerFlow() {
  console.log("\n-- Stripe customer creation/reuse (fake Stripe, real DB) --");
  await clearTenantBillingAccount(TENANT_A);

  const fake = makeFakeStripeClient();

  // ensureStripeCustomer() already wraps its own DB access in
  // withTenantContext() internally — it's called directly here, not through
  // a raw prisma query, so no extra wrapping is needed for this call itself.
  const firstId = await ensureStripeCustomer(TENANT_A, fake);

  const row = await withTenantContext(TENANT_A, (tx) =>
    tx.tenantBillingAccount.findUnique({ where: { tenantId: TENANT_A } })
  );
  check("Creates TenantBillingAccount for the correct tenant", row?.tenantId === TENANT_A);
  check("Stored stripeCustomerId matches created customer", row?.stripeCustomerId === firstId);

  const secondId = await ensureStripeCustomer(TENANT_A, fake);
  check("Second call reuses existing account (no duplicate)", secondId === firstId);

  const count = await withTenantContext(TENANT_A, (tx) =>
    tx.tenantBillingAccount.count({ where: { tenantId: TENANT_A } })
  );
  check("Exactly one row exists for the tenant", count === 1);

  await clearTenantBillingAccount(TENANT_A);
}

async function testCheckoutUsesServerResolvedPrice() {
  console.log("\n-- Checkout session: server-side price resolution --");
  if (!process.env.STRIPE_PRICE_ID_BASIC) {
    console.log("  SKIP  STRIPE_PRICE_ID_BASIC not set locally — expected if Stripe env isn't configured.");
    return;
  }
  await clearTenantBillingAccount(TENANT_A);

  const fake = makeFakeStripeClient();
  const result = await createSubscriptionCheckoutSession(
    { tenantId: TENANT_A, planKey: "basic" },
    { stripeClient: fake }
  );
  check("Returns a checkout URL", typeof result.url === "string" && result.url.length > 0);

  await clearTenantBillingAccount(TENANT_A);
}

async function main() {
  try {
    testValidation();
    testRbac();
    await testStripeCustomerFlow();
    await testCheckoutUsesServerResolvedPrice();
  } finally {
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nAll Phase 3 checkout checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();