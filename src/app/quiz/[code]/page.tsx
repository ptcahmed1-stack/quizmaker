import type { Metadata } from "next";
import Link from "next/link";
import { QuizRunner } from "@/components/student/quiz-runner";
import { getPublicQuiz } from "@/lib/student";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const quiz = await getPublicQuiz(code);
  return {
    title: quiz ? `${quiz.title} – Quiz` : "Quiz not found",
    description: quiz?.description || "Take this quiz online. No app or account needed.",
    robots: { index: false },
  };
}

export default async function StudentQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const quiz = await getPublicQuiz(code);

  if (!quiz) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6" /></svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Quiz not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            We could not find a quiz with the code <span className="font-mono font-semibold">{code.toUpperCase()}</span>. Check the link or code with your teacher.
          </p>
          <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-700">Enter a different code</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <QuizRunner quiz={quiz} mode="live" />
    </main>
  );
}
