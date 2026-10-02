import Stripe from "stripe";
import { env } from "@/lib/env.server";

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in .env before using billing functionality."
    );
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}