import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import { withTenantContext } from "../tenant-context";
import { getStripe } from "../stripe";
import type { StripeCustomerClient } from "./stripe-client";

function isUniqueViolationOn(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray((err.meta as { target?: unknown })?.target) &&
    (err.meta as { target: string[] }).target.includes(field)
  );
}

export async function ensureStripeCustomer(
  tenantId: string,
  stripeClient: StripeCustomerClient = getStripe()
): Promise<string> {
  const existing = await withTenantContext(tenantId, (tx) =>
    tx.tenantBillingAccount.findUnique({ where: { tenantId } })
  );
  if (existing) {
    return existing.stripeCustomerId;
  }

  const tenant = await withTenantContext(tenantId, (tx) =>
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  );

  const customer = await stripeClient.customers.create(
    {
      name: tenant.name,
      metadata: { tenantId }, 
    },
    { idempotencyKey: `ensure-stripe-customer:${tenantId}` }
  );

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.tenantBillingAccount.create({
        data: { tenantId, stripeCustomerId: customer.id },
      })
    );
    return customer.id;
  } catch (err) {
    if (isUniqueViolationOn(err, "tenantId")) {
      const winner = await withTenantContext(tenantId, (tx) =>
        tx.tenantBillingAccount.findUniqueOrThrow({ where: { tenantId } })
      );
      return winner.stripeCustomerId;
    }
    throw err;
  }
}

export { prisma }; 