
import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env.server";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export const redis =
  env.REDIS_URL
    ? (globalForRedis.redis ??= new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (attempt) => Math.min(attempt * 200, 1000),
        connectTimeout: 1000,
      }))
    : null;

redis?.on("error", () => {
  // Redis is an optional cache. Database operations must continue if it fails.
});
