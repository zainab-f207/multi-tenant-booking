

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../lib/env.server";

let client: PrismaClient | null = null;

export function getTestAdminClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export async function disconnectTestAdminClient(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}