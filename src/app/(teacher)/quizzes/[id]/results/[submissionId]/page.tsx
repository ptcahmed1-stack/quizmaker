import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/client-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { cn, formatDateTime, formatDuration, formatPercent, questionTypeLabel } from "@/lib/format";
import { getSubmissionDetail } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Student submission" };

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string; submissionId: string }> }) {
  const teacher = await requireTeacher();
  const { id, submissionId } = await params;
  const data = await getSubmissionDetail(id, submissionId, teacher.id);
  if (!data) notFound();
  const { quiz, submission, answers } = data;
  const correct = answers.filter((a) => a.isCorrect).length;
  const incorrect = answers.filter((a) => a.answered && !a.isCorrect).length;
  const unanswered = answers.filter((a) => !a.answered).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>
            <span aria-hidden>/</span>
            <Link href={`/quizzes/${quiz.id}/results`} className="hover:text-indigo-600">{quiz.title}</Link>
            <span aria-hidden>/</span>
            <span>Submission</span>
          </span>
        }
        title={submission.studentName || "Anonymous student"}
        description={
          <span>
            {submission.studentIdentifier && <>Student ID: <span className="font-medium text-slate-800">{submission.studentIdentifier}</span> · </>}
            Attempt {submission.attemptNumber} · Submitted {formatDateTime(submission.submittedAt)}
          </span>
        }
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-slate-500">Score</p><p className="mt-1 text-xl font-bold text-slate-900">{submission.score} / {submission.totalMarks}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Percentage</p><p className="mt-1 text-xl font-bold text-slate-900">{formatPercent(submission.percentage)}</p></Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Result</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone={submission.passed ? "green" : "rose"}>{submission.passed ? "✓ Passed" : "✗ Failed"}</Badge>
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
