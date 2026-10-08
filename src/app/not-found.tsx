import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <Logo className="mb-6 text-xl" />
      <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-slate-600">The page you are looking for does not exist or you do not have access to it.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700">Go home</Link>
        <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50">Teacher dashboard</Link>
      </div>
    </main>
  );
}
