

import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import LogoutButton from "@/components/auth/LogoutButton";

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-white mb-2">You&apos;re logged in</h1>
        <p className="text-sm text-slate-300 mb-1">{user.email}</p>
        <p className="text-xs text-slate-400 mb-6">
          Role: {user.roleName} · Tenant ID: {user.tenantId}
        </p>
        <p className="text-xs text-slate-500 mb-6">
          This is a temporary placeholder page for Phase 1. The real booking
          dashboard is built in a later phase.
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}