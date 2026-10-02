
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { updateBookingSchema } from "../lib/validation/bookings";
import { Prisma } from "../generated/prisma/client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova Solutions
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative Studio
const TENANT_B_USER = "c0000000-0000-4000-8000-000000000004"; // Hamza Iqbal, Lahore Creative

function check(label: string, ok: boolean) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  return ok;
}

function isPrismaNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

async function main() {
  console.log("=== Tenant Security / Cross-Tenant Write Isolation Test (connecting as app_user) ===\n");
  let allPassed = true;

  const roleRows = await prisma.$queryRaw<{ rolbypassrls: boolean }[]>`
    SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_user'
  `;
  allPassed = check("app_user role exists in pg_roles", roleRows.length === 1) && allPassed;
  allPassed =
    check(
      "app_user has rolbypassrls = false (cannot bypass RLS)",
      roleRows[0]?.rolbypassrls === false
    ) && allPassed;

  let rejectedGarbageTenantId = false;
  try {
    await withTenantContext("not-a-real-tenant-id", (tx) => tx.booking.findMany());
  } catch {
    rejectedGarbageTenantId = true;
  }
  allPassed =
    check("withTenantContext() rejects a non-UUID tenant id before querying", rejectedGarbageTenantId) &&
    allPassed;
  const maliciousPatch = updateBookingSchema.safeParse({
    status: "CONFIRMED",
    tenantId: TENANT_A, // attacker-supplied; must be rejected outright
  });
  allPassed =
    check(
      "updateBookingSchema rejects a client-supplied tenantId (strict mode)",
      !maliciousPatch.success
    ) && allPassed;

  const victimTitle = `Tenant security test victim ${Date.now()}`;
  const victim = await withTenantContext(TENANT_B, (tx) =>
    tx.booking.create({
      data: {
        tenantId: TENANT_B,
        createdById: TENANT_B_USER,
        title: victimTitle,
        startTime: new Date(Date.now() + 60_000),
        endTime: new Date(Date.now() + 120_000),
      },
    })
  );

  try {
    const foundByAttacker = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.findUnique({ where: { id: victim.id } })
    );
    allPassed =
      check(
        "Tenant A's existence-check cannot see Tenant B's booking (route would 404)",
        foundByAttacker === null
      ) && allPassed;

    let updateBlocked = false;
    try {
      await withTenantContext(TENANT_A, (tx) =>
        tx.booking.update({
          where: { id: victim.id },
          data: { title: "HACKED BY TENANT A" },
        })
      );
    } catch (err) {
      updateBlocked = isPrismaNotFound(err);
    }
    allPassed =
      check(
        "Direct update() against Tenant B's booking from Tenant A context is blocked by RLS",
        updateBlocked
      ) && allPassed;

    const afterUpdateAttempt = await withTenantContext(TENANT_B, (tx) =>
      tx.booking.findUnique({ where: { id: victim.id } })
    );
    allPassed =
      check(
        "Tenant B's booking title is unchanged after the attempted cross-tenant update",
        afterUpdateAttempt?.title === victimTitle
      ) && allPassed;

    let deleteBlocked = false;
    try {
      await withTenantContext(TENANT_A, (tx) => tx.booking.delete({ where: { id: victim.id } }));
    } catch (err) {
      deleteBlocked = isPrismaNotFound(err);
    }
    allPassed =
      check(
        "Direct delete() against Tenant B's booking from Tenant A context is blocked by RLS",
        deleteBlocked
      ) && allPassed;

    const stillExists = await withTenantContext(TENANT_B, (tx) =>
      tx.booking.findUnique({ where: { id: victim.id } })
    );
    allPassed =
      check(
        "Tenant B's booking still exists after the attempted cross-tenant delete",
        stillExists !== null
      ) && allPassed;
  } finally {
    
    await withTenantContext(TENANT_B, (tx) =>
      tx.booking.delete({ where: { id: victim.id } }).catch(() => {})
    );
  }

  console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Test script error:", e);
  await prisma.$disconnect();
  process.exit(1);
});