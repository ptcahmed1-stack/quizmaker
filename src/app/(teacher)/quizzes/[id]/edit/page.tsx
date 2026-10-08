import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { QuizEditor } from "@/components/teacher/quiz-editor";
import { requireTeacher } from "@/lib/auth";
import { getQuizForTeacher, toEditorPayload } from "@/lib/quizzes";
import { baseUrlFromHeaders } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit quiz" };

export default async function EditQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publishErrors?: string; duplicated?: string }>;
}) {
  const teacher = await requireTeacher();
  const [{ id }, sp, hdrs] = await Promise.all([params, searchParams, headers()]);
  const quiz = await getQuizForTeacher(id, teacher.id);
  if (!quiz) notFound();
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(submissions)
    .where(and(eq(submissions.quizId, quiz.id), eq(submissions.status, "submitted")));

  return (
    <QuizEditor
      key={quiz.id}
      quizId={quiz.id}
      status={quiz.status}
      publicCode={quiz.publicCode}
      initial={toEditorPayload(quiz)}
      submissionCount={cnt}
      initialPublishErrors={sp.publishErrors ? sp.publishErrors.split("\n").filter(Boolean) : []}
      originFallback={baseUrlFromHeaders(hdrs)}
      notice={sp.duplicated ? "Quiz duplicated. This is a new draft copy with its own link once published." : undefined}
    />
  );
}
