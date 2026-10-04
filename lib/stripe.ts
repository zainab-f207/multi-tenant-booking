import Stripe from "stripe";
import { env } from "@/lib/env.server";
import { BillingConfigurationError } from "@/lib/billing/errors";

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new BillingConfigurationError();
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}