

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { createBookingSchema } from "../lib/validation/bookings";
import { idempotencyKeySchema } from "../lib/validation/idempotency";
import { createIdempotentBooking, hashBookingRequest } from "../lib/api/idempotency";
import { IdempotencyKeyConflictError } from "../lib/api/errors";
import { getTestAdminClient, disconnectTestAdminClient } from "./test-admin-client";

const TENANT_A = "b0000000-0000-4000-8000-000000000001"; // TechNova Solutions
const TENANT_B = "b0000000-0000-4000-8000-000000000002"; // Lahore Creative Studio
const TENANT_A_USER = "c0000000-0000-4000-8000-000000000002"; // Bilal Ahmed, TechNova
const TENANT_B_USER = "c0000000-0000-4000-8000-000000000004"; // Hamza Iqbal, Lahore Creative
const NONEXISTENT_USER = "00000000-0000-4000-8000-000000000000"; // valid UUID shape, no such user

function check(label: string, ok: boolean) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  return ok;
}
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false; // primitives already covered by === above

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();
  if (aKeys.length !== bKeys.length) return false;
  if (!aKeys.every((k, i) => k === bKeys[i])) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}

function makeInput(titleMarker: string) {
  return createBookingSchema.parse({
    title: titleMarker,
    startTime: new Date(Date.now() + 60_000).toISOString(),
    endTime: new Date(Date.now() + 120_000).toISOString(),
  });
}

async function cleanupBookingsByTitle(tenantId: string, title: string) {
  await withTenantContext(tenantId, (tx) => tx.booking.deleteMany({ where: { title } }));
}

async function cleanupIdempotencyKey(tenantId: string, key: string) {
  const admin = getTestAdminClient();
  await admin.idempotencyKey.deleteMany({ where: { tenantId, key } });
}

