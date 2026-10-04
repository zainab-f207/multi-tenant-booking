import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { requirePermission, ForbiddenError, Permission } from "../lib/rbac";
import { getTestAdminClient, disconnectTestAdminClient } from "./test-admin-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001";
const TENANT_B = "b0000000-0000-4000-8000-000000000002";

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  OK   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

async function seedInvoice(tenantId: string, stripeInvoiceId: string) {
  await withTenantContext(tenantId, (tx) =>
    tx.invoice.upsert({
      where: { stripeInvoiceId },
      update: {},
      create: {
        tenantId,
        stripeInvoiceId,
        amountPaid: 2900,
        currency: "usd",
        status: "PAID",
        hostedInvoiceUrl: "https://invoice.stripe.test/fake",
        periodStart: new Date("2026-01-01T00:00:00Z"),
        periodEnd: new Date("2026-02-01T00:00:00Z"),
      },
    })
  );
}

async function cleanup() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await withTenantContext(tenantId, (tx) => tx.invoice.deleteMany({ where: { tenantId } }));
  }
}

function testRbac() {
  console.log("\n-- RBAC: VIEW_BILLING for invoices --");
  check("ADMIN can VIEW_BILLING", (() => { try { requirePermission("ADMIN", Permission.VIEW_BILLING); return true; } catch { return false; } })());
  check("MANAGER can VIEW_BILLING", (() => { try { requirePermission("MANAGER", Permission.VIEW_BILLING); return true; } catch { return false; } })());
  check("STAFF cannot VIEW_BILLING", (() => { try { requirePermission("STAFF", Permission.VIEW_BILLING); return false; } catch (e) { return e instanceof ForbiddenError; } })());
  console.log("  NOTE  The route reads no request params, so a client-supplied tenantId");
  console.log("        has no code path to change which tenant is queried.");
}

async function testTenantIsolation() {
  console.log("\n-- Invoice tenant isolation (as app_user) --");
  await cleanup();
  await seedInvoice(TENANT_A, "in_test_history_a");
  await seedInvoice(TENANT_B, "in_test_history_b");

  const asA = await withTenantContext(TENANT_A, (tx) => tx.invoice.findMany({ where: { tenantId: TENANT_A } }));
  check("Tenant A reads its own invoice", asA.length === 1 && asA[0].stripeInvoiceId === "in_test_history_a");

  const asAForB = await withTenantContext(TENANT_A, (tx) => tx.invoice.findMany({ where: { tenantId: TENANT_B } }));
  check("Tenant A's context cannot read Tenant B's invoices (RLS)", asAForB.length === 0);

  const asB = await withTenantContext(TENANT_B, (tx) => tx.invoice.findMany({ where: { tenantId: TENANT_B } }));
  check("Tenant B reads its own invoice", asB.length === 1 && asB[0].stripeInvoiceId === "in_test_history_b");

  const freshAdapter = new PrismaPg({ connectionString: process.env.APP_DATABASE_URL! });
  const freshApp = new PrismaClient({ adapter: freshAdapter });
  const noContext = await freshApp.invoice.findMany();
  check("No tenant context set → zero rows, not all invoices", noContext.length === 0);
  await freshApp.$disconnect();

  const admin = getTestAdminClient();
  const allViaAdmin = await admin.invoice.findMany({ where: { stripeInvoiceId: { in: ["in_test_history_a", "in_test_history_b"] } } });
  check("(sanity) both invoices genuinely exist via admin connection", allViaAdmin.length === 2);

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
  console.log(failures === 0 ? "\nAll billing-history checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();