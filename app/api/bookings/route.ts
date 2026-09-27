

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { createBookingSchema, listBookingsQuerySchema } from "@/lib/validation/bookings";
import { idempotencyKeySchema } from "../../../lib/validation/idempotency";
import { createIdempotentBooking, hashBookingRequest } from "@/lib/api/idempotency";
import { apiSuccess, handleApiError, ApiValidationError } from "@/lib/api/errors";
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

    const rawKey = req.headers.get("Idempotency-Key");
    if (rawKey === null) {
      throw new ApiValidationError("The Idempotency-Key header is required.");
    }
    const key = idempotencyKeySchema.parse(rawKey);

    const body = await req.json();
    const input = createBookingSchema.parse(body);

    const requestHash = hashBookingRequest(input);

    const result = await createIdempotentBooking(
      user.tenantId,
      user.id,
      key,
      requestHash,
      input
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return handleApiError(err);
  }
}