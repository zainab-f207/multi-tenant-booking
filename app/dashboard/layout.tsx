import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import LogoutButton from "@/components/auth/LogoutButton";
import DashboardNav, { type NavItem } from "@/components/dashboard/DashboardNav";
import { CalendarIcon } from "@/components/auth/icons";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { Permission, roleHasPermission } from "@/lib/rbac";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let canViewBookings = false;
  let canViewBilling = false;
  let canManageOrganization = false;

  try {
    const user = await getCurrentUser();
    canViewBookings = roleHasPermission(user.roleName, Permission.VIEW_BOOKINGS);
    canViewBilling = roleHasPermission(user.roleName, Permission.VIEW_BILLING);
    canManageOrganization = roleHasPermission(user.roleName, Permission.MANAGE_ORGANIZATION);
  } catch (err) {
    if (!(err instanceof UnauthenticatedError)) throw err;
  }

  const items: NavItem[] = [{ href: "/dashboard", label: "Overview" }];
  if (canViewBookings) items.push({ href: "/dashboard/bookings", label: "Bookings" });
  if (canViewBilling) items.push({ href: "/dashboard/billing", label: "Billing" });
  if (canManageOrganization) items.push({ href: "/dashboard/settings", label: "Settings" });

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <header className="border-b border-white/10 bg-white/3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            >
              <CalendarIcon className="h-5 w-5 text-indigo-400" />
              Multi-Tenant Booking
            </Link>
            <DashboardNav items={items} logout={<LogoutButton />} />
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
