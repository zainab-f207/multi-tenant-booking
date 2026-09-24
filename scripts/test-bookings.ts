

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { createBookingSchema } from "../lib/validation/bookings";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova Solutions
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative Studio
const TENANT_A_USER = "c0000000-0000-4000-8000-000000000002"; // Bilal Ahmed, TechNova

function check(label: string, ok: boolean) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  return ok;
}

async function main() {
  console.log("=== Booking API / Data-Layer Isolation Test (connecting as app_user) ===\n");
  let allPassed = true;

  const maliciousInput = {
    title: "Attempted tenant override",
    startTime: new Date(Date.now() + 60_000).toISOString(),
    endTime: new Date(Date.now() + 120_000).toISOString(),
    tenantId: TENANT_B, // attacker-supplied; must be rejected outright
  };
  const parseResult = createBookingSchema.safeParse(maliciousInput);
  allPassed &&= check(
    "createBookingSchema rejects a client-supplied tenantId (strict mode)",
    !parseResult.success
  );

  // 2. Data-layer: a booking created under Tenant A's context always
  //    gets tenantId = Tenant A, exactly as POST /api/bookings does --
  //    from the context, never from client input.
  const validInput = createBookingSchema.parse({
    title: "Isolation test booking",
    startTime: new Date(Date.now() + 60_000).toISOString(),
    endTime: new Date(Date.now() + 120_000).toISOString(),
  });

  const created = await withTenantContext(TENANT_A, (tx) =>
    tx.booking.create({
      data: {
        tenantId: TENANT_A,
        createdById: TENANT_A_USER,
        title: validInput.title,
        description: validInput.description,
        startTime: validInput.startTime,
        endTime: validInput.endTime,
      },
    })
  );
  allPassed &&= check("Created booking has tenantId = Tenant A", created.tenantId === TENANT_A);
  allPassed &&= check("Created booking defaults to PENDING", created.status === "PENDING");

  const asA = await withTenantContext(TENANT_A, (tx) => tx.booking.findMany());
  allPassed &&= check("Tenant A sees its own bookings", asA.some((b) => b.id === created.id));

  const bFromA = await withTenantContext(TENANT_A, (tx) =>
    tx.booking.findMany({ where: { tenantId: TENANT_B } })
  );
  allPassed &&= check("Tenant A cannot see Tenant B's bookings", bFromA.length === 0);

  const asB = await withTenantContext(TENANT_B, (tx) => tx.booking.findMany());
  allPassed &&= check("Tenant B sees its own bookings", asB.length > 0);

  const aFromB = await withTenantContext(TENANT_B, (tx) =>
    tx.booking.findUnique({ where: { id: created.id } })
  );
  allPassed &&= check("Tenant B cannot see Tenant A's booking by id", aFromB === null);

  await withTenantContext(TENANT_A, (tx) => tx.booking.delete({ where: { id: created.id } }));

  console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Test script error:", e);
  await prisma.$disconnect();
  process.exit(1);
});