// components/bookings/BookingForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBookingSchema, updateBookingSchema } from "@/lib/validation/bookings";
import {
  createBooking,
  updateBooking,
  newIdempotencyKey,
  ApiClientError,
  type BookingDTO,
} from "@/lib/api/booking-client";
import { useToast } from "@/components/ui/Toast";

type Mode = "create" | "edit";

interface BookingFormProps {
  mode: Mode;
  bookingId?: string;
  initial?: Partial<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    status: BookingDTO["status"];
  }>;
}

function toDateTimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FieldErrors = Partial<Record<"title" | "description" | "startTime" | "endTime" | "status", string>>;

export default function BookingForm({ mode, bookingId, initial }: BookingFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startTime, setStartTime] = useState(toDateTimeLocal(initial?.startTime));
  const [endTime, setEndTime] = useState(toDateTimeLocal(initial?.endTime));
  const [status, setStatus] = useState<BookingDTO["status"]>(initial?.status ?? "PENDING");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
    
  const [lastAttempt, setLastAttempt] = useState<{ key: string; payloadJson: string } | null>(null);

  function getIdempotencyKeyFor(payloadJson: string): string {
    if (lastAttempt && lastAttempt.payloadJson === payloadJson) {
      return lastAttempt.key;
    }
    const key = newIdempotencyKey();
    setLastAttempt({ key, payloadJson });
    return key;
  }

  function handleApiClientError(err: unknown) {
    if (err instanceof ApiClientError) {
      if (err.code === "UNAUTHENTICATED") {
        router.push("/login");
        return;
      }
      setApiErrorMessage(err.message);
    } else {
      setApiErrorMessage("Something went wrong. Please try again.");
    }
  }

  async function performSubmit() {
    setApiErrorMessage(null);
    setFieldErrors({});

    const rawDescription = description.trim() === "" ? undefined : description;

    if (mode === "create") {
      const result = createBookingSchema.safeParse({
        title,
        description: rawDescription,
        startTime,
        endTime,
      });
      if (!result.success) {
        const errors: FieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof FieldErrors;
          if (key && !errors[key]) errors[key] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      const payloadForCompare = JSON.stringify({ title, description: rawDescription, startTime, endTime });
      const idempotencyKey = getIdempotencyKeyFor(payloadForCompare);

      setLoading(true);
      try {
        const booking = await createBooking(
          {
            title: result.data.title,
            description: result.data.description,
            startTime: result.data.startTime.toISOString(),
            endTime: result.data.endTime.toISOString(),
          },
          idempotencyKey
        );
        showToast("success", "Booking created.");
        router.push(`/dashboard/bookings/${booking.id}`);
      } catch (err) {
        handleApiClientError(err);
      } finally {
        setLoading(false);
      }
    } else {
      if (!bookingId) return;

      const result = updateBookingSchema.safeParse({
        title,
        description: rawDescription,
        startTime,
        endTime,
        status,
      });
      if (!result.success) {
        const errors: FieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof FieldErrors;
          if (key && !errors[key]) errors[key] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      setLoading(true);
      try {
        const booking = await updateBooking(bookingId, {
          title: result.data.title,
          description: result.data.description,
          startTime: result.data.startTime?.toISOString(),
          endTime: result.data.endTime?.toISOString(),
          status: result.data.status,
        });
        showToast("success", "Booking updated.");
        router.push(`/dashboard/bookings/${booking.id}`);
      } catch (err) {
        handleApiClientError(err);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void performSubmit();
  }

  const inputClass =
    "w-full rounded-lg bg-white/[0.06] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60 transition-colors duration-150";
  const errorInputClass = "border-rose-400/70 animate-shake";
  const labelClass = "block text-sm font-medium text-slate-200 mb-1.5";

  return (
    <form onSubmit={handleFormSubmit} noValidate className="space-y-5 max-w-lg">
      {apiErrorMessage && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
          <span>{apiErrorMessage}</span>
          <button
            type="button"
            onClick={() => void performSubmit()}
            className="shrink-0 rounded-md border border-rose-300/40 px-3 py-1 hover:bg-rose-400/10"
          >
            Retry
          </button>
        </div>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} ${fieldErrors.title ? errorInputClass : ""}`}
          placeholder="Client onboarding call"
        />
        {fieldErrors.title && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.title}</p>}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} ${fieldErrors.description ? errorInputClass : ""}`}
          placeholder="Additional details…"
        />
        {fieldErrors.description && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.description}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startTime" className={labelClass}>
            Start time
          </label>
          <input
            id="startTime"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={`${inputClass} ${fieldErrors.startTime ? errorInputClass : ""}`}
          />
          {fieldErrors.startTime && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.startTime}</p>}
        </div>
        <div>
          <label htmlFor="endTime" className={labelClass}>
            End time
          </label>
          <input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`${inputClass} ${fieldErrors.endTime ? errorInputClass : ""}`}
          />
          {fieldErrors.endTime && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.endTime}</p>}
        </div>
      </div>

      {mode === "edit" && (
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingDTO["status"])}
            className={inputClass}
          >
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 shadow-lg shadow-indigo-900/30 transition-all"
      >
        {loading ? "Saving…" : mode === "create" ? "Create Booking" : "Save Changes"}
      </button>
    </form>
  );
}