// components/bookings/BookingsBrowser.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchBookings, ApiClientError, type BookingDTO } from "@/lib/api/booking-client";
import BookingStatusBadge from "./BookingStatusBadge";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function groupByDay(bookings: BookingDTO[]): Map<string, BookingDTO[]> {
  const map = new Map<string, BookingDTO[]>();
  for (const b of bookings) {
    const key = new Date(b.startTime).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return map;
}

export default function BookingsBrowser() {
  const router = useRouter();
  const [mode, setMode] = useState<"week" | "all">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  // Bumped only by the Retry button (an event handler, not an effect).
  const [reloadToken, setReloadToken] = useState(0);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  useEffect(() => {
    // See BookingDetail.tsx for the full explanation of this pattern:
    // `ignore` prevents a stale (superseded or post-unmount) fetch
    // from overwriting newer state.
    let ignore = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result =
          mode === "week"
            ? await fetchBookings({
                startDate: weekStart.toISOString(),
                endDate: weekEnd.toISOString(),
                pageSize: 100,
              })
            : await fetchBookings({ pageSize: 100 });
        if (ignore) return;
        setBookings(result.bookings);
      } catch (err) {
        if (ignore) return;
        if (err instanceof ApiClientError) {
          setError(err);
          if (err.code === "UNAUTHENTICATED") router.push("/login");
        } else {
          setError(new ApiClientError("INTERNAL_ERROR", "Something went wrong. Please try again.", 0));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [mode, weekStart, weekEnd, router, reloadToken]);

  function handleRetry() {
    setReloadToken((t) => t + 1);
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const grouped = useMemo(() => (bookings ? groupByDay(bookings) : new Map<string, BookingDTO[]>()), [bookings]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm">
          <button
            onClick={() => setMode("week")}
            className={`px-3 py-1.5 ${mode === "week" ? "bg-indigo-500 text-white" : "bg-white/4 text-slate-300"}`}
          >
            This Week
          </button>
          <button
            onClick={() => setMode("all")}
            className={`px-3 py-1.5 ${mode === "all" ? "bg-indigo-500 text-white" : "bg-white/4 text-slate-300"}`}
          >
            All Bookings
          </button>
        </div>

        {mode === "week" && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <button
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/6"
              aria-label="Previous week"
            >
              ←
            </button>
            <span>
              {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
              {addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            <button
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/6"
              aria-label="Next week"
            >
              →
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/6"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {mode === "week" && (
        <div className="grid grid-cols-7 gap-2 mb-6">
          {days.map((d) => {
            const count = grouped.get(d.toDateString())?.length ?? 0;
            return (
              <div key={d.toISOString()} className="rounded-lg border border-white/10 bg-white/4 p-2 text-center">
                <div className="text-xs text-slate-400">{formatDayLabel(d)}</div>
                <div className="text-sm text-white mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {loading && <div className="text-center py-12 text-slate-400 text-sm">Loading bookings…</div>}

      {!loading && error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
          <span>{error.message}</span>
          <button onClick={handleRetry} className="shrink-0 rounded-md border border-rose-300/40 px-3 py-1 hover:bg-rose-400/10">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && bookings && bookings.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No bookings {mode === "week" ? "this week" : "found"}.
        </div>
      )}

      {!loading && !error && bookings && bookings.length > 0 && (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dayKey, dayBookings]) => (
            <div key={dayKey}>
              <h2 className="text-sm font-medium text-slate-400 mb-2">
                {new Date(dayKey).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <div className="space-y-2">
                {dayBookings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/dashboard/bookings/${b.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 px-4 py-3 transition-colors"
                  >
                    <div>
                      <div className="text-white text-sm font-medium">{b.title}</div>
                      <div className="text-xs text-slate-400">
                        {formatTime(b.startTime)} – {formatTime(b.endTime)}
                      </div>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}