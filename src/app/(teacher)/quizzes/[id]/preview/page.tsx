import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/student/quiz-runner";
import { PreviewFrame } from "@/components/teacher/preview-frame";
import { Alert, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getQuizForTeacher } from "@/lib/quizzes";
import type { PublicQuizInfo } from "@/lib/student-types";

export const metadata: Metadata = { title: "Preview quiz" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const quiz = await getQuizForTeacher(id, teacher.id);
  if (!quiz) notFound();
  const s = quiz.settings;

  const info: PublicQuizInfo = {
    id: quiz.id,
    code: quiz.publicCode ?? "PREVIEW",
    title: quiz.title,
    description: quiz.description,
    instructions: quiz.instructions,
    subject: quiz.subject,
    gradeLevel: quiz.gradeLevel,
    teacherName: teacher.name,
    questionCount: quiz.questions.length,
    totalMarks: quiz.questions.reduce((sum, q) => sum + q.marks, 0),
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    availability: "open",
    startsAt: null,
    endsAt: null,
    requireStudentName: s.requireStudentName && !s.allowAnonymous,
    requireStudentId: s.requireStudentId && !s.allowAnonymous,
    allowAnonymous: s.allowAnonymous,
    requiresAccessCode: false,
    maxAttempts: s.maxAttempts,
    oneQuestionPerPage: s.oneQuestionPerPage,
    allowNavigation: s.allowNavigation,
    autoSubmitOnExpiry: s.autoSubmitOnExpiry,
    showScoreImmediately: s.showScoreImmediately,
    resultsReleased: s.resultsReleased,
  };

  const previewQuestions = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    explanation: q.explanation,
    expectedAnswer: q.expectedAnswer,
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>}
        title={<span className="flex flex-wrap items-center gap-2">Preview: {quiz.title} <StatusBadge status={quiz.status} /></span>}
        description="This is exactly what students will see. Answers in preview are scored locally and never saved."
        actions={
          <>
            <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline">Back to editor</LinkButton>
            {quiz.status === "published" ? <LinkButton href={`/quizzes/${quiz.id}/share`}>Share</LinkButton> : null}
          </>
        }
      />
      {quiz.questions.length === 0 ? (
        <Alert tone="warning">Add at least one question to preview the quiz.</Alert>
      ) : (
        <PreviewFrame>
          <QuizRunner key={quiz.updatedAt.toISOString()} quiz={info} mode="preview" previewQuestions={previewQuestions} previewResultSettings={{ showCorrectAnswers: s.showCorrectAnswers, showExplanations: s.showExplanations }} />
        </PreviewFrame>
      )}
    </div>
  );
}
