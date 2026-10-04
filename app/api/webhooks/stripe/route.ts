import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env.server";
import { prisma } from "@/lib/prisma";
import { withTenantContext } from "@/lib/tenant-context";
import { findTenantIdByStripeCustomerId } from "@/lib/billing/tenant-lookup";
import {
  syncSubscriptionFromStripeObject,
  syncInvoiceFromStripeObject,
  extractCustomerId,
  type StripeSubscriptionLike,
  type StripeInvoiceLike,
} from "@/lib/billing/webhook-sync";
import { isUniqueViolation } from "@/lib/billing/prisma-errors";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const SUPPORTED_EVENT_TYPES = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

interface StripeObjectWithCustomer {
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
}

async function recordProcessedEvent(stripeEventId: string, type: string): Promise<void> {
  try {
    await prisma.processedStripeEvent.create({ data: { stripeEventId, type } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // already recorded by a concurrent delivery — fine
  }
}

export async function POST(req: NextRequest) {

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return apiError("VALIDATION_ERROR", "Missing Stripe-Signature header.", 400);
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.");
    return apiError("INTERNAL_ERROR", "Webhook is not configured.", 500);
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err instanceof Error ? err.message : err);
    return apiError("VALIDATION_ERROR", "Invalid Stripe signature.", 400);
  }

  try {
    if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
      await recordProcessedEvent(event.id, event.type);
      return apiSuccess({ received: true, handled: false });
    }

    const customerId = extractCustomerId(
      (event.data.object as StripeObjectWithCustomer).customer
    );
    if (!customerId) {
      console.error(`Stripe event ${event.id} (${event.type}) has no customer reference.`);
      await recordProcessedEvent(event.id, event.type);
      return apiSuccess({ received: true, handled: false });
    }
    const tenantId = await findTenantIdByStripeCustomerId(customerId);
    if (!tenantId) {
      console.error(`Stripe event ${event.id} (${event.type}) references an unrecognized customer ${customerId}.`);
      await recordProcessedEvent(event.id, event.type);
      return apiSuccess({ received: true, handled: false });
    }

    try {
      await withTenantContext(tenantId, async (tx) => {
        await tx.processedStripeEvent.create({ data: { stripeEventId: event.id, type: event.type } });

        switch (event.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted":
            await syncSubscriptionFromStripeObject(
              tx,
              tenantId,
              event.data.object as StripeSubscriptionLike,
              new Date(event.created * 1000)
            );
            break;
          case "invoice.paid":
          case "invoice.payment_failed":
            await syncInvoiceFromStripeObject(tx, tenantId, event.data.object as StripeInvoiceLike);
            break;
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return apiSuccess({ received: true, handled: true, duplicate: true });
      }
      console.error(`Failed to process Stripe event ${event.id} (${event.type}):`, err instanceof Error ? err.message : err);
      return apiError("INTERNAL_ERROR", "Failed to process webhook event.", 500);
    }

    return apiSuccess({ received: true, handled: true });
  } catch (err) {
    return handleApiError(err);
  }
}