"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">An unexpected error occurred. Your quiz answers and data are safe. Please try again.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700">Try again</button>
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50">Go home</Link>
        </div>
      </div>
    </main>
  );
}
