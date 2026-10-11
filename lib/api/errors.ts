

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "../auth/current-user";
import { ForbiddenError } from "../rbac";
import { Prisma } from "../../generated/prisma/client";
import { BillingConfigurationError } from "../billing/errors";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "BILLING_UNAVAILABLE"
  | "VERSION_CONFLICT"
  | "INTERNAL_ERROR";

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ApiValidationError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ApiValidationError";
    this.details = details;
  }
}

export class IdempotencyKeyConflictError extends Error {
  constructor(
    message = "This Idempotency-Key was already used with a different request."
  ) {
    super(message);
    this.name = "IdempotencyKeyConflictError";
  }
}

export class VersionConflictError extends Error {
  constructor(
    public expectedVersion: number,
    public currentVersion: number
  ) {
    super("This note has changed. Reload the latest version before saving.");
    this.name = "VersionConflictError";
  }
}

export function isPrismaNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Request data failed validation.", 400, err.flatten());
  }

  if (err instanceof ApiValidationError) {
    return apiError("VALIDATION_ERROR", err.message, 400, err.details);
  }

  if (err instanceof UnauthenticatedError) {
    return apiError("UNAUTHENTICATED", "You must be logged in to do that.", 401);
  }

  if (err instanceof ForbiddenError) {
    return apiError("FORBIDDEN", "You do not have permission to do that.", 403);
  }

  if (err instanceof NotFoundError) {
    return apiError("NOT_FOUND", err.message, 404);
  }

  if (err instanceof IdempotencyKeyConflictError) {
    return apiError("IDEMPOTENCY_KEY_CONFLICT", err.message, 409);
  }

  if (err instanceof VersionConflictError) {
    return apiError("VERSION_CONFLICT", err.message, 409, {
      expectedVersion: err.expectedVersion,
      currentVersion: err.currentVersion,
    });
  }

  if (err instanceof BillingConfigurationError) {
    return apiError("BILLING_UNAVAILABLE", err.message, 503);
  }

  console.error("Unhandled API error:", err);
  return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}