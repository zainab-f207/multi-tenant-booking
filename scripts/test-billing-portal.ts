import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { requirePermission, ForbiddenError, Permission } from "../lib/rbac";
import { createBillingPortalSession } from "../lib/billing/portal";
import type { StripeBillingPortalClient } from "../lib/billing/stripe-client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001";

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  OK   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

async function clearBillingAccount(tenantId: string) {
  await withTenantContext(tenantId, (tx) => tx.tenantBillingAccount.deleteMany({ where: { tenantId } }));
}

function testRbac() {
  console.log("\n-- Subscription management authorization --");
  check("ADMIN allowed (MANAGE_BILLING)", (() => { try { requirePermission("ADMIN", Permission.MANAGE_BILLING); return true; } catch { return false; } })());
  check("MANAGER rejected", (() => { try { requirePermission("MANAGER", Permission.MANAGE_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  check("STAFF rejected", (() => { try { requirePermission("STAFF", Permission.MANAGE_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  console.log("  NOTE  Missing authentication isn't covered here — same documented");
  console.log("        limitation as the other billing test scripts.");
}

async function testPortalUsesServerResolvedCustomer() {
  console.log("\n-- Billing Portal: server-resolved customer, no duplicates --");
  await clearBillingAccount(TENANT_A);

  const calls: Array<{ customer: string; return_url: string }> = [];
  const fake: StripeBillingPortalClient = {
    billingPortal: {
      sessions: {
        async create(params) {
          calls.push(params);
          return { id: "bps_fake_1", url: "https://billing.stripe.test/fake-portal" };
        },
      },
    },
  };

  let threw = false;
  try {
    await createBillingPortalSession(TENANT_A, { stripeClient: fake });
  } catch {
    threw = true;
  }
  check("Throws when tenant has no Stripe customer yet (no silent customer creation)", threw);
  check("No portal session attempted without an existing customer", calls.length === 0);

  await withTenantContext(TENANT_A, (tx) =>
    tx.tenantBillingAccount.create({ data: { tenantId: TENANT_A, stripeCustomerId: "cus_test_portal_a" } })
  );

  const result = await createBillingPortalSession(TENANT_A, { stripeClient: fake });
  check("Returns the portal URL", result.url === "https://billing.stripe.test/fake-portal");
  check("Uses the tenant's actual stored Stripe customer ID (not client-supplied)", calls[0]?.customer === "cus_test_portal_a");
  check(
    "Exactly one portal session created — this flow never calls customers.create or checkout.sessions.create",
    calls.length === 1
  );

  await clearBillingAccount(TENANT_A);
}

async function main() {
  try {
    testRbac();
    await testPortalUsesServerResolvedCustomer();
  } finally {
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nAll billing-portal checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();