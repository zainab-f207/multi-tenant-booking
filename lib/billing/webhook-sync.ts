import type Stripe from "stripe";
import { env } from "../env.server";
import type { Prisma } from "../../generated/prisma/client";


export interface StripeSubscriptionLike {
  id: string;
  status: Stripe.Subscription.Status;
  cancel_at_period_end: boolean;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  items: { data: Array<{ price: { id: string }; current_period_end: number }> };
}

export interface StripeInvoiceLike {
  id: string;
  amount_paid: number;
  currency: string;
  status: Stripe.Invoice.Status | null;
  hosted_invoice_url: string | null;
  period_start: number | null;
  period_end: number | null;
  created: number;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
}

export function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function stripeTimestampToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

type SubscriptionStatusValue =
  | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "TRIALING" | "ACTIVE"
  | "PAST_DUE" | "CANCELED" | "UNPAID" | "PAUSED";

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatusValue {
  switch (status) {
    case "incomplete": return "INCOMPLETE";
    case "incomplete_expired": return "INCOMPLETE_EXPIRED";
    case "trialing": return "TRIALING";
    case "active": return "ACTIVE";
    case "past_due": return "PAST_DUE";
    case "canceled": return "CANCELED";
    case "unpaid": return "UNPAID";
    case "paused": return "PAUSED";
    default: {
      throw new Error(`Unmapped Stripe subscription status: ${String(status)}`);
    }
  }
}

type InvoiceStatusValue = "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID";

export function mapStripeInvoiceStatus(status: Stripe.Invoice.Status): InvoiceStatusValue {
  switch (status) {
    case "draft": return "DRAFT";
    case "open": return "OPEN";
    case "paid": return "PAID";
    case "uncollectible": return "UNCOLLECTIBLE";
    case "void": return "VOID";
    default: {
      throw new Error(`Unmapped Stripe invoice status: ${String(status)}`);
    }
  }
}

export function resolvePlanKeyFromPriceId(stripePriceId: string): string {
  if (env.STRIPE_PRICE_ID_BASIC && stripePriceId === env.STRIPE_PRICE_ID_BASIC) return "basic";
  if (env.STRIPE_PRICE_ID_PRO && stripePriceId === env.STRIPE_PRICE_ID_PRO) return "pro";
  return "unrecognized";
}

export async function syncSubscriptionFromStripeObject(
  tx: Prisma.TransactionClient,
  tenantId: string,
  subscription: StripeSubscriptionLike,
  eventCreatedAt: Date
): Promise<void> {
  const existing = await tx.subscription.findUnique({ where: { tenantId } });
  if (existing && existing.lastStripeEventAt > eventCreatedAt) {
    return;
  }

  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    throw new Error(`Subscription ${subscription.id} has no items — cannot determine price/period.`);
  }

  const planKey = resolvePlanKeyFromPriceId(firstItem.price.id);
  const data = {
    stripeSubscriptionId: subscription.id,
    stripePriceId: firstItem.price.id,
    planKey,
    status: mapStripeSubscriptionStatus(subscription.status),
    currentPeriodEnd: stripeTimestampToDate(firstItem.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    lastStripeEventAt: eventCreatedAt,
  };

  await tx.subscription.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

export async function syncInvoiceFromStripeObject(
  tx: Prisma.TransactionClient,
  tenantId: string,
  invoice: StripeInvoiceLike
): Promise<void> {
  const periodStartSeconds = invoice.period_start ?? invoice.created;
  const periodEndSeconds = invoice.period_end ?? invoice.created;

  const data = {
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    status: mapStripeInvoiceStatus(invoice.status ?? "open"),
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    periodStart: stripeTimestampToDate(periodStartSeconds),
    periodEnd: stripeTimestampToDate(periodEndSeconds),
  };

  await tx.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: { tenantId, stripeInvoiceId: invoice.id, ...data },
    update: data,
  });
}