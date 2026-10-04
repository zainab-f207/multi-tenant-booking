import { ApiClientError } from "./booking-client";

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}
interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

async function parseResponse<T>(res: Response): Promise<T> {
  let body: ApiSuccessBody<T> | ApiErrorBody;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError("INTERNAL_ERROR", "The server returned an unexpected response.", res.status);
  }
  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message, res.status, body.error.details);
  }
  return body.data;
}

export type SubscriptionStatus =
  | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "TRIALING" | "ACTIVE"
  | "PAST_DUE" | "CANCELED" | "UNPAID" | "PAUSED";

export interface SubscriptionDTO {
  id: string;
  tenantId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  planKey: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  lastStripeEventAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCurrentSubscription(): Promise<{
  subscription: SubscriptionDTO | null;
  hasStripeCustomer: boolean;
}> {
  const res = await fetch("/api/billing/subscription", { method: "GET" });
  return parseResponse<{
    subscription: SubscriptionDTO | null;
    hasStripeCustomer: boolean;
  }>(res);
}

export type PlanKey = "basic" | "pro";

export async function startCheckout(planKey: PlanKey): Promise<{ url: string }> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey }),
  });
  return parseResponse<{ url: string }>(res);
}

export interface InvoiceDTO {
  id: string;
  stripeInvoiceId: string;
  amountPaid: number;
  currency: string;
  status: "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID";
  hostedInvoiceUrl: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export async function fetchInvoices(): Promise<InvoiceDTO[]> {
  const res = await fetch("/api/billing/invoices", { method: "GET" });
  const data = await parseResponse<{ invoices: InvoiceDTO[] }>(res);
  return data.invoices;
}

export async function openBillingPortal(): Promise<{ url: string }> {
  const res = await fetch("/api/billing/portal", { method: "POST" });
  return parseResponse<{ url: string }>(res);
}
export { ApiClientError };