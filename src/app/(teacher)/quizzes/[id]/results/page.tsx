import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleResultsReleasedAction } from "@/app/(teacher)/actions";
import { PrintButton, SubmitButton } from "@/components/client-bits";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { cn, formatDateTime, formatDuration, formatPercent, questionTypeLabel } from "@/lib/format";
import { getQuizResults } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Quiz results" };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const data = await getQuizResults(id, teacher.id);
  if (!data) notFound();
  const { quiz, submissions, stats, analytics } = data;

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {quiz.title} <StatusBadge status={quiz.status} />
          </span>
        }
        description={`Results · ${quiz.questions.length} questions · ${stats.totalMarks} marks · pass mark ${quiz.passingPercentage}%`}
        actions={
          <>
            <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline">Edit</LinkButton>
            {quiz.status === "published" && <LinkButton href={`/quizzes/${quiz.id}/share`} variant="outline">Share</LinkButton>}
            <a href={`/api/quizzes/${quiz.id}/export`} className={cn(buttonClass("secondary"), "print:hidden")} download>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              Export CSV
            </a>
            <PrintButton label="Print results" />
          </>
        }
      />

      <div className="mb-6 print:hidden">
        {quiz.settings.resultsReleased ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Results are visible to students</span>
              {quiz.settings.showScoreImmediately ? " immediately after they submit." : ", but scores are hidden by the “show score immediately” setting."}
            </p>
            <form action={toggleResultsReleasedAction}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="released" value="false" />
              <SubmitButton variant="outline" size="sm" pendingText="Updating…">Hide results from students</SubmitButton>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Results are hidden.</span> Students only see a submission confirmation until you release them.
            </p>
            <form action={toggleResultsReleasedAction}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="released" value="true" />
              <SubmitButton variant="success" size="sm" pendingText="Releasing…">Release results to students</SubmitButton>
            </form>
          </div>
        )}
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="No student submissions yet."
          description="Share your quiz link with your students to start collecting results."
          action={quiz.status === "published" ? <LinkButton href={`/quizzes/${quiz.id}/share`}>Share quiz link</LinkButton> : <LinkButton href={`/quizzes/${quiz.id}/share`}>Publish quiz</LinkButton>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Stat label="Attempts" value={stats.attempts} />
            <Stat label="Average score" value={stats.averageScore !== null ? `${stats.averageScore.toFixed(1)} / ${stats.totalMarks}` : "—"} />
            <Stat label="Average %" value={formatPercent(stats.averagePercentage)} />
            <Stat label="Highest" value={stats.highestScore !== null ? `${stats.highestScore} (${formatPercent(stats.highestPercentage)})` : "—"} />
            <Stat label="Lowest" value={stats.lowestScore !== null ? `${stats.lowestScore} (${formatPercent(stats.lowestPercentage)})` : "—"} />
            <Stat label="Pass rate" value={formatPercent(stats.passRate)} hint={`${stats.passCount} of ${stats.attempts} passed`} />
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Student submissions</h2>
              <span className="text-sm text-slate-500">{submissions.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Student</th>
                    <th scope="col" className="px-3 py-3">Score</th>
                    <th scope="col" className="px-3 py-3">Percentage</th>
                    <th scope="col" className="px-3 py-3">Time</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Submitted</th>
                    <th scope="col" className="px-5 py-3 print:hidden"><span className="sr-only">View</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/quizzes/${quiz.id}/results/${s.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                          {s.studentName || <span className="italic text-slate-500">Anonymous</span>}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {s.studentIdentifier ? `ID: ${s.studentIdentifier}` : ""}
                          {s.attemptNumber > 1 ? `${s.studentIdentifier ? " · " : ""}Attempt ${s.attemptNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">{s.score} / {s.totalMarks}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                            <div className={cn("h-full", s.passed ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${Math.min(100, s.percentage)}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-700">{formatPercent(s.percentage)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDuration(s.timeTakenSeconds)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={s.passed ? "green" : "rose"}>{s.passed ? "✓ Passed" : "✗ Failed"}</Badge>
                          {s.isLate && <Badge tone="amber">Late</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDateTime(s.submittedAt)}</td>
                      <td className="px-5 py-3 text-right print:hidden">
                        <Link href={`/quizzes/${quiz.id}/results/${s.id}`} className="text-sm font-medium text-indigo-600 hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <section className="mt-8" aria-labelledby="analytics-heading">
            <h2 id="analytics-heading" className="text-lg font-semibold text-slate-900">Question analytics</h2>
            <p className="mt-0.5 text-sm text-slate-500">Spot the questions your students found most difficult.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {analytics.map((a) => {
                const rate = a.correctRate ?? 0;
                const tone = rate >= 70 ? "emerald" : rate >= 40 ? "amber" : "rose";
                return (
                  <Card key={a.questionId} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {a.position} · {questionTypeLabel(a.type)} · {a.marks} {a.marks === 1 ? "mark" : "marks"}</p>
                        <p className="mt-1 font-semibold text-slate-900">{a.text}</p>
                      </div>
                      <div className={cn("shrink-0 rounded-xl px-3 py-2 text-center", tone === "emerald" ? "bg-emerald-50 text-emerald-800" : tone === "amber" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800")}>
                        <p className="text-xl font-bold leading-none">{formatPercent(a.correctRate)}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase">correct</p>
                      </div>
                    </div>
                    <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
                      <div className="bg-emerald-500" style={{ width: `${(a.correct / Math.max(1, stats.attempts)) * 100}%` }} />
                      <div className="bg-rose-400" style={{ width: `${(a.incorrect / Math.max(1, stats.attempts)) * 100}%` }} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div><dt className="text-xs text-slate-500">Correct</dt><dd className="font-semibold text-emerald-700">{a.correct} students</dd></div>
                      <div><dt className="text-xs text-slate-500">Incorrect</dt><dd className="font-semibold text-rose-700">{a.incorrect} students</dd></div>
                      <div><dt className="text-xs text-slate-500">Unanswered</dt><dd className="font-semibold text-slate-700">{a.unanswered}</dd></div>
                    </dl>
                    <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">Correct answer</dt><dd className="font-medium text-slate-900">{a.correctAnswer || "—"}</dd></div>
                      <div className="flex gap-2">
                        <dt className="w-40 shrink-0 text-slate-500">Most common wrong answer</dt>
                        <dd className="font-medium text-slate-900">{a.mostSelectedIncorrect ? `${a.mostSelectedIncorrect.text} (${a.mostSelectedIncorrect.count})` : "—"}</dd>
                      </div>
                    </dl>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}

      {quiz.questions.length === 0 && (
        <div className="mt-6"><Alert tone="warning">This quiz has no questions yet.</Alert></div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