async function main() {
  console.log("=== Idempotency Test (connecting as app_user; cleanup uses booking_dev) ===\n");
  let allPassed = true;
  const cleanupTasks: Array<() => Promise<void>> = [];

  try {
    allPassed &&= check(
      "Empty Idempotency-Key is rejected",
      !idempotencyKeySchema.safeParse("").success
    );
    allPassed &&= check(
      "Whitespace-only Idempotency-Key is rejected",
      !idempotencyKeySchema.safeParse("   ").success
    );
    allPassed &&= check(
      "Excessively long Idempotency-Key is rejected",
      !idempotencyKeySchema.safeParse("x".repeat(256)).success
    );
    allPassed &&= check(
      "Reasonable Idempotency-Key is accepted",
      idempotencyKeySchema.safeParse("test-key-123").success
    );

    const key1 = `test-${randomUUID()}`;
    const title1 = `Idempotency test 1 ${randomUUID()}`;
    const input1 = makeInput(title1);
    const hash1 = hashBookingRequest(input1);
    cleanupTasks.push(() => cleanupIdempotencyKey(TENANT_A, key1));
    cleanupTasks.push(() => cleanupBookingsByTitle(TENANT_A, title1));

    const result1 = await createIdempotentBooking(TENANT_A, TENANT_A_USER, key1, hash1, input1);
    allPassed &&= check("Test 1: first request returns 201", result1.status === 201);
    const bookingsAfter1 = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title1 } })
    );
    allPassed &&= check("Test 1: exactly one booking created", bookingsAfter1 === 1);

    const result2 = await createIdempotentBooking(TENANT_A, TENANT_A_USER, key1, hash1, input1);

   
    allPassed &&= check(
      "Test 2: replay returns the same logical response (order-independent)",
      deepEqual(result2.body, result1.body)
    );
    const booking1 = (result1.body as { data: { id: string; status: string } }).data;
    const booking2 = (result2.body as { data: { id: string; status: string } }).data;
    allPassed &&= check("Test 2: replay returns the same booking id", booking2.id === booking1.id);
    allPassed &&= check(
      "Test 2: replay returns the same booking status",
      booking2.status === booking1.status
    );
    allPassed &&= check("Test 2: replay returns the same HTTP status", result2.status === result1.status);

    const bookingsAfter2 = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title1 } })
    );
    allPassed &&= check("Test 2: still exactly one booking (no duplicate)", bookingsAfter2 === 1);

    const differentInput = makeInput(`${title1} DIFFERENT`);
    const differentHash = hashBookingRequest(differentInput);
    let gotConflict = false;
    try {
      await createIdempotentBooking(TENANT_A, TENANT_A_USER, key1, differentHash, differentInput);
    } catch (err) {
      gotConflict = err instanceof IdempotencyKeyConflictError;
    }
    allPassed &&= check("Test 3: key reused with different payload throws conflict", gotConflict);
    const bookingsAfter3 = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title1 } })
    );
    allPassed &&= check("Test 3: no extra booking created on conflict", bookingsAfter3 === 1);

    const key4 = `test-${randomUUID()}`;
    cleanupTasks.push(() => cleanupIdempotencyKey(TENANT_A, key4));
    const result4 = await createIdempotentBooking(TENANT_A, TENANT_A_USER, key4, hash1, input1);
    allPassed &&= check(
      "Test 4: different key creates a separate booking",
      result4.status === 201 &&
        (result4.body as { data: { id: string } }).data.id !== booking1.id
    );
    const bookingsAfter4 = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title1 } })
    );
    allPassed &&= check("Test 4: now two bookings total under this title", bookingsAfter4 === 2);

    const sharedKey = `test-${randomUUID()}`;
    const titleB = `Idempotency test 5 ${randomUUID()}`;
    const inputB = makeInput(titleB);
    const hashB = hashBookingRequest(inputB);
    cleanupTasks.push(() => cleanupIdempotencyKey(TENANT_A, sharedKey));
    cleanupTasks.push(() => cleanupIdempotencyKey(TENANT_B, sharedKey));
    cleanupTasks.push(() => cleanupBookingsByTitle(TENANT_B, titleB));

    const resultA5 = await createIdempotentBooking(TENANT_A, TENANT_A_USER, sharedKey, hash1, input1);
    const resultB5 = await createIdempotentBooking(TENANT_B, TENANT_B_USER, sharedKey, hashB, inputB);
    allPassed &&= check(
      "Test 5: same key string works independently per tenant",
      resultA5.status === 201 && resultB5.status === 201
    );

    const crossTenantRead = await withTenantContext(TENANT_A, (tx) =>
      tx.idempotencyKey.findUnique({ where: { tenantId_key: { tenantId: TENANT_B, key: sharedKey } } })
    );
    allPassed &&= check(
      "Test 6: Tenant A cannot read Tenant B's idempotency record",
      crossTenantRead === null
    );

    const key7 = `test-${randomUUID()}`;
    const title7 = `Idempotency test 7 ${randomUUID()}`;
    const input7 = makeInput(title7);
    const hash7 = hashBookingRequest(input7);
    let threw = false;
    try {
      await createIdempotentBooking(TENANT_A, NONEXISTENT_USER, key7, hash7, input7);
    } catch {
      threw = true;
    }
    allPassed &&= check("Test 7: invalid createdById causes the call to throw", threw);
    const leftoverKey = await withTenantContext(TENANT_A, (tx) =>
      tx.idempotencyKey.findUnique({ where: { tenantId_key: { tenantId: TENANT_A, key: key7 } } })
    );
    allPassed &&= check(
      "Test 7: no idempotency record left behind after a failed create",
      leftoverKey === null
    );
    const leftoverBooking = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title7 } })
    );
    allPassed &&= check("Test 7: no booking left behind after a failed create", leftoverBooking === 0);

    const key8 = `test-${randomUUID()}`;
    const title8 = `Idempotency test 8 ${randomUUID()}`;
    const input8 = makeInput(title8);
    const hash8 = hashBookingRequest(input8);
    cleanupTasks.push(() => cleanupIdempotencyKey(TENANT_A, key8));
    cleanupTasks.push(() => cleanupBookingsByTitle(TENANT_A, title8));

    const concurrentResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        createIdempotentBooking(TENANT_A, TENANT_A_USER, key8, hash8, input8)
      )
    );
    const bookingIds = new Set(
      concurrentResults.map((r) => (r.body as { data: { id: string } }).data.id)
    );
    allPassed &&= check(
      "Test 8: all 5 concurrent requests returned the SAME booking id",
      bookingIds.size === 1
    );
    const bookingsAfter8 = await withTenantContext(TENANT_A, (tx) =>
      tx.booking.count({ where: { title: title8 } })
    );
    allPassed &&= check("Test 8: exactly one booking exists after concurrency", bookingsAfter8 === 1);

    console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  } finally {
    for (const task of cleanupTasks) {
      await task().catch((e) => console.error("Cleanup step failed:", e));
    }
    await disconnectTestAdminClient();
  }

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Test script error:", e);
  await disconnectTestAdminClient().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});