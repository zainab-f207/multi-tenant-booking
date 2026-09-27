"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchBooking, ApiClientError, type BookingDTO } from "@/lib/api/booking-client";
import BookingForm from "./BookingForm";

export default function EditBookingForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  // Bumped only by the Retry button (an event handler, not an effect).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // See BookingDetail.tsx for the full explanation of this pattern:
    // `ignore` prevents a stale (superseded or post-unmount) fetch
    // from overwriting newer state.
    let ignore = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchBooking(bookingId);
        if (ignore) return;
        setBooking(result);
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiClientError) {
          setError(err);
          if (err.code === "UNAUTHENTICATED") router.push("/login");
        } else {
          setError(new ApiClientError("INTERNAL_ERROR", "Something went wrong.", 0));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [bookingId, router, reloadToken]);

  function handleRetry() {
    setReloadToken((t) => t + 1);
  }

  if (loading) return <div className="text-center py-12 text-slate-400 text-sm">Loading booking…</div>;

  if (error) {
    return (
      <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
        <span>{error.code === "NOT_FOUND" ? "Booking not found." : error.message}</span>
        {error.code !== "NOT_FOUND" && (
          <button onClick={handleRetry} className="shrink-0 rounded-md border border-rose-300/40 px-3 py-1 hover:bg-rose-400/10">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!booking) return null;

  return (
    <BookingForm
      mode="edit"
      bookingId={booking.id}
      initial={{
        title: booking.title,
        description: booking.description ?? "",
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      }}
    />
  );
}