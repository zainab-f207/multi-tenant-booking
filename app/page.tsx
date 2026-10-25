import Link from "next/link";
import { CalendarIcon } from "@/components/auth/icons";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70";

const features = [
  {
    title: "Bookings your team can manage",
    body: "Create, edit and track bookings through Pending, Confirmed, Completed and Cancelled, in a list or a weekly view.",
  },
  {
    title: "Shared booking notes",
    body: "Colleagues see who is viewing a booking and who is typing. Conflicting edits to a note are detected instead of silently overwritten.",
  },
  {
    title: "Roles that match the work",
    body: "Admins run the organization and billing, managers handle bookings and can view billing, and staff create and view bookings.",
  },
  {
    title: "Organization settings",
    body: "Set your organization's time zone and default booking length.",
  },
  {
    title: "Subscription billing with Stripe",
    body: "Plans are purchased through Stripe Checkout. Subscription status and invoice history are kept up to date from Stripe's webhook events.",
  },
];

const securityPoints = [
  {
    title: "Your organization comes from your session",
    body: "The server works out which organization you belong to from your signed-in session. The browser never chooses it.",
  },
  {
    title: "Isolation is enforced in the database",
    body: "Tenant data is protected by PostgreSQL row-level security, which restricts access to tenant-owned data according to the active tenant context.",
  },
  {
    title: "A restricted database role",
    body: "The application connects as a limited database role that cannot bypass those policies. Permissions are checked on the server as well as in the interface.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="animate-aurora absolute -left-24 -top-32 h-[32rem] w-[32rem] rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="animate-aurora absolute -right-16 top-[40rem] h-[36rem] w-[36rem] rounded-full bg-violet-600/30 blur-3xl [animation-delay:4s]" />
      </div>

      <div className="relative">
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className={`flex items-center gap-2 rounded-lg font-semibold text-white ${focusRing}`}>
            <CalendarIcon className="h-5 w-5 text-indigo-400" />
            Multi-Tenant Booking
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <a href="#features" className={`hidden rounded-lg px-3 py-2 text-slate-300 hover:text-white sm:inline ${focusRing}`}>
              Features
            </a>
            <a href="#security" className={`hidden rounded-lg px-3 py-2 text-slate-300 hover:text-white sm:inline ${focusRing}`}>
              Security
            </a>
            <Link href="/login" className={`rounded-lg px-3 py-2 font-medium text-white hover:bg-white/5 ${focusRing}`}>
              Login
            </Link>
          </nav>
        </header>

        <main>
          <section aria-labelledby="hero-heading" className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pb-24 sm:pt-20">
            <div className="animate-fade-in-up max-w-2xl">
              <h1 id="hero-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Booking for teams, with every organization kept separate
              </h1>
              <p className="mt-5 text-base text-slate-300 sm:text-lg">
                Each organization gets its own workspace to schedule, review and discuss bookings. Other
                organizations cannot see your data.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/onboarding"
                  className={`inline-flex items-center justify-center rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-400 hover:to-violet-500 ${focusRing}`}
                >
                  Create an organization
                </Link>
                <Link
                  href="/login"
                  className={`inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.06] ${focusRing}`}
                >
                  Login
                </Link>
              </div>
            </div>
          </section>

          <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-5xl scroll-mt-4 px-4 pb-16 sm:pb-24">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight text-white">
              What you can do
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id="security" aria-labelledby="security-heading" className="mx-auto max-w-5xl scroll-mt-4 px-4 pb-16 sm:pb-24">
            <h2 id="security-heading" className="text-2xl font-semibold tracking-tight text-white">
              How organizations stay separate
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Separation is enforced where the data lives, not only in the interface.
            </p>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {securityPoints.map((p) => (
                <li key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <h3 className="text-base font-semibold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{p.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Multi-Tenant Booking</p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/login" className={`rounded hover:text-white ${focusRing}`}>Login</Link>
              <Link href="/register" className={`rounded hover:text-white ${focusRing}`}>Join an organization</Link>
              <Link href="/onboarding" className={`rounded hover:text-white ${focusRing}`}>Create an organization</Link>
              <a href="#features" className={`rounded hover:text-white ${focusRing}`}>Features</a>
              <a href="#security" className={`rounded hover:text-white ${focusRing}`}>Security</a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
