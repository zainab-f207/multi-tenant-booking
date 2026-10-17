import "dotenv/config";
import { prisma } from "../lib/prisma";
import { withTenantContext } from "../lib/tenant-context";
import { redis } from "../lib/redis";
import {
  getTenantSettings,
  updateTenantSettings,
} from "../lib/settings/service";
import { Permission, roleHasPermission } from "../lib/rbac";

const TENANT_A = "b0000000-0000-4000-8000-000000000001";
const TENANT_B = "b0000000-0000-4000-8000-000000000002";

function check(label: string, passed: boolean) {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${label}`);
  return passed;
}

async function connectRedis() {
  if (!redis) return false;

  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }

    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== Tenant Settings / Redis Cache Tests ===\n");

  let allPassed = true;
  let originalA:
    | Awaited<ReturnType<typeof getTenantSettings>>["settings"]
    | undefined;
  let originalB:
    | Awaited<ReturnType<typeof getTenantSettings>>["settings"]
    | undefined;

  try {
    // Verify the application role has the expected settings permissions.
    allPassed =
      check(
        "ADMIN can manage organization settings",
        roleHasPermission("ADMIN", Permission.MANAGE_ORGANIZATION)
      ) && allPassed;

    allPassed =
      check(
        "MANAGER cannot manage organization settings",
        !roleHasPermission("MANAGER", Permission.MANAGE_ORGANIZATION)
      ) && allPassed;

    allPassed =
      check(
        "STAFF cannot manage organization settings",
        !roleHasPermission("STAFF", Permission.MANAGE_ORGANIZATION)
      ) && allPassed;

    // Save existing values so this test can restore them.
    originalA = (await getTenantSettings(TENANT_A)).settings;
    originalB = (await getTenantSettings(TENANT_B)).settings;

    // Confirm settings reads respect PostgreSQL tenant isolation.
    const tenantASettings = await withTenantContext(TENANT_A, (tx) =>
      tx.tenantSetting.findMany()
    );

    const tenantBSettingsFromA = await withTenantContext(TENANT_A, (tx) =>
      tx.tenantSetting.findMany({
        where: { tenantId: TENANT_B },
      })
    );

    allPassed =
      check(
        "Tenant A can read its settings",
        tenantASettings.every((row) => row.tenantId === TENANT_A)
      ) && allPassed;

    allPassed =
      check(
        "Tenant A cannot read Tenant B settings",
        tenantBSettingsFromA.length === 0
      ) && allPassed;

    
let noContextBlocked = false;

try {
  await prisma.tenantSetting.count();
} catch {
  noContextBlocked = true;
}

allPassed =
  check(
    "No tenant context cannot read settings",
    noContextBlocked
  ) && allPassed;


  const testTimezone = "UTC";
    const testDuration = 90;

    const redisAvailable = await connectRedis();

    if (redisAvailable && redis) {
      await redis.del(`tenant:${TENANT_A}:settings:v1`);
      await redis.del(`tenant:${TENANT_B}:settings:v1`);
    }

    const updated = await updateTenantSettings(TENANT_A, {
      timezone: testTimezone,
      defaultBookingDurationMinutes: testDuration,
    });

    allPassed =
      check(
        "Settings update persists to PostgreSQL",
        updated.settings.timezone === testTimezone &&
          updated.settings.defaultBookingDurationMinutes === testDuration
      ) && allPassed;

    const reread = await getTenantSettings(TENANT_A);

    allPassed =
      check(
        "Updated settings are returned on the next read",
        reread.settings.timezone === testTimezone &&
          reread.settings.defaultBookingDurationMinutes === testDuration
      ) && allPassed;

    if (redisAvailable) {
      allPassed =
        check(
          "Next read repopulates cache after invalidation",
          reread.cacheStatus === "miss"
        ) && allPassed;

      const repeatedRead = await getTenantSettings(TENANT_A);

      allPassed =
        check(
          "Repeated read uses the Redis cache",
          repeatedRead.cacheStatus === "hit"
        ) && allPassed;

      const tenantBRead = await getTenantSettings(TENANT_B);

      allPassed =
        check(
          "Tenant B settings remain independent",
          tenantBRead.settings.timezone === originalB.timezone &&
            tenantBRead.settings.defaultBookingDurationMinutes ===
              originalB.defaultBookingDurationMinutes
        ) && allPassed;
    } else {
      console.log(
        "[SKIP] Redis hit/invalidation assertions: Redis is not reachable."
      );
    }

    // Simulate a disconnected Redis client in this test process.
    // The production service should still read from PostgreSQL.
    if (redis) {
      redis.disconnect();

      const fallback = await getTenantSettings(TENANT_A);

      allPassed =
        check(
          "Settings remain readable when Redis is disconnected",
          fallback.settings.timezone === testTimezone &&
            fallback.settings.defaultBookingDurationMinutes === testDuration &&
            fallback.cacheStatus === "database-fallback"
        ) && allPassed;
    } else {
      const fallback = await getTenantSettings(TENANT_A);

      allPassed =
        check(
          "Settings remain readable without configured Redis",
          fallback.settings.timezone === testTimezone &&
            fallback.settings.defaultBookingDurationMinutes === testDuration &&
            fallback.cacheStatus === "database-fallback"
        ) && allPassed;
    }
  } finally {
    // Restore both tenants' original settings, including cache invalidation.
    if (originalA) {
      await updateTenantSettings(TENANT_A, {
        timezone: originalA.timezone,
        defaultBookingDurationMinutes:
          originalA.defaultBookingDurationMinutes,
      });
    }

    if (originalB) {
      await updateTenantSettings(TENANT_B, {
        timezone: originalB.timezone,
        defaultBookingDurationMinutes:
          originalB.defaultBookingDurationMinutes,
      });
    }

    if (redis) {
      redis.disconnect();
    }

    await prisma.$disconnect();
  }

  console.log(
    `\nOverall: ${allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`
  );

  process.exit(allPassed ? 0 : 1);
}

main().catch(async (error) => {
  console.error("Settings/cache test failed:", error);
  redis?.disconnect();
  await prisma.$disconnect();
  process.exit(1);
});
