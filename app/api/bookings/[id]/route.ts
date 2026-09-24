

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { bookingIdSchema, updateBookingSchema } from "@/lib/validation/bookings";
import {
  apiSuccess,
  handleApiError,
  NotFoundError,
  ApiValidationError,
  isPrismaNotFoundError,
} from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.VIEW_BOOKINGS);

    const { id } = await params;
    const bookingId = bookingIdSchema.parse(id);

    const booking = await withTenantContext(user.tenantId, (tx) =>
      tx.booking.findUnique({ where: { id: bookingId } })
    );

    if (!booking) throw new NotFoundError("Booking not found.");

    return apiSuccess(booking);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_BOOKINGS);

    const { id } = await params;
    const bookingId = bookingIdSchema.parse(id);

    const body = await req.json();
    const input = updateBookingSchema.parse(body);

    const updated = await withTenantContext(user.tenantId, async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!existing) return null;

      const finalStart = input.startTime ?? existing.startTime;
      const finalEnd = input.endTime ?? existing.endTime;
      if (finalEnd.getTime() <= finalStart.getTime()) {
        throw new ApiValidationError("endTime must be later than startTime.");
      }

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
          status: input.status,
        },
      });
    });

    if (!updated) throw new NotFoundError("Booking not found.");

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.MANAGE_BOOKINGS);

    const { id } = await params;
    const bookingId = bookingIdSchema.parse(id);

    const deleted = await withTenantContext(user.tenantId, async (tx) => {
      try {
        return await tx.booking.delete({ where: { id: bookingId } });
      } catch (err) {
        
        if (isPrismaNotFoundError(err)) return null;
        throw err;
      }
    });

    if (!deleted) throw new NotFoundError("Booking not found.");

    return apiSuccess({ id: bookingId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}