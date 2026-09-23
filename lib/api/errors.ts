

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "../auth/current-user";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

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

  if (err instanceof UnauthenticatedError) {
    return apiError("UNAUTHENTICATED", "You must be logged in to do that.", 401);
  }

  console.error("Unhandled API error:", err);
  return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}