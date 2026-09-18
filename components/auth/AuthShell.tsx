
import Link from "next/link";
import { CalendarIcon } from "./icons";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-indigo-600/40 blur-3xl animate-aurora" />
        <div className="absolute -bottom-40 -right-16 w-[36rem] h-[36rem] rounded-full bg-violet-600/30 blur-3xl animate-aurora [animation-delay:4s]" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl animate-aurora [animation-delay:8s]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="animate-float-slow flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40 mb-4">
            <CalendarIcon className="w-7 h-7 text-white" />
          </div>
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-white hover:text-indigo-300 transition-colors"
          >
            Multi-Tenant Booking
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>
          </div>

          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}