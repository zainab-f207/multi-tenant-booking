import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.VIEW_BILLING);

    const invoices = await withTenantContext(user.tenantId, (tx) =>
      tx.invoice.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
      })
    );

    return apiSuccess({ invoices });
  } catch (err) {
    return handleApiError(err);
  }
}