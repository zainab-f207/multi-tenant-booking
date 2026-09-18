import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";

const TENANT_A = "b0000000-0000-4000-8000-000000000001";
const TENANT_B = "b0000000-0000-4000-8000-000000000002";

const EXPECTED = {
  [TENANT_A]: {
    users: 3,
    bookings: 2,
  },
  [TENANT_B]: {
    users: 2,
    bookings: 2,
  },
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
    `[${ok ? "PASS" : "FAIL"}] ${label} → users=${actual.users}, bookings=${actual.bookings} ` +
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

  allPassed &&= checkExact(
    "Tenant A (TechNova) context",
    asA,
    EXPECTED[TENANT_A]
  );

  const asB = await countWithContext(TENANT_B);

  allPassed &&= checkExact(
    "Tenant B (Lahore Creative) context",
    asB,
    EXPECTED[TENANT_B]
  );

  const crossTenantLeak = await withTenantContext(
    TENANT_A,
    (tx) =>
      tx.booking.findMany({
        where: {
          tenantId: TENANT_B,
        },
      })
  );

  const noLeak = crossTenantLeak.length === 0;

  allPassed &&= noLeak;

  console.log(
    `[${noLeak ? "PASS" : "FAIL"}] Tenant A context querying for Tenant B rows directly → found ${crossTenantLeak.length} (expected 0)`
  );

  console.log(
    `\nOverall: ${
      allPassed
        ? "✅ ALL TESTS PASSED"
        : "❌ SOME TESTS FAILED"
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