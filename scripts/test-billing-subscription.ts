import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { requirePermission, ForbiddenError, Permission } from "../lib/rbac";
import { getTestAdminClient, disconnectTestAdminClient } from "./test-admin-client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  OK   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

async function seedSubscription(tenantId: string, stripeSubscriptionId: string) {
  await withTenantContext(tenantId, (tx) =>
    tx.subscription.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        stripeSubscriptionId,
        stripePriceId: "price_test",
        planKey: "basic",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
        cancelAtPeriodEnd: false,
        lastStripeEventAt: new Date(),
      },
    })
  );
}

async function cleanup() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await withTenantContext(tenantId, (tx) => tx.subscription.deleteMany({ where: { tenantId } }));
  }
}

function testRbac() {
  console.log("\n-- RBAC: same requirePermission check the route uses --");
  check("ADMIN can VIEW_BILLING", (() => { try { requirePermission("ADMIN", Permission.VIEW_BILLING); return true; } catch { return false; } })());
  check("MANAGER can VIEW_BILLING", (() => { try { requirePermission("MANAGER", Permission.VIEW_BILLING); return true; } catch { return false; } })());
  check("STAFF cannot VIEW_BILLING", (() => { try { requirePermission("STAFF", Permission.VIEW_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  console.log("  NOTE  'Missing authentication' isn't covered here — getCurrentUser() reads");
  console.log("        next/headers cookies(), which requires a real Next.js request context.");
  console.log("        Same documented limitation as the Phase 3 checkout test.");
  console.log("  NOTE  This route reads no request body/query params at all, so a client-");
  console.log("        supplied tenantId has no code path to be read from.");
  console.log("  NOTE  planKey-only / stripePriceId-rejected are covered by test:billing-checkout.");
}

async function testTenantIsolation() {
  console.log("\n-- Tenant isolation for subscription reads (as app_user) --");
  await cleanup();
  await seedSubscription(TENANT_A, "sub_test_a");
  await seedSubscription(TENANT_B, "sub_test_b");

  const asA = await withTenantContext(TENANT_A, (tx) => tx.subscription.findUnique({ where: { tenantId: TENANT_A } }));
  check("Tenant A reads its own subscription", asA?.stripeSubscriptionId === "sub_test_a");

  const asAForB = await withTenantContext(TENANT_A, (tx) => tx.subscription.findUnique({ where: { tenantId: TENANT_B } }));
  check("Tenant A's context cannot read Tenant B's subscription (RLS)", asAForB === null);

  const admin = getTestAdminClient();
  const bRow = await admin.subscription.findUnique({ where: { tenantId: TENANT_B } });
  check("(sanity) Tenant B's row genuinely exists via admin connection", bRow?.stripeSubscriptionId === "sub_test_b");

  await cleanup();
}

async function main() {
  try {
    testRbac();
    await testTenantIsolation();
  } finally {
    await prisma.$disconnect();
    await disconnectTestAdminClient();
  }
  console.log(failures === 0 ? "\nAll billing-subscription checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();