import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDeleteSubmissionAction } from "@/app/(admin)/actions";
import { ConfirmForm, PrintButton, SubmitButton } from "@/components/client-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { cn, formatDateTime, formatDuration, formatPercent, questionTypeLabel } from "@/lib/format";
import { getSubmissionDetailAdmin } from "@/lib/quizzes";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Submission · Admin" };

export default async function AdminSubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getSubmissionDetailAdmin(id);
  if (!data) notFound();
  const { quiz, submission, answers } = data;
  const [owner] = await db.select({ id: teachers.id, name: teachers.name }).from(teachers).where(eq(teachers.id, quiz.teacherId)).limit(1);
  const correct = answers.filter((a) => a.isCorrect).length;
  const incorrect = answers.filter((a) => a.answered && !a.isCorrect).length;
  const unanswered = answers.filter((a) => !a.answered).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href="/admin/submissions" className="hover:text-indigo-600">All results</Link>
            <span aria-hidden>/</span>
            <Link href={`/admin/quizzes/${quiz.id}`} className="hover:text-indigo-600">{quiz.title}</Link>
            <span aria-hidden>/</span>
            <span>Submission</span>
          </span>
        }
        title={submission.studentName || "Anonymous student"}
        description={
          <span>
            {submission.studentIdentifier && <>Student ID: <span className="font-medium text-slate-800">{submission.studentIdentifier}</span> · </>}
            Attempt {submission.attemptNumber} · {submission.status === "submitted" ? `Submitted ${formatDateTime(submission.submittedAt)}` : `In progress since ${formatDateTime(submission.startedAt)}`} · Teacher{" "}
            {owner ? <Link href={`/admin/teachers/${owner.id}`} className="font-semibold text-indigo-600 hover:underline">{owner.name}</Link> : "unknown"}
          </span>
        }
        actions={
          <>
            <PrintButton />
            <ConfirmForm action={adminDeleteSubmissionAction} message="Delete this submission? This cannot be undone.">
              <input type="hidden" name="submissionId" value={submission.id} />
              <input type="hidden" name="redirectTo" value={`/admin/quizzes/${quiz.id}`} />
              <SubmitButton variant="danger" pendingText="Deleting…">Delete</SubmitButton>
            </ConfirmForm>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-slate-500">Score</p><p className="mt-1 text-xl font-bold text-slate-900">{submission.score} / {submission.totalMarks}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Percentage</p><p className="mt-1 text-xl font-bold text-slate-900">{formatPercent(submission.percentage)}</p></Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Result</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {submission.status === "submitted" ? <Badge tone={submission.passed ? "green" : "rose"}>{submission.passed ? "✓ Passed" : "✗ Failed"}</Badge> : <Badge tone="amber">In progress</Badge>}
            {submission.isLate && <Badge tone="amber">Late</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Pass mark {quiz.passingPercentage}%</p>
        </Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Time taken</p><p className="mt-1 text-xl font-bold text-slate-900">{formatDuration(submission.timeTakenSeconds)}</p></Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Breakdown</p>
          <p className="mt-1 text-sm font-semibold"><span className="text-emerald-700">{correct} correct</span> · <span className="text-rose-700">{incorrect} wrong</span> · <span className="text-slate-600">{unanswered} blank</span></p>
        </Card>
      </div>

      <section className="mt-6 space-y-3" aria-label="Question by question answers">
        <h2 className="text-lg font-semibold text-slate-900">Question-by-question</h2>
        {answers.map((a) => (
          <Card key={a.questionId} className={cn("border-l-4 p-5", a.isCorrect ? "border-l-emerald-500" : a.answered ? "border-l-rose-500" : "border-l-slate-300")}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {a.position} · {questionTypeLabel(a.type)}</p>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", a.isCorrect ? "bg-emerald-100 text-emerald-800" : a.answered ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")}>
                {a.isCorrect ? "✓ Correct" : a.answered ? "✗ Incorrect" : "— Not answered"} · {a.marksAwarded}/{a.marks}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap font-semibold text-slate-900">{a.text}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className={cn("rounded-lg p-3", a.isCorrect ? "bg-emerald-50" : a.answered ? "bg-rose-50" : "bg-slate-50")}>
                <dt className="text-xs text-slate-500">Student&apos;s answer</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{a.yourAnswer || <span className="italic text-slate-500">No answer</span>}</dd>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <dt className="text-xs text-slate-500">Correct answer</dt>
                <dd className="mt-0.5 font-medium text-emerald-900">{a.correctAnswer || "—"}</dd>
              </div>
            </dl>
            {a.explanation && <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Explanation:</span> {a.explanation}</p>}
          </Card>
        ))}
      </section>
    </div>
  );
}
