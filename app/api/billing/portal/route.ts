import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { createBillingPortalSession } from "@/lib/billing/portal";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function POST() {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_BILLING);

    const { url } = await createBillingPortalSession(user.tenantId);
    return apiSuccess({ url });
  } catch (err) {
    return handleApiError(err);
  }
}