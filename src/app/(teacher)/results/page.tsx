import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { formatDateTime, formatPercent } from "@/lib/format";
import { listQuizzesForTeacher } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsOverviewPage() {
  const teacher = await requireTeacher();
  const quizzes = (await listQuizzesForTeacher(teacher.id)).sort((a, b) => b.attempts - a.attempts);
  const totalAttempts = quizzes.reduce((s, q) => s + q.attempts, 0);

  return (
    <div>
      <PageHeader title="Results" description={`${totalAttempts} student ${totalAttempts === 1 ? "attempt" : "attempts"} across ${quizzes.length} ${quizzes.length === 1 ? "quiz" : "quizzes"}.`} />
      {quizzes.length === 0 ? (
        <EmptyState title="No results yet" description="Create and publish a quiz, then share the link with your students to start collecting results." action={<LinkButton href="/quizzes/new">Create Quiz</LinkButton>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Quiz</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Attempts</th>
                  <th scope="col" className="px-3 py-3">Average</th>
                  <th scope="col" className="px-3 py-3">Last submission</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quizzes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/quizzes/${q.id}/results`} className="font-semibold text-slate-900 hover:text-indigo-600">{q.title}</Link>
                      <div className="text-xs text-slate-500">{q.subject || "No subject"} · {q.questionCount} questions</div>
                    </td>
                    <td className="px-3 py-3.5"><StatusBadge status={q.status} /></td>
                    <td className="px-3 py-3.5 font-medium text-slate-900">{q.attempts}</td>
                    <td className="px-3 py-3.5 text-slate-700">{formatPercent(q.averagePercentage)}</td>
                    <td className="px-3 py-3.5 text-slate-500">{formatDateTime(q.lastSubmissionAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/quizzes/${q.id}/results`} variant="secondary" size="sm">View results</LinkButton>
                        {q.attempts > 0 && <a href={`/api/quizzes/${q.id}/export`} download className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">CSV</a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
