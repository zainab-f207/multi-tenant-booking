"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchCurrentSubscription,
  fetchInvoices,
  startCheckout,
  openBillingPortal,
  ApiClientError,
  type SubscriptionDTO,
  type InvoiceDTO,
  type PlanKey,
} from "@/lib/api/billing-client";
import { useToast } from "@/components/ui/Toast";

const PLANS: Array<{ key: PlanKey; name: string; blurb: string }> = [
  { key: "basic", name: "Basic", blurb: "For individuals and small teams getting started with booking management." },
  { key: "pro", name: "Pro", blurb: "For growing teams that need more booking capacity and support." },
];

const MANAGEABLE_STATUSES = new Set([
  "ACTIVE", "TRIALING", "PAST_DUE", "UNPAID", "PAUSED", "INCOMPLETE",
]);

function describeSubscriptionState(s: SubscriptionDTO): string {
  switch (s.status) {
    case "ACTIVE":
      return s.cancelAtPeriodEnd ? "Active — cancels at period end" : "Active — renews automatically";
    case "TRIALING": return "Trialing";
    case "PAST_DUE": return "Past due";
    case "CANCELED": return "Canceled";
    case "UNPAID": return "Unpaid";
    case "PAUSED": return "Paused";
    case "INCOMPLETE": return "Incomplete";
    case "INCOMPLETE_EXPIRED": return "Incomplete (expired)";
    default: return s.status;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatAmount(amountPaid: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
      amountPaid / 100
    );
  } catch {
    return `${(amountPaid / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export default function BillingPanel({ canManageBilling }: { canManageBilling: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const checkoutResult = searchParams.get("checkout");

  const [subscription, setSubscription] = useState<SubscriptionDTO | null | undefined>(undefined);
  const [hasStripeCustomer, setHasStripeCustomer] = useState<boolean | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState<ApiClientError | null>(null);
  const [subReloadToken, setSubReloadToken] = useState(0);

  const [invoices, setInvoices] = useState<InvoiceDTO[] | null>(null);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<ApiClientError | null>(null);
  const [invReloadToken, setInvReloadToken] = useState(0);

  const [checkingOut, setCheckingOut] = useState<PlanKey | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function run() {
      setSubLoading(true);
      setSubError(null);
      try {
        const result = await fetchCurrentSubscription();
        if (ignore) return;
        setSubscription(result.subscription);
        setHasStripeCustomer(result.hasStripeCustomer);
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiClientError) {
          setSubError(err);
          if (err.code === "UNAUTHENTICATED") router.push("/login");
        } else {
          setSubError(new ApiClientError("INTERNAL_ERROR", "Something went wrong. Please try again.", 0));
        }
      } finally {
        if (!ignore) setSubLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [router, subReloadToken]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      setInvLoading(true);
      setInvError(null);
      try {
        const result = await fetchInvoices();
        if (ignore) return;
        setInvoices(result);
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiClientError) {
          setInvError(err);
        } else {
          setInvError(new ApiClientError("INTERNAL_ERROR", "Something went wrong. Please try again.", 0));
        }
      } finally {
        if (!ignore) setInvLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [invReloadToken]);

  async function handleChoosePlan(planKey: PlanKey) {
    if (checkingOut) return;
    setCheckingOut(planKey);
    try {
      const { url } = await startCheckout(planKey);
      window.location.assign(url);
    } catch (err) {
      setCheckingOut(null);
      const message = err instanceof ApiClientError ? err.message : "Could not start checkout. Please try again.";
      showToast("error", message);
    }
  }

  async function handleManageBilling() {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const { url } = await openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      setOpeningPortal(false);
      const message = err instanceof ApiClientError ? err.message : "Could not open billing management. Please try again.";
      showToast("error", message);
    }
  }

  const hasManageableSubscription = subscription != null && MANAGEABLE_STATUSES.has(subscription.status);

  return (
    <div className="space-y-8">
      {checkoutResult === "success" && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Checkout completed. Your subscription will update here once Stripe confirms the payment —
          this may take a few moments.
        </div>
      )}
      {checkoutResult === "cancelled" && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          Checkout was cancelled. No changes were made.
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-1">Current subscription</h2>
        <p className="text-xs text-slate-400 mb-4">
          Reflects your organization&apos;s actual billing state as recorded from Stripe.
        </p>

        {subLoading && <div className="text-sm text-slate-400 py-4">Loading subscription…</div>}

        {!subLoading && subError && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
            <span>{subError.message}</span>
            <button onClick={() => setSubReloadToken((t) => t + 1)} className="shrink-0 rounded-md border border-rose-300/40 px-3 py-1 hover:bg-rose-400/10">
              Retry
            </button>
          </div>
        )}

        {!subLoading && !subError && subscription == null && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
            No active subscription yet.
          </div>
        )}

        {!subLoading && !subError && subscription && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="text-white font-medium">{subscription.planKey}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Status</span><span className="text-white font-medium">{describeSubscriptionState(subscription)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Current period ends</span><span className="text-white font-medium">{formatDate(subscription.currentPeriodEnd)}</span></div>

          </div>
        )}

        {!subLoading && !subError && canManageBilling && hasStripeCustomer && (
          <div className="mt-4">
            <button
              onClick={handleManageBilling}
              disabled={openingPortal}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 transition-colors"
            >
              {openingPortal ? "Opening billing management…" : "Manage billing"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Change plans, update payment method, or cancel via Stripe&apos;s secure billing portal.
            </p>
          </div>
        )}

        {!subLoading && !subError && canManageBilling && hasStripeCustomer === false && (
          <p className="mt-4 text-sm text-slate-400">
            Billing Portal is unavailable until a Stripe customer account is configured.
          </p>
        )}
      </section>

      {(!hasManageableSubscription || !canManageBilling) && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">Plans</h2>
          <p className="text-xs text-slate-400 mb-4">Plan details shown here are informational; actual pricing is configured in Stripe.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.key} className="rounded-lg border border-white/10 bg-white/5 p-5 flex flex-col">
                <h3 className="text-white font-semibold mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-300 flex-1 mb-4">{plan.blurb}</p>
                {canManageBilling ? (
                  <button
                    onClick={() => handleChoosePlan(plan.key)}
                    disabled={checkingOut !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 shadow-lg shadow-indigo-900/30 transition-all"
                  >
                    {checkingOut === plan.key ? "Starting checkout…" : `Choose ${plan.name}`}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">Only an administrator can change plans.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-1">Billing history</h2>
        <p className="text-xs text-slate-400 mb-4">Invoices recorded from Stripe for your organization.</p>

        {invLoading && <div className="text-sm text-slate-400 py-4">Loading invoices…</div>}

        {!invLoading && invError && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
            <span>{invError.message}</span>
            <button onClick={() => setInvReloadToken((t) => t + 1)} className="shrink-0 rounded-md border border-rose-300/40 px-3 py-1 hover:bg-rose-400/10">
              Retry
            </button>
          </div>
        )}

        {!invLoading && !invError && invoices && invoices.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
            No invoices yet.
          </div>
        )}

        {!invLoading && !invError && invoices && invoices.length > 0 && (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <div className="text-white text-sm font-medium">{formatDate(inv.createdAt)}</div>
                  <div className="text-xs text-slate-400">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)} · {inv.status}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white text-sm font-medium">{formatAmount(inv.amountPaid, inv.currency)}</span>
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-300 hover:text-indigo-200 underline">
                      View invoice
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}