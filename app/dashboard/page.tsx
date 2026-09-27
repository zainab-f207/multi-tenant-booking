
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-white mb-2">You&apos;re logged in</h1>
        <p className="text-sm text-slate-300 mb-1">{user.email}</p>
        <p className="text-xs text-slate-400 mb-6">
          Role: {user.roleName} · Tenant ID: {user.tenantId}
        </p>
        <Link
          href="/dashboard/bookings"
          className="inline-block w-full rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-medium py-2.5 px-4 shadow-lg shadow-indigo-900/30 transition-all"
        >
          View Bookings
        </Link>
      </div>
    </div>
  );
}