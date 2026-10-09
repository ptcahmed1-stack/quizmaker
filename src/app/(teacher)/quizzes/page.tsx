import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { loadDemoQuizzesAction } from "@/app/(teacher)/actions";
import { SubmitButton } from "@/components/client-bits";
import { QuizActionsMenu } from "@/components/teacher/quiz-actions";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { formatDate, formatPercent } from "@/lib/format";
import { listQuizzesForTeacher } from "@/lib/quizzes";
import { baseUrlFromHeaders } from "@/lib/utils";

export const metadata: Metadata = { title: "My Quizzes" };

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const teacher = await requireTeacher();
  const [{ status }, all, hdrs] = await Promise.all([searchParams, listQuizzesForTeacher(teacher.id), headers()]);
  const origin = baseUrlFromHeaders(hdrs);
  const filter = status === "draft" || status === "published" || status === "closed" ? status : "all";
  const quizzes = filter === "all" ? all : all.filter((q) => q.status === filter);

  const filters: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: all.length },
    { key: "published", label: "Published", count: all.filter((q) => q.status === "published").length },
    { key: "draft", label: "Drafts", count: all.filter((q) => q.status === "draft").length },
    { key: "closed", label: "Closed", count: all.filter((q) => q.status === "closed").length },
  ];

  return (
    <div>
      <PageHeader
        title="My Quizzes"
        description="Create, publish and manage all of your quizzes."
        actions={<LinkButton href="/quizzes/new">+ Create Quiz</LinkButton>}
      />

      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter quizzes by status">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/quizzes" : `/quizzes?status=${f.key}`}
              role="tab"
              aria-selected={filter === f.key}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset ${filter === f.key ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </Link>
          ))}
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          description="Create your first quiz and share it with your students."
          action={
            <>
              <LinkButton href="/quizzes/new">Create Quiz</LinkButton>
              <form action={loadDemoQuizzesAction}>
                <SubmitButton variant="outline" pendingText="Loading demo…">Load demo quizzes</SubmitButton>
              </form>
            </>
          }
        />
      ) : quizzes.length === 0 ? (
        <EmptyState title={`No ${filter} quizzes`} description="Try a different filter or create a new quiz." action={<LinkButton href="/quizzes/new">Create Quiz</LinkButton>} />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Quiz</th>
                <th scope="col" className="px-3 py-3">Questions</th>
                <th scope="col" className="px-3 py-3">Status</th>
                <th scope="col" className="px-3 py-3">Attempts</th>
                <th scope="col" className="px-3 py-3">Avg. score</th>
                <th scope="col" className="px-3 py-3">Created</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <Link href={`/quizzes/${quiz.id}/edit`} className="font-semibold text-slate-900 hover:text-indigo-600">{quiz.title}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{quiz.subject || "No subject"}</span>
                      {quiz.gradeLevel && <span>· {quiz.gradeLevel}</span>}
                      {quiz.isDemo && <Badge tone="indigo">Demo</Badge>}
                      {quiz.assignedByName && <Badge tone="blue">Assigned by {quiz.assignedByName}{quiz.locked ? " · locked" : ""}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">{quiz.questionCount}</td>
                  <td className="px-3 py-3.5"><StatusBadge status={quiz.status} /></td>
                  <td className="px-3 py-3.5 text-slate-700">{quiz.attempts}</td>
                  <td className="px-3 py-3.5 text-slate-700">{formatPercent(quiz.averagePercentage)}</td>
                  <td className="px-3 py-3.5 text-slate-500">{formatDate(quiz.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline" size="sm">Edit</LinkButton>
                      <LinkButton href={`/quizzes/${quiz.id}/results`} variant="outline" size="sm">Results</LinkButton>
                      {quiz.status === "published" && <LinkButton href={`/quizzes/${quiz.id}/share`} variant="secondary" size="sm">Share</LinkButton>}
                      <QuizActionsMenu quiz={{ id: quiz.id, title: quiz.title, status: quiz.status, publicCode: quiz.publicCode }} originFallback={origin} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/quizzes/${quiz.id}/edit`} className="block font-semibold text-slate-900">{quiz.title}</Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {quiz.subject || "No subject"} · {quiz.questionCount} Q · {quiz.attempts} attempts · Avg {formatPercent(quiz.averagePercentage)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={quiz.status} />
                      {quiz.isDemo && <Badge tone="indigo">Demo</Badge>}
                      {quiz.assignedByName && <Badge tone="blue">Assigned by {quiz.assignedByName}{quiz.locked ? " · locked" : ""}</Badge>}
                      <span className="text-xs text-slate-400">{formatDate(quiz.createdAt)}</span>
                    </div>
                  </div>
                  <QuizActionsMenu quiz={{ id: quiz.id, title: quiz.title, status: quiz.status, publicCode: quiz.publicCode }} originFallback={origin} />
                </div>
                <div className="mt-3 flex gap-2">
                  <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline" size="sm" className="flex-1">Edit</LinkButton>
                  <LinkButton href={`/quizzes/${quiz.id}/results`} variant="outline" size="sm" className="flex-1">Results</LinkButton>
                  {quiz.status === "published" && <LinkButton href={`/quizzes/${quiz.id}/share`} variant="secondary" size="sm" className="flex-1">Share</LinkButton>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
