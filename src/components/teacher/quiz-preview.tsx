import type { ReactNode } from "react";
import { QuizRunner } from "@/components/student/quiz-runner";
import { PreviewFrame } from "@/components/teacher/preview-frame";
import { Alert, PageHeader, StatusBadge } from "@/components/ui";
import type { FullQuiz } from "@/lib/quizzes";
import type { PublicQuizInfo } from "@/lib/student-types";

/** Exactly what students see, rendered locally. Nothing in preview is saved or counted. */
export function QuizPreview({
  quiz,
  teacherName,
  eyebrow,
  actions,
}: {
  quiz: FullQuiz;
  teacherName: string;
  eyebrow: ReactNode;
  actions: ReactNode;
}) {
  const s = quiz.settings;
  const info: PublicQuizInfo = {
    id: quiz.id,
    code: quiz.publicCode ?? "PREVIEW",
    title: quiz.title,
    description: quiz.description,
    instructions: quiz.instructions,
    subject: quiz.subject,
    gradeLevel: quiz.gradeLevel,
    teacherName,
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
        eyebrow={eyebrow}
        title={<span className="flex flex-wrap items-center gap-2">Preview: {quiz.title} <StatusBadge status={quiz.status} /></span>}
        description="This is exactly what students will see. Answers in preview are scored locally and never saved."
        actions={actions}
      />
      {quiz.questions.length === 0 ? (
        <Alert tone="warning">Add at least one question to preview the quiz.</Alert>
      ) : (
        <PreviewFrame>
          <QuizRunner
            key={quiz.updatedAt.toISOString()}
            quiz={info}
            mode="preview"
            previewQuestions={previewQuestions}
            previewResultSettings={{ showCorrectAnswers: s.showCorrectAnswers, showExplanations: s.showExplanations }}
          />
        </PreviewFrame>
      )}
    </div>
  );
}
