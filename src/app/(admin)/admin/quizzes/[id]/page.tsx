import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDeleteQuizAction, adminDeleteSubmissionAction, adminSetQuizStatusAction } from "@/app/(admin)/actions";
import { AssignQuizForm } from "@/components/admin/forms";
import { AccountStatusBadge, FlashMessages, MiniStat, SectionCard } from "@/components/admin/widgets";
import { ConfirmForm, CopyButton, SubmitButton } from "@/components/client-bits";
import { Badge, Card, LinkButton, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { listAssignableTeachers, listCopies } from "@/lib/assignments";
import { requireAdmin } from "@/lib/auth";
import { cn, formatDateTime, formatDuration, formatPercent, questionTypeLabel } from "@/lib/format";
import { getQuizResultsAdmin } from "@/lib/quizzes";
import { correctAnswerText } from "@/lib/scoring";
import { baseUrlFromHeaders } from "@/lib/utils";
import { db } from "@/db";
import { quizzes, teachers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Quiz · Admin" };

export default async function AdminQuizDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp, hdrs] = await Promise.all([params, searchParams, headers()]);
  const data = await getQuizResultsAdmin(id);
  if (!data) notFound();
  const { quiz, submissions, stats, analytics } = data;
  const [owner] = await db.select({ id: teachers.id, name: teachers.name, email: teachers.email, status: teachers.status }).from(teachers).where(eq(teachers.id, quiz.teacherId)).limit(1);
  const [copies, assignable, sourceRows] = await Promise.all([
    listCopies(quiz.id),
    listAssignableTeachers(quiz.teacherId),
    quiz.sourceQuizId ? db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(eq(quizzes.id, quiz.sourceQuizId)).limit(1) : Promise.resolve([]),
  ]);
  const sourceQuiz = sourceRows[0] ?? null;
  const assignedIds = new Set(copies.map((c) => c.teacherId));
  const copyAttempts = copies.reduce((sum, c) => sum + c.attempts, 0);
  const copyAverage = copyAttempts > 0 ? copies.reduce((sum, c) => sum + (c.averagePercentage ?? 0) * c.attempts, 0) / copyAttempts : null;
  const studentUrl = quiz.publicCode ? `${baseUrlFromHeaders(hdrs)}/quiz/${quiz.publicCode}` : null;
  const here = `/admin/quizzes/${quiz.id}`;
  const s = quiz.settings;
  const settingChips = [
    s.allowAnonymous ? "Anonymous allowed" : s.requireStudentId ? "Name + ID required" : "Name required",
    s.maxAttempts === 0 ? "Unlimited attempts" : s.maxAttempts === 1 ? "1 attempt" : `${s.maxAttempts} attempts`,
    quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min limit` : "No time limit",
    s.randomizeQuestions ? "Shuffled questions" : null,
    s.randomizeOptions ? "Shuffled options" : null,
    s.oneQuestionPerPage ? "One per page" : "All on one page",
    s.showScoreImmediately ? "Score shown" : "Score hidden",
    s.resultsReleased ? "Results released" : "Results withheld",
    s.accessCode ? `Access code: ${s.accessCode}` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/admin/quizzes" className="hover:text-indigo-600">Quizzes</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {quiz.title} <StatusBadge status={quiz.status} /> {quiz.isDemo && <Badge tone="blue">Demo</Badge>}
          </span>
        }
        description={
          <span>
            {quiz.subject || "No subject"}{quiz.gradeLevel ? ` · ${quiz.gradeLevel}` : ""} · {quiz.questions.length} questions · {stats.totalMarks} marks · Owner{" "}
            {owner ? (
              <Link href={`/admin/teachers/${owner.id}`} className="font-semibold text-indigo-600 hover:underline">{owner.name}</Link>
            ) : "unknown"}
            {owner?.status === "suspended" && <Badge tone="rose" className="ml-2">Owner suspended</Badge>}
          </span>
        }
        actions={
          <>
            {submissions.length > 0 && <a href={`/api/quizzes/${quiz.id}/export`} download className={buttonClass("outline")}>Export CSV</a>}
            {quiz.status === "published" && (
              <ConfirmForm action={adminSetQuizStatusAction} message={`Close "${quiz.title}"? Students will no longer be able to submit.`}>
                <input type="hidden" name="quizId" value={quiz.id} />
                <input type="hidden" name="status" value="closed" />
                <input type="hidden" name="redirectTo" value={here} />
                <SubmitButton variant="outline" pendingText="Closing…">Close quiz</SubmitButton>
              </ConfirmForm>
            )}
            {quiz.status === "closed" && quiz.publicCode && (
              <form action={adminSetQuizStatusAction}>
                <input type="hidden" name="quizId" value={quiz.id} />
                <input type="hidden" name="status" value="published" />
                <input type="hidden" name="redirectTo" value={here} />
                <SubmitButton variant="success" pendingText="Reopening…">Reopen quiz</SubmitButton>
              </form>
            )}
            <ConfirmForm action={adminDeleteQuizAction} message={`Permanently delete "${quiz.title}" and its ${submissions.length} submissions? This cannot be undone.`}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="redirectTo" value="/admin/quizzes" />
              <SubmitButton variant="danger" pendingText="Deleting…">Delete</SubmitButton>
            </ConfirmForm>
          </>
        }
      />
      <FlashMessages ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Student link</h2>
          {studentUrl ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a href={studentUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-sm text-indigo-700 underline">{studentUrl}</a>
              <div className="flex gap-2"><CopyButton text={studentUrl} size="sm" /><LinkButton href={`/quizzes/${quiz.id}/preview`} variant="ghost" size="sm">Preview</LinkButton></div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">This quiz has not been published yet, so it has no public link.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {settingChips.map((c) => <Badge key={c} tone="slate">{c}</Badge>)}
          </div>
          {quiz.description && <p className="mt-4 text-sm text-slate-600">{quiz.description}</p>}
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <MiniStat label="Attempts" value={stats.attempts} tone="indigo" />
          <MiniStat label="Average" value={formatPercent(stats.averagePercentage)} tone="green" hint={`Pass rate ${formatPercent(stats.passRate)}`} />
          <MiniStat label="Highest" value={stats.highestScore !== null ? `${stats.highestScore}/${stats.totalMarks}` : "—"} />
          <MiniStat label="Lowest" value={stats.lowestScore !== null ? `${stats.lowestScore}/${stats.totalMarks}` : "—"} />
        </div>
      </div>

      {sourceQuiz && (
        <Card className="mt-6 border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p>
            <span className="font-semibold">Assigned copy.</span> This quiz was assigned to {owner?.name ?? "this teacher"} from{" "}
            <Link href={`/admin/quizzes/${sourceQuiz.id}`} className="font-semibold underline">{sourceQuiz.title}</Link>
            {quiz.lockedContent ? " with locked questions" : ""}. Its student link and results belong to this teacher only.
          </p>
        </Card>
      )}

      <div id="assign" className="mt-6 grid scroll-mt-6 gap-6 xl:grid-cols-3">
        <SectionCard title="Assign to teachers" description="Give teachers their own copy to send to their students.">
          <div className="p-5">
            {quiz.questions.length === 0 ? (
              <p className="text-sm text-slate-600">Add at least one question before assigning this quiz.</p>
            ) : (
              <AssignQuizForm
                quizId={quiz.id}
                teachers={assignable.map((t) => ({ ...t, assigned: assignedIds.has(t.id) }))}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Teacher copies & results"
          description={copies.length ? `${copies.length} ${copies.length === 1 ? "teacher has" : "teachers have"} a copy · ${copyAttempts} student attempts · average ${formatPercent(copyAverage)}` : "Not assigned to anyone yet."}
          className="xl:col-span-2"
        >
          {copies.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Select teachers on the left. Each one gets a private copy with its own student link, and their students&apos; results appear here for you.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Teacher</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Attempts</th>
                    <th scope="col" className="px-3 py-3">Average</th>
                    <th scope="col" className="px-3 py-3">Pass rate</th>
                    <th scope="col" className="px-5 py-3 text-right">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {copies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/teachers/${c.teacherId}`} className="font-semibold text-slate-900 hover:text-indigo-600">{c.teacherName}</Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">{c.teacherEmail}{c.teacherStatus === "suspended" && <AccountStatusBadge status="suspended" />}</div>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={c.status} />{c.publicCode && c.status === "published" && <div className="mt-0.5 font-mono text-xs text-slate-500">{c.publicCode}</div>}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{c.attempts}</td>
                      <td className="px-3 py-3 text-slate-700">{formatPercent(c.averagePercentage)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatPercent(c.passRate)}</td>
                      <td className="px-5 py-3 text-right"><LinkButton href={`/admin/quizzes/${c.id}`} variant="outline" size="sm">View</LinkButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard title="Submissions" description={`${submissions.length} submitted ${submissions.length === 1 ? "attempt" : "attempts"}.`} className="xl:col-span-2">
          {submissions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No student submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Student</th>
                    <th scope="col" className="px-3 py-3">Score</th>
                    <th scope="col" className="px-3 py-3">Result</th>
                    <th scope="col" className="px-3 py-3">Time</th>
                    <th scope="col" className="px-3 py-3">Submitted</th>
                    <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/submissions/${sub.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{sub.studentName || <span className="italic text-slate-500">Anonymous</span>}</Link>
                        <p className="text-xs text-slate-500">{sub.studentIdentifier ? `ID: ${sub.studentIdentifier}` : ""}{sub.attemptNumber > 1 ? ` · Attempt ${sub.attemptNumber}` : ""}</p>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">{sub.score}/{sub.totalMarks} <span className="text-slate-500">({formatPercent(sub.percentage)})</span></td>
                      <td className="px-3 py-3"><div className="flex gap-1"><Badge tone={sub.passed ? "green" : "rose"}>{sub.passed ? "Pass" : "Fail"}</Badge>{sub.isLate && <Badge tone="amber">Late</Badge>}</div></td>
                      <td className="px-3 py-3 text-slate-700">{formatDuration(sub.timeTakenSeconds)}</td>
                      <td className="px-3 py-3 text-slate-500">{formatDateTime(sub.submittedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <ConfirmForm action={adminDeleteSubmissionAction} message={`Delete the submission from ${sub.studentName || "this anonymous student"}? This cannot be undone.`}>
                          <input type="hidden" name="submissionId" value={sub.id} />
                          <input type="hidden" name="redirectTo" value={here} />
                          <SubmitButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" pendingText="…">Delete</SubmitButton>
                        </ConfirmForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Questions & answer key" description="Visible to administrators and the owning teacher only.">
          {quiz.questions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No questions yet.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {quiz.questions.map((q, i) => {
                const a = analytics.find((x) => x.questionId === q.id);
                return (
                  <li key={q.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{i + 1}. {q.text || <span className="italic text-slate-400">Empty question</span>}</p>
                      <span className="shrink-0 text-xs text-slate-500">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{questionTypeLabel(q.type)} · Answer: <span className="font-medium text-emerald-700">{correctAnswerText(q) || "—"}</span></p>
                    {a && stats.attempts > 0 && (
                      <p className={cn("mt-1 text-xs font-medium", (a.correctRate ?? 0) >= 70 ? "text-emerald-700" : (a.correctRate ?? 0) >= 40 ? "text-amber-700" : "text-rose-700")}>
                        {formatPercent(a.correctRate)} correct ({a.correct}/{stats.attempts})
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
