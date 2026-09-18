import Link from "next/link";
import { CalendarIcon } from "@/components/auth/icons";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-indigo-600/40 blur-3xl animate-aurora" />
        <div className="absolute -bottom-40 -right-16 w-[36rem] h-[36rem] rounded-full bg-violet-600/30 blur-3xl animate-aurora [animation-delay:4s]" />
      </div>

      <div className="relative text-center max-w-lg animate-fade-in-up">
        <div className="animate-float-slow inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40 mb-6">
          <CalendarIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3">
          Multi-Tenant Booking
        </h1>
        <p className="text-slate-300 mb-8">
          A booking platform built for teams. Every organization gets its own
          isolated, secure workspace.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-medium py-2.5 px-6 shadow-lg shadow-indigo-900/30 transition-all"
          >
            Login
          </Link>
          <Link
            href="/onboarding"
            className="w-full sm:w-auto rounded-lg border border-white/15 hover:bg-white/[0.06] text-white text-sm font-medium py-2.5 px-6 transition-all"
          >
            Create an organization
          </Link>
        </div>
      </div>
    </div>
  );
}