
import "server-only";
import { withTenantContext } from "@/lib/tenant-context";
import { redis } from "@/lib/redis";

const CACHE_TTL_SECONDS = 60;
const cacheKey = (tenantId: string) =>
  `tenant:${tenantId}:settings:v1`;

export type TenantSettings = {
  id: string;
  tenantId: string;
  timezone: string;
  defaultBookingDurationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

type CacheStatus = "hit" | "miss" | "database-fallback";

export type SettingsResult = {
  settings: TenantSettings;
  cacheStatus: CacheStatus;
};

async function readFromDatabase(
  tenantId: string
): Promise<TenantSettings> {
  return withTenantContext(tenantId, async (tx) => {
    const settings = await tx.tenantSetting.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    return settings;
  });
}

export async function getTenantSettings(
  tenantId: string
): Promise<SettingsResult> {
  const key = cacheKey(tenantId);

  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }

      const cached = await redis.get(key);

      if (cached) {
        const settings = JSON.parse(cached) as TenantSettings;

        if (
          settings.tenantId === tenantId &&
          typeof settings.timezone === "string" &&
          typeof settings.defaultBookingDurationMinutes === "number"
        ) {
          return { settings, cacheStatus: "hit" };
        }

        await redis.del(key);
      }

      const settings = await readFromDatabase(tenantId);

      await redis.set(
        key,
        JSON.stringify(settings),
        "EX",
        CACHE_TTL_SECONDS
      );

      return { settings, cacheStatus: "miss" };
    } catch {
      const settings = await readFromDatabase(tenantId);
      return { settings, cacheStatus: "database-fallback" };
    }
  }

  const settings = await readFromDatabase(tenantId);
  return { settings, cacheStatus: "database-fallback" };
}

export async function updateTenantSettings(
  tenantId: string,
  input: Pick<TenantSettings, "timezone" | "defaultBookingDurationMinutes">
): Promise<SettingsResult> {
  const settings = await withTenantContext(tenantId, async (tx) =>
    tx.tenantSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        timezone: input.timezone,
        defaultBookingDurationMinutes: input.defaultBookingDurationMinutes,
      },
      update: {
        timezone: input.timezone,
        defaultBookingDurationMinutes: input.defaultBookingDurationMinutes,
      },
    })
  );

  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }

      await redis.del(cacheKey(tenantId));

      return { settings, cacheStatus: "miss" };
    } catch {
      return { settings, cacheStatus: "database-fallback" };
    }
  }

  return { settings, cacheStatus: "database-fallback" };
}
