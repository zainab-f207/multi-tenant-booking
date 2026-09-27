
export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}
interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

async function parseResponse<T>(res: Response): Promise<T> {
  let body: ApiSuccessBody<T> | ApiErrorBody;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "The server returned an unexpected response.",
      res.status
    );
  }
  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message, res.status, body.error.details);
  }
  return body.data;
}

export interface BookingDTO {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface ListBookingsResult {
  bookings: BookingDTO[];
  pagination: { page: number; pageSize: number; total: number };
}

export async function fetchBookings(
  params: { status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
): Promise<ListBookingsResult> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/bookings?${search.toString()}`, { method: "GET" });
  return parseResponse<ListBookingsResult>(res);
}

export async function fetchBooking(id: string): Promise<BookingDTO> {
  const res = await fetch(`/api/bookings/${id}`, { method: "GET" });
  return parseResponse<BookingDTO>(res);
}

export interface CreateBookingPayload {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export async function createBooking(
  payload: CreateBookingPayload,
  idempotencyKey: string
): Promise<BookingDTO> {
  const res = await fetch(`/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  return parseResponse<BookingDTO>(res);
}

export interface UpdateBookingPayload {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  status?: BookingDTO["status"];
}

export async function updateBooking(id: string, payload: UpdateBookingPayload): Promise<BookingDTO> {
  const res = await fetch(`/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<BookingDTO>(res);
}

export async function deleteBooking(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
  return parseResponse<{ id: string; deleted: boolean }>(res);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}