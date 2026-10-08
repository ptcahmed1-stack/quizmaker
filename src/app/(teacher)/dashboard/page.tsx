import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { loadDemoQuizzesAction, publishFromFormAction } from "@/app/(teacher)/actions";
import { SubmitButton } from "@/components/client-bits";
import { QuizActionsMenu } from "@/components/teacher/quiz-actions";
import { Card, EmptyState, LinkButton, StatCard, StatusBadge } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { formatPercent } from "@/lib/format";
import { getDashboardStats, listQuizzesForTeacher } from "@/lib/quizzes";
import { baseUrlFromHeaders } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const teacher = await requireTeacher();
  const [stats, quizzes, hdrs] = await Promise.all([
    getDashboardStats(teacher.id),
    listQuizzesForTeacher(teacher.id),
    headers(),
  ]);
  const origin = baseUrlFromHeaders(hdrs);
  const recent = quizzes.slice(0, 5);
  const firstName = teacher.name.split(" ")[0];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">Here is what is happening with your quizzes.</p>
        </div>
        <LinkButton href="/quizzes/new" size="lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          Create New Quiz
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total quizzes" value={stats.totalQuizzes} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Drafts" value={stats.drafts} hint={stats.closed ? `${stats.closed} closed` : undefined} />
        <StatCard label="Student attempts" value={stats.totalAttempts} />
        <StatCard label="Average score" value={formatPercent(stats.averagePercentage)} hint="Across all submissions" />
      </div>

      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold text-slate-900">Recent quizzes</h2>
          {quizzes.length > 0 && (
            <Link href="/quizzes" className="text-sm font-medium text-indigo-600 hover:underline">View all quizzes</Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No quizzes yet"
            description="Create your first quiz and share it with your students. You can also load a few demo quizzes to explore the app."
            action={
              <>
                <LinkButton href="/quizzes/new">Create Quiz</LinkButton>
                <form action={loadDemoQuizzesAction}>
                  <SubmitButton variant="outline" pendingText="Loading demo…">Load demo quizzes</SubmitButton>
                </form>
              </>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recent.map((quiz) => (
              <Card key={quiz.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/quizzes/${quiz.id}/edit`} className="block truncate text-base font-semibold text-slate-900 hover:text-indigo-600">
                      {quiz.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {quiz.subject || "No subject"} · {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
                    </p>
                  </div>
                  <StatusBadge status={quiz.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Attempts</dt>
                    <dd className="text-lg font-semibold text-slate-900">{quiz.attempts}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Average</dt>
                    <dd className="text-lg font-semibold text-slate-900">{formatPercent(quiz.averagePercentage)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  {quiz.status === "published" ? (
                    <>
                      <LinkButton href={`/quizzes/${quiz.id}/results`} variant="secondary" size="sm">Results</LinkButton>
                      <LinkButton href={`/quizzes/${quiz.id}/share`} variant="outline" size="sm">Share</LinkButton>
                    </>
                  ) : quiz.status === "draft" ? (
                    <>
                      <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="secondary" size="sm">Edit</LinkButton>
                      <form action={publishFromFormAction}>
                        <input type="hidden" name="quizId" value={quiz.id} />
                        <SubmitButton variant="success" size="sm" pendingText="Publishing…">Publish</SubmitButton>
                      </form>
                    </>
                  ) : (
                    <>
                      <LinkButton href={`/quizzes/${quiz.id}/results`} variant="secondary" size="sm">Results</LinkButton>
                      <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline" size="sm">Edit</LinkButton>
                    </>
                  )}
                  <div className="ml-auto">
                    <QuizActionsMenu quiz={{ id: quiz.id, title: quiz.title, status: quiz.status, publicCode: quiz.publicCode }} originFallback={origin} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
