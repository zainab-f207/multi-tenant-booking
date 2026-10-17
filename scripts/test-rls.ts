
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";

const TENANT_A = "b0000000-0000-4000-8000-000000000001";
const TENANT_B = "b0000000-0000-4000-8000-000000000002";

const SEEDED_BOOKINGS = {
  tenantA: [
    "d0000000-0000-4000-8000-000000000001",
    "d0000000-0000-4000-8000-000000000002",
  ],
  tenantB: [
    "d0000000-0000-4000-8000-000000000003",
    "d0000000-0000-4000-8000-000000000004",
  ],
};

async function countWithContext(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const users = await tx.user.count();
    const bookings = await tx.booking.count();

    return { users, bookings };
  });
}

async function countWithoutContext() {
  return prisma.$transaction(async (tx) => {
    const users = await tx.user.count();
    const bookings = await tx.booking.count();

    return { users, bookings };
  });
}

function checkExact(
  label: string,
  actual: { users: number; bookings: number },
  expected: { users: number; bookings: number }
): boolean {
  const ok =
    actual.users === expected.users &&
    actual.bookings === expected.bookings;

  console.log(
    `[${ok ? "PASS" : "FAIL"}] ${label} -> users=${actual.users}, bookings=${actual.bookings} ` +
      `(expected users=${expected.users}, bookings=${expected.bookings})`
  );

  return ok;
}

async function main() {
  console.log(
    "=== RLS / Tenant Isolation Test (connecting as app_user) ===\n"
  );

  let allPassed = true;

  const noContext = await countWithoutContext();

  allPassed &&= checkExact(
    "No tenant context set",
    noContext,
    { users: 0, bookings: 0 }
  );

  const asA = await countWithContext(TENANT_A);

  const tenantAUsersCorrect = asA.users === 3;
  allPassed &&= tenantAUsersCorrect;

  console.log(
    `[${tenantAUsersCorrect ? "PASS" : "FAIL"}] Tenant A user count -> ${asA.users} (expected 3)`
  );

  const tenantABookings = await withTenantContext(TENANT_A, (tx) =>
    tx.booking.findMany({
      where: { id: { in: SEEDED_BOOKINGS.tenantA } },
      select: { id: true },
    })
  );

  const tenantASeededCorrect =
    tenantABookings.length === SEEDED_BOOKINGS.tenantA.length;

  allPassed &&= tenantASeededCorrect;

  console.log(
    `[${tenantASeededCorrect ? "PASS" : "FAIL"}] Tenant A can access both original seeded bookings (${tenantABookings.length}/2)`
  );

  const asB = await countWithContext(TENANT_B);

  const tenantBUsersCorrect = asB.users === 2;
  allPassed &&= tenantBUsersCorrect;

  console.log(
    `[${tenantBUsersCorrect ? "PASS" : "FAIL"}] Tenant B user count -> ${asB.users} (expected 2)`
  );

  const tenantBSeeded = await withTenantContext(TENANT_B, (tx) =>
    tx.booking.findMany({
      where: { id: { in: SEEDED_BOOKINGS.tenantB } },
      select: { id: true },
    })
  );

  const tenantBSeededCorrect =
    tenantBSeeded.length === SEEDED_BOOKINGS.tenantB.length;

  allPassed &&= tenantBSeededCorrect;

  console.log(
    `[${tenantBSeededCorrect ? "PASS" : "FAIL"}] Tenant B can access both original seeded bookings (${tenantBSeeded.length}/2)`
  );

  const crossTenantLeak = await withTenantContext(TENANT_A, (tx) =>
    tx.booking.findMany({
      where: { tenantId: TENANT_B },
    })
  );

  const noLeak = crossTenantLeak.length === 0;
  allPassed &&= noLeak;

  console.log(
    `[${noLeak ? "PASS" : "FAIL"}] Tenant A querying Tenant B rows directly -> found ${crossTenantLeak.length} (expected 0)`
  );

  console.log(
    `\nOverall: ${
      allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"
    }`
  );

  await prisma.$disconnect();

  process.exit(allPassed ? 0 : 1);
}

main().catch(async (error) => {
  console.error("Test script error:", error);

  await prisma.$disconnect();

  process.exit(1);
});
