import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.VIEW_BILLING);

    const { subscription, hasStripeCustomer } = await withTenantContext(
      user.tenantId,
      async (tx) => {
        const [subscription, billingAccount] = await Promise.all([
          tx.subscription.findUnique({ where: { tenantId: user.tenantId } }),
          tx.tenantBillingAccount.findUnique({
            where: { tenantId: user.tenantId },
            select: { tenantId: true },
          }),
        ]);
        return { subscription, hasStripeCustomer: billingAccount !== null };
      }
    );

    return apiSuccess({ subscription, hasStripeCustomer });
  } catch (err) {
    return handleApiError(err);
  }
}