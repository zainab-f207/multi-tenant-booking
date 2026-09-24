
import { z } from "zod";

const bookingStatusEnum = z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]);

const isoDate = z.coerce.date({ message: "Must be a valid date/time" });

export const createBookingSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    description: z.string().trim().max(2000, "Description is too long").optional(),
    startTime: isoDate,
    endTime: isoDate,

  })
  .strict()
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: "endTime must be later than startTime",
    path: ["endTime"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
    description: z.string().trim().max(2000, "Description is too long").optional(),
    startTime: isoDate.optional(),
    endTime: isoDate.optional(),
    status: bookingStatusEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime.getTime() > data.startTime.getTime();
      }
      return true; 
    },
    { message: "endTime must be later than startTime", path: ["endTime"] }
  );

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const bookingIdSchema = z.string().uuid("Invalid booking id.");


export const listBookingsQuerySchema = z
  .object({
    status: bookingStatusEnum.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.getTime() >= data.startDate.getTime();
      }
      return true;
    },
    { message: "endDate must not be before startDate", path: ["endDate"] }
  );

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;