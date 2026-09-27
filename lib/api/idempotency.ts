
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { withTenantContext } from "../tenant-context";
import type { CreateBookingInput } from "../validation/bookings";
import { IdempotencyKeyConflictError } from "./errors";

export function hashBookingRequest(input: CreateBookingInput): string {
  const normalized = {
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    startTime: input.startTime.toISOString(),
    endTime: input.endTime.toISOString(),
  };

  const canonical = JSON.stringify(normalized, [
    "title",
    "description",
    "startTime",
    "endTime",
  ]);

  return createHash("sha256").update(canonical).digest("hex");
}

function isIdempotencyKeyUniqueViolation(err: unknown): boolean {

  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export interface IdempotentCreateResult {
  status: number;
  body: unknown;
}

export async function createIdempotentBooking(
  tenantId: string,
  createdById: string,
  key: string,
  requestHash: string,
  input: CreateBookingInput
): Promise<IdempotentCreateResult> {
  const existing = await withTenantContext(tenantId, (tx) =>
    tx.idempotencyKey.findUnique({ where: { tenantId_key: { tenantId, key } } })
  );

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyKeyConflictError();
    }
    return { status: existing.responseStatus, body: existing.responseBody };
  }

  try {
    return await withTenantContext(tenantId, async (tx) => {
      const booking = await tx.booking.create({
        data: {
          tenantId,
          createdById,
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
                },
      });

      const responseBody = JSON.parse(
        JSON.stringify({ success: true, data: booking })
      ) as Prisma.InputJsonValue;

      await tx.idempotencyKey.create({
        data: { tenantId, key, requestHash, responseStatus: 201, responseBody },
      });

      return { status: 201, body: responseBody };
    });
  } catch (err) {
    if (!isIdempotencyKeyUniqueViolation(err)) {
      throw err; 
    }
    const raced = await withTenantContext(tenantId, (tx) =>
      tx.idempotencyKey.findUnique({ where: { tenantId_key: { tenantId, key } } })
    );

    if (!raced) {
      throw new Error("Idempotency key conflict could not be resolved after retry.");
    }

    if (raced.requestHash !== requestHash) {
      throw new IdempotencyKeyConflictError();
    }

    return { status: raced.responseStatus, body: raced.responseBody };
  }
}