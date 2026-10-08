import { redirect } from "next/navigation";

export default async function QuizIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quizzes/${id}/edit`);
}
