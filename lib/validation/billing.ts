import { z } from "zod";
import { PLAN_KEYS } from "../billing/plans";

export const checkoutRequestSchema = z
  .object({
    planKey: z.enum(PLAN_KEYS),
  })
  .strict();

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;