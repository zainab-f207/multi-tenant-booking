import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { checkoutRequestSchema } from "@/lib/validation/billing";
import { createSubscriptionCheckoutSession } from "@/lib/billing/checkout";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_BILLING);

    const body = await req.json();
    const input = checkoutRequestSchema.parse(body);

    const { url } = await createSubscriptionCheckoutSession({
      tenantId: user.tenantId, 
      planKey: input.planKey,
    });

    return apiSuccess({ url });
  } catch (err) {
    return handleApiError(err);
  }
}