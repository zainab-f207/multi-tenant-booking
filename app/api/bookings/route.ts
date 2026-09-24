
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { createBookingSchema, listBookingsQuerySchema } from "@/lib/validation/bookings";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import type { Prisma } from "../../../generated/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.VIEW_BOOKINGS);

    const query = listBookingsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.startTime = {
        ...(query.startDate ? { gte: query.startDate } : {}),
        ...(query.endDate ? { lte: query.endDate } : {}),
      };
    }

    const { bookings, total } = await withTenantContext(user.tenantId, async (tx) => {
      
      const bookings = await tx.booking.findMany({
        where,
        orderBy: { startTime: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      const total = await tx.booking.count({ where });
      return { bookings, total };
    });

    return apiSuccess({
      bookings,
      pagination: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.CREATE_BOOKINGS);

    const body = await req.json();
    const input = createBookingSchema.parse(body);

    const booking = await withTenantContext(user.tenantId, (tx) =>
      tx.booking.create({
        data: {
          tenantId: user.tenantId, 
          createdById: user.id, 
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      })
    );

    return apiSuccess(booking, 201);
  } catch (err) {
    return handleApiError(err);
  }
}