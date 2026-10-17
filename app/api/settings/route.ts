
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { apiSuccess, handleApiError, ApiValidationError } from "@/lib/api/errors";
import { getTenantSettings, updateTenantSettings } from "@/lib/settings/service";

const settingsSchema = z.object({
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid time zone."),
  defaultBookingDurationMinutes: z.number().int().min(15).max(480).refine(
    (value) => value % 15 === 0,
    "Duration must be a multiple of 15 minutes."
  ),
}).strict();

export async function GET() {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_ORGANIZATION);

    const result = await getTenantSettings(user.tenantId);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_ORGANIZATION);

    const body: unknown = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiValidationError(
        "Invalid settings. Check the timezone and booking duration.",
        parsed.error.flatten()
      );
    }

    const result = await updateTenantSettings(user.tenantId, parsed.data);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
