
import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import LogoutButton from "@/components/auth/LogoutButton";
import { CalendarIcon } from "@/components/auth/icons";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950">
        <header className="border-b border-white/10 bg-white/3 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              Multi-Tenant Booking
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard/bookings" className="text-slate-300 hover:text-white">
                Bookings
              </Link>
              <div className="w-24">
                <LogoutButton />
              </div>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}