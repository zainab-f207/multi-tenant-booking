import { env } from "../env.server";
import { getStripe } from "../stripe";
import { withTenantContext } from "../tenant-context";
import type { StripeBillingPortalClient } from "./stripe-client";

const APP_BASE_URL = env.APP_BASE_URL ?? "http://localhost:3000";

export async function createBillingPortalSession(
  tenantId: string,
  deps: { stripeClient?: StripeBillingPortalClient } = {}
): Promise<{ url: string }> {
  const stripeClient = deps.stripeClient ?? getStripe();

  // Never creates a customer here — only reuses the one ensureStripeCustomer()
  // already established via Checkout. If none exists yet, fail rather than
  // silently creating one (this flow is for an existing subscriber).
  const account = await withTenantContext(tenantId, (tx) =>
    tx.tenantBillingAccount.findUnique({ where: { tenantId } })
  );
  if (!account) {
    throw new Error("No Stripe customer exists for this tenant yet.");
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${APP_BASE_URL}/dashboard/billing`,
  });

  return { url: session.url };
}