"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchBooking, deleteBooking, ApiClientError, type BookingDTO } from "@/lib/api/booking-client";
import { useToast } from "@/components/ui/Toast";
import BookingStatusBadge from "./BookingStatusBadge";
import ConfirmDialog from "./ConfirmDialog";

export default function BookingDetail({ bookingId, canManage }: { bookingId: string; canManage: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Bumped only by the Retry button (an event handler, not an effect).
  // The effect below depends on it purely to re-run the fetch on demand.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // `ignore` guards every setState call below so that a slow,
    // now-outdated fetch (from a previous bookingId, or before an
    // unmount) can never overwrite newer state. The cleanup function
    // flips this to true before the effect's next run or on unmount.
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

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteBooking(bookingId);
      showToast("success", "Booking deleted.");
      router.push("/dashboard/bookings");
    } catch (err) {
      setConfirmingDelete(false);
      if (err instanceof ApiClientError) {
        showToast("error", err.message);
      } else {
        showToast("error", "Could not delete the booking. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
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
    <div className="max-w-lg">
      <Link href="/dashboard/bookings" className="text-sm text-indigo-300 hover:text-indigo-200">
        ← Back to bookings
      </Link>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.07] p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">{booking.title}</h1>
          <BookingStatusBadge status={booking.status} />
        </div>

        {booking.description && (
          <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{booking.description}</p>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Start</dt>
            <dd className="text-white">{new Date(booking.startTime).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">End</dt>
            <dd className="text-white">{new Date(booking.endTime).toLocaleString()}</dd>
          </div>
        </dl>

        {canManage && (
          <div className="mt-6 flex gap-3">
            <Link
              href={`/dashboard/bookings/${booking.id}/edit`}
              className="flex-1 text-center rounded-lg border border-white/15 hover:bg-white/6 text-white text-sm font-medium py-2.5 px-4 transition-all"
            >
              Edit
            </Link>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex-1 rounded-lg border border-rose-400/40 hover:bg-rose-400/10 text-rose-200 text-sm font-medium py-2.5 px-4 transition-all"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this booking?"
          message="This cannot be undone."
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
          disabled={deleting}
        />
      )}
    </div>
  );
}