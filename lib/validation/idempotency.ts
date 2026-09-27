import { z } from "zod";

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1, "Idempotency-Key header must not be empty.")
  .max(255, "Idempotency-Key header must be 255 characters or fewer.");