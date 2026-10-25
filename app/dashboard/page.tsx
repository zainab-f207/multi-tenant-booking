import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { Permission, roleHasPermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Status, { label: string; dot: string }> = {
  PENDING: { label: "Pending", dot: "bg-amber-400" },
  CONFIRMED: { label: "Confirmed", dot: "bg-emerald-400" },
  COMPLETED: { label: "Completed", dot: "bg-sky-400" },
  CANCELLED: { label: "Cancelled", dot: "bg-slate-400" },
};

const SUBSCRIPTION_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trial",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
  INCOMPLETE_EXPIRED: "Expired",
  UNPAID: "Unpaid",
  PAUSED: "Paused",
};

// Server-rendered in UTC so output is deterministic; labelled accordingly.
const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

type User = Awaited<ReturnType<typeof getCurrentUser>>;

async function loadSummary(user: User, canViewBilling: boolean) {
  // Tenant comes from the authenticated session. withTenantContext sets the RLS tenant
  // for the transaction, and each query also filters on the same server-derived tenant.
  return withTenantContext(user.tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirst({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const counts = {} as Record<Status, number>;
    for (const status of STATUSES) {
      counts[status] = await tx.booking.count({ where: { tenantId: user.tenantId, status } });
    }

    const upcoming = await tx.booking.findMany({
      where: {
        tenantId: user.tenantId,
        startTime: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      orderBy: { startTime: "asc" },
      take: 5,
      select: { id: true, title: true, startTime: true, endTime: true, status: true },
    });

    // Local, webhook-synchronized state only. No Stripe API call is made here.
    const subscription = canViewBilling
      ? await tx.subscription.findFirst({
          where: { tenantId: user.tenantId },
          select: { status: true, planKey: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
        })
      : null;

    return { organizationName: tenant?.name ?? null, counts, upcoming, subscription };
  });
}

const card = "rounded-2xl border border-white/10 bg-white/[0.05] p-5";
const actionLink =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70";
const primaryAction = `${actionLink} bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500`;
const secondaryAction = `${actionLink} border border-white/15 text-slate-100 hover:bg-white/[0.06]`;

export default async function DashboardPage() {
  let user: User;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const can = (permission: Permission) => roleHasPermission(user.roleName, permission);
  const canViewBookings = can(Permission.VIEW_BOOKINGS);
  const canCreateBookings = can(Permission.CREATE_BOOKINGS);
  const canViewBilling = can(Permission.VIEW_BILLING);
  const canManageBilling = can(Permission.MANAGE_BILLING);
  const canManageOrganization = can(Permission.MANAGE_ORGANIZATION);

  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  try {
    summary = await loadSummary(user, canViewBilling);
  } catch (err) {
    // Log the error type only: never the message, which may contain query details.
    console.error("Dashboard summary failed:", err instanceof Error ? err.name : "unknown");
  }

  const total = summary ? STATUSES.reduce((sum, s) => sum + summary.counts[s], 0) : 0;
  const subscription = summary?.subscription ?? null;

  return (
    <div className="space-y-6">
      <section aria-labelledby="welcome-heading" className={card}>
        <h1 id="welcome-heading" className="text-2xl font-semibold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mt-1 break-words text-sm text-slate-300">
          Signed in as {user.email}
          <span className="mx-2 text-slate-600" aria-hidden="true">|</span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-slate-200">
            {user.roleName}
          </span>
          {summary?.organizationName ? <span className="block pt-1 sm:inline sm:pl-3">{summary.organizationName}</span> : null}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canCreateBookings && (
            <Link href="/dashboard/bookings/new" className={primaryAction}>
              New booking
            </Link>
          )}
          {canViewBookings && (
            <Link href="/dashboard/bookings" className={secondaryAction}>
              View bookings
            </Link>
          )}
          {canViewBilling && (
            <Link href="/dashboard/billing" className={secondaryAction}>
              {canManageBilling ? "Manage billing" : "View billing"}
            </Link>
          )}
          {canManageOrganization && (
            <Link href="/dashboard/settings" className={secondaryAction}>
              Organization settings
            </Link>
          )}
        </div>
      </section>

      {!summary && (
        <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
          <h2 className="text-base font-semibold text-rose-100">We couldn’t load your summary</h2>
          <p className="mt-1 text-sm text-rose-200">
            Your bookings are safe. Refresh the page to try again.
          </p>
          <Link href="/dashboard" className={`${secondaryAction} mt-3`}>
            Refresh
          </Link>
        </div>
      )}

      {summary && canViewBookings && (
        <section aria-labelledby="status-heading">
          <h2 id="status-heading" className="mb-3 text-lg font-semibold text-white">
            Bookings by status
          </h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATUSES.map((status) => (
              <div key={status} className={card}>
                <dt className="flex items-center gap-2 text-sm text-slate-300">
                  <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[status].dot}`} aria-hidden="true" />
                  {STATUS_STYLE[status].label}
                </dt>
                <dd className="mt-2 text-3xl font-semibold text-white">{summary.counts[status]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            {total} booking{total === 1 ? "" : "s"} in your organization.
          </p>
        </section>
      )}

      {summary && canViewBookings && (
        <section aria-labelledby="upcoming-heading" className={card}>
          <h2 id="upcoming-heading" className="text-lg font-semibold text-white">
            Upcoming bookings
          </h2>
          {summary.upcoming.length === 0 ? (
            <div className="mt-3 text-sm text-slate-300">
              <p>No upcoming pending or confirmed bookings.</p>
              {canCreateBookings && (
                <Link href="/dashboard/bookings/new" className={`${primaryAction} mt-3`}>
                  Create a booking
                </Link>
              )}
            </div>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-white/10">
                {summary.upcoming.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/dashboard/bookings/${b.id}`}
                      className="flex flex-col gap-1 rounded-lg py-3 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 sm:flex-row sm:items-center sm:justify-between sm:px-2"
                    >
                      <span className="min-w-0 break-words font-medium text-white">{b.title}</span>
                      <span className="text-sm text-slate-300">
                        {dateTime.format(b.startTime)} UTC
                        <span className="ml-2 text-xs text-slate-400">
                          {STATUS_STYLE[b.status as Status]?.label ?? b.status}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/bookings" className="mt-2 inline-block rounded text-sm text-indigo-300 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70">
                See all bookings
              </Link>
            </>
          )}
        </section>
      )}

      {summary && canViewBilling && (
        <section aria-labelledby="billing-heading" className={card}>
          <h2 id="billing-heading" className="text-lg font-semibold text-white">
            Billing overview
          </h2>
          {subscription ? (
            <div className="mt-3 text-sm text-slate-300">
              <p>
                Status:{" "}
                <span className="font-medium text-white">
                  {SUBSCRIPTION_LABEL[subscription.status] ?? subscription.status}
                </span>
                <span className="mx-2 text-slate-600" aria-hidden="true">|</span>
                Plan:{" "}
                <span className="font-medium text-white">
                  {subscription.planKey === "unrecognized" ? "Not recognized" : subscription.planKey}
                </span>
              </p>
              <p className="mt-1">
                {subscription.cancelAtPeriodEnd
                  ? `Set to cancel at the end of the current period (${dateOnly.format(subscription.currentPeriodEnd)}).`
                  : `Current period ends ${dateOnly.format(subscription.currentPeriodEnd)}.`}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-300">No subscription is recorded for your organization yet.</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Shown from your organization’s saved billing state, which Stripe updates through webhooks. Finishing
            Checkout does not change it until Stripe confirms.
          </p>
          <Link href="/dashboard/billing" className={`${secondaryAction} mt-3`}>
            {canManageBilling ? "Manage billing" : "View billing"}
          </Link>
        </section>
      )}
    </div>
  );
}
