import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import BillingPanel from "@/components/billing/BillingPanel";

export default async function BillingPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  if (!roleHasPermission(user.roleName, Permission.VIEW_BILLING)) {
    redirect("/dashboard");
  }

  const canManageBilling = roleHasPermission(user.roleName, Permission.MANAGE_BILLING);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Billing</h1>
      <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
        <BillingPanel canManageBilling={canManageBilling} />
      </Suspense>
    </div>
  );
}