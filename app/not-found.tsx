import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md">
        <p className="mb-3 text-sm font-semibold text-indigo-400">404</p>
        <h1 className="mb-3 text-3xl font-semibold">Page not found</h1>
        <p className="mb-6 text-slate-300">
          The page may have moved, or the address may be incorrect.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}