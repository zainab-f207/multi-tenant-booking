import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withTenantContext } from "../lib/tenant-context";
import { requirePermission, ForbiddenError } from "../lib/rbac";

const adminAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const admin = new PrismaClient({ adapter: adminAdapter });

const appAdapter = new PrismaPg({ connectionString: process.env.APP_DATABASE_URL! });
const app = new PrismaClient({ adapter: appAdapter });

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  OK   ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    failures++;
  }
}

async function testGrantsAndRls() {
  console.log("\n-- Database permissions & RLS flags --");

  const role = await admin.$queryRaw<{ rolbypassrls: boolean }[]>`
    SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_user'
  `;
  check("app_user cannot bypass RLS", role[0]?.rolbypassrls === false);

  const rls = await admin.$queryRaw<{ tablename: string; rowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity, relforcerowsecurity
    FROM pg_tables JOIN pg_class ON pg_class.relname = pg_tables.tablename
    WHERE schemaname = 'public'
      AND tablename IN ('tenant_billing_accounts', 'subscriptions', 'invoices', 'processed_stripe_events', 'users', 'bookings')
  `;
  for (const table of ["tenant_billing_accounts", "subscriptions", "invoices"]) {
    const row = rls.find((r) => r.tablename === table);
    check(`${table} has RLS enabled + forced`, row?.rowsecurity === true && row?.relforcerowsecurity === true);
  }
  const events = rls.find((r) => r.tablename === "processed_stripe_events");
  check("processed_stripe_events has RLS disabled (by design)", events?.rowsecurity === false);

  for (const table of ["users", "bookings"]) {
    const row = rls.find((r) => r.tablename === table);
    check(`${table} RLS unchanged (still enabled + forced)`, row?.rowsecurity === true && row?.relforcerowsecurity === true);
  }

  const grants = await admin.$queryRaw<{ table_name: string; privilege_type: string }[]>`
    SELECT table_name, privilege_type FROM information_schema.role_table_grants
    WHERE grantee = 'app_user' AND table_name = 'processed_stripe_events'
  `;
  const privs = grants.map((g) => g.privilege_type).sort();
  check("processed_stripe_events: app_user has only SELECT, INSERT", JSON.stringify(privs) === JSON.stringify(["INSERT", "SELECT"]));
}

async function seedFixtures() {
  // Minimal fixtures, written via the admin connection (no checkout API exists yet in Phase 2).
  await admin.tenantBillingAccount.upsert({
    where: { tenantId: TENANT_A },
    update: {},
    create: { id: "e0000000-0000-4000-8000-000000000001", tenantId: TENANT_A, stripeCustomerId: "cus_test_tenant_a" },
  });
  await admin.tenantBillingAccount.upsert({
    where: { tenantId: TENANT_B },
    update: {},
    create: { id: "e0000000-0000-4000-8000-000000000002", tenantId: TENANT_B, stripeCustomerId: "cus_test_tenant_b" },
  });
}

async function testTenantIsolation() {
  console.log("\n-- Tenant isolation (as app_user) --");
  await seedFixtures();

  const asA = (await withTenantContext(TENANT_A, (tx) => tx.tenantBillingAccount.findMany())) as Array<{ tenantId: string }>;
  check("Tenant A sees only its own billing account", asA.length === 1 && asA[0].tenantId === TENANT_A);

  const asB = (await withTenantContext(TENANT_B, (tx) => tx.tenantBillingAccount.findMany())) as Array<{ tenantId: string }>;
  check("Tenant B sees only its own billing account", asB.length === 1 && asB[0].tenantId === TENANT_B);

  const noContext = (await app.tenantBillingAccount.findMany()) as Array<{ tenantId: string }>;
  check("No tenant context set → zero rows (not all rows)", noContext.length === 0);
}

async function testRbac() {
  console.log("\n-- RBAC (pure function, no DB) --");

  check("ADMIN has VIEW_BILLING", (() => {
    try {
      requirePermission("ADMIN", "VIEW_BILLING" as never);
      return true;
    } catch {
      return false;
    }
  })());

  check("ADMIN has MANAGE_BILLING", (() => {
    try {
      requirePermission("ADMIN", "MANAGE_BILLING" as never);
      return true;
    } catch {
      return false;
    }
  })());

  check("MANAGER has VIEW_BILLING", (() => {
    try {
      requirePermission("MANAGER", "VIEW_BILLING" as never);
      return true;
    } catch {
      return false;
    }
  })());

  check("MANAGER lacks MANAGE_BILLING", (() => {
    try {
      requirePermission("MANAGER", "MANAGE_BILLING" as never);
      return false;
    } catch (e) {
      return e instanceof ForbiddenError;
    }
  })());

  check("STAFF lacks VIEW_BILLING", (() => {
    try {
      requirePermission("STAFF", "VIEW_BILLING" as never);
      return false;
    } catch (e) {
      return e instanceof ForbiddenError;
    }
  })());

  check("STAFF lacks MANAGE_BILLING", (() => {
    try {
      requirePermission("STAFF", "MANAGE_BILLING" as never);
      return false;
    } catch (e) {
      return e instanceof ForbiddenError;
    }
  })());
}

async function testUniqueConstraints() {
  console.log("\n-- Schema unique constraints --");
  const dupTenant = await admin.tenantBillingAccount
    .create({ data: { id: "e0000000-0000-4000-8000-000000000099", tenantId: TENANT_A, stripeCustomerId: "cus_dup_1" } })
    .then(() => false).catch(() => true);
  check("TenantBillingAccount.tenantId unique", dupTenant);

  const dupCustomer = await admin.tenantBillingAccount
    .create({ data: { id: "e0000000-0000-4000-8000-000000000098", tenantId: "b0000000-0000-4000-8000-000000000003", stripeCustomerId: "cus_test_tenant_a" } })
    .then(() => false).catch(() => true);
  check("TenantBillingAccount.stripeCustomerId unique", dupCustomer);

  const event1 = await admin.processedStripeEvent.create({ data: { id: "f0000000-0000-4000-8000-000000000001", stripeEventId: "evt_test_dup", type: "test.event" } }).then(() => true).catch(() => false);
  check("ProcessedStripeEvent first insert succeeds", event1);
  const event2 = await admin.processedStripeEvent.create({ data: { id: "f0000000-0000-4000-8000-000000000002", stripeEventId: "evt_test_dup", type: "test.event" } }).then(() => false).catch(() => true);
  check("ProcessedStripeEvent.stripeEventId unique", event2);
}

async function cleanup() {
  await admin.processedStripeEvent.deleteMany({ where: { stripeEventId: "evt_test_dup" } });
  await admin.tenantBillingAccount.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
}

async function main() {
  try {
    await testGrantsAndRls();
    await testTenantIsolation();
    await testRbac();
    await testUniqueConstraints();
  } finally {
    await cleanup();
    await admin.$disconnect();
    await app.$disconnect();
  }

  console.log(failures === 0 ? "\nAll billing-foundation checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();