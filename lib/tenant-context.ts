import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidTenantId(tenantId: string): void {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error(`withTenantContext: invalid tenant id: "${tenantId}"`);
  }
}

export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  assertValidTenantId(tenantId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config(
        'app.current_tenant_id',
        ${tenantId},
        true
      )
    `;

    return callback(tx);
  });
}