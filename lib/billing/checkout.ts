import { env } from "../env.server";
import { getStripe } from "../stripe";
import { getPlanConfig, type PlanKey } from "./plans";
import { ensureStripeCustomer } from "./stripe-customer";
import type { StripeBillingClient } from "./stripe-client";

const APP_BASE_URL = env.APP_BASE_URL ?? "http://localhost:3000";

export async function createSubscriptionCheckoutSession(
  params: { tenantId: string; planKey: PlanKey },
  deps: { stripeClient?: StripeBillingClient } = {}
): Promise<{ url: string }> {
  const stripeClient = deps.stripeClient ?? getStripe();
  const { tenantId, planKey } = params;

  const plan = getPlanConfig(planKey);
  const stripeCustomerId = await ensureStripeCustomer(tenantId, stripeClient);

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${APP_BASE_URL}/dashboard/billing?checkout=success`,
    cancel_url: `${APP_BASE_URL}/dashboard/billing?checkout=cancelled`,
    metadata: { tenantId, planKey }, // correlation only — never the security boundary
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }
  return { url: session.url };
}