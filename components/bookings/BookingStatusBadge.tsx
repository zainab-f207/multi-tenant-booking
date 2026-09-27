
import type { BookingDTO } from "@/lib/api/booking-client";

const STYLES: Record<BookingDTO["status"], string> = {
  PENDING: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  CONFIRMED: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  CANCELLED: "bg-rose-400/10 text-rose-300 border-rose-400/30",
  COMPLETED: "bg-slate-400/10 text-slate-300 border-slate-400/30",
};

export default function BookingStatusBadge({ status }: { status: BookingDTO["status"] }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}