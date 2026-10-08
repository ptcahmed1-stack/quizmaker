import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { getCurrentTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const teacher = await getCurrentTeacher();
  if (teacher) redirect("/dashboard");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link href="/" className="mb-8" aria-label="QuizMaker home">
        <Logo className="text-xl" />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-slate-500">Teacher accounts only. Students never need to log in.</p>
    </main>
  );
}
