import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizPreview } from "@/components/teacher/quiz-preview";
import { LinkButton } from "@/components/ui";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getQuizForAdmin } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Preview quiz · Admin" };

export default async function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const quiz = await getQuizForAdmin(id);
  if (!quiz) notFound();
  const [owner] = await db.select({ name: teachers.name }).from(teachers).where(eq(teachers.id, quiz.teacherId)).limit(1);
  return (
    <QuizPreview
      quiz={quiz}
      teacherName={owner?.name ?? ""}
      eyebrow={
        <span className="flex items-center gap-1.5">
          <Link href="/admin/quizzes" className="hover:text-indigo-600">Quizzes</Link>
          <span aria-hidden>/</span>
          <Link href={`/admin/quizzes/${quiz.id}`} className="hover:text-indigo-600">{quiz.title}</Link>
        </span>
      }
      actions={<LinkButton href={`/admin/quizzes/${quiz.id}`} variant="outline">Back to quiz</LinkButton>}
    />
  );
}
