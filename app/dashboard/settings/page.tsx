
import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { Permission, roleHasPermission } from "@/lib/rbac";
import TenantSettingsPanel from "@/components/settings/TenantSettingsPanel";

export default async function SettingsPage() {
  try {
    const user = await getCurrentUser();

    if (!roleHasPermission(user.roleName, Permission.MANAGE_ORGANIZATION)) {
      redirect("/dashboard");
    }
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">
        Organization Settings
      </h1>
      <TenantSettingsPanel />
    </div>
  );
}
