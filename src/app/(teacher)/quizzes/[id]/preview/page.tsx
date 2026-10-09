import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizPreview } from "@/components/teacher/quiz-preview";
import { LinkButton } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getQuizForTeacher } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Preview quiz" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const quiz = await getQuizForTeacher(id, teacher.id);
  if (!quiz) notFound();
  return (
    <QuizPreview
      quiz={quiz}
      teacherName={teacher.name}
      eyebrow={<Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>}
      actions={
        <>
          <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline">Back to editor</LinkButton>
          {quiz.status === "published" ? <LinkButton href={`/quizzes/${quiz.id}/share`}>Share</LinkButton> : null}
        </>
      }
    />
  );
}
