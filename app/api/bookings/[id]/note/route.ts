import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Permission, requirePermission } from "@/lib/rbac";
import { withTenantContext } from "@/lib/tenant-context";
import { bookingIdSchema } from "@/lib/validation/bookings";
import {
  apiSuccess,
  handleApiError,
  NotFoundError,
  ApiValidationError,
  VersionConflictError,
} from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

const updateNoteSchema = z.object({
  content: z.string().max(10000, "The note cannot exceed 10,000 characters."),
  expectedVersion: z.number().int().min(0),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.VIEW_BOOKINGS);

    const { id } = await params;
    const bookingId = bookingIdSchema.parse(id);

    const result = await withTenantContext(user.tenantId, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId: user.tenantId },
        select: { id: true },
      });

      if (!booking) {
        throw new NotFoundError("Booking not found.");
      }

      const note = await tx.bookingNote.findFirst({
        where: {
          tenantId: user.tenantId,
          bookingId,
        },
      });

      return {
        content: note?.content ?? "",
        version: note?.version ?? 0,
        updatedAt: note?.updatedAt ?? null,
        updatedById: note?.updatedById ?? null,
      };
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();
    requirePermission(user.roleName, Permission.EDIT_BOOKING_NOTES);

    const { id } = await params;
    const bookingId = bookingIdSchema.parse(id);

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      throw new ApiValidationError("The request body must contain valid JSON.");
    }

    const input = updateNoteSchema.parse(body);

    const result = await withTenantContext(user.tenantId, async (tx) => {
      // Lock this booking row so two first-time saves cannot race.
      const bookings = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "bookings"
        WHERE "id" = ${bookingId}::uuid
          AND "tenantId" = ${user.tenantId}::uuid
        FOR UPDATE
      `;

      if (bookings.length === 0) {
        throw new NotFoundError("Booking not found.");
      }

      const existing = await tx.bookingNote.findFirst({
        where: {
          tenantId: user.tenantId,
          bookingId,
        },
      });

      const currentVersion = existing?.version ?? 0;

      if (input.expectedVersion !== currentVersion) {
        throw new VersionConflictError(
          input.expectedVersion,
          currentVersion
        );
      }

      if (!existing) {
        const created = await tx.bookingNote.create({
          data: {
            tenantId: user.tenantId,
            bookingId,
            content: input.content,
            version: 1,
            updatedById: user.id,
          },
        });

        return {
          content: created.content,
          version: created.version,
          updatedAt: created.updatedAt,
          updatedById: created.updatedById,
        };
      }

      const updated = await tx.bookingNote.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          version: existing.version + 1,
          updatedById: user.id,
        },
      });

      return {
        content: updated.content,
        version: updated.version,
        updatedAt: updated.updatedAt,
        updatedById: updated.updatedById,
      };
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}