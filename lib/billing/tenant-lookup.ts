import { prisma } from "../prisma";

interface TenantLookupRow {
  tenantId: string;
}

export async function findTenantIdByStripeCustomerId(
  stripeCustomerId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<TenantLookupRow[]>`
    SELECT * FROM find_tenant_id_by_stripe_customer(${stripeCustomerId})
  `;
  return rows[0]?.tenantId ?? null;
}