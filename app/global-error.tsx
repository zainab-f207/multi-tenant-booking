"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <main className="max-w-md">
          <h1 className="mb-3 text-3xl font-semibold">Application error</h1>
          <p className="mb-6 text-slate-300">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}