import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { closeQuizAction, publishFromFormAction } from "@/app/(teacher)/actions";
import { SubmitButton } from "@/components/client-bits";
import { SharePanel } from "@/components/teacher/share-panel";
import { Alert, Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getQuizForTeacher } from "@/lib/quizzes";
import { baseUrlFromHeaders } from "@/lib/utils";

export const metadata: Metadata = { title: "Share quiz" };

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const teacher = await requireTeacher();
  const [{ id }, sp, hdrs] = await Promise.all([params, searchParams, headers()]);
  const quiz = await getQuizForTeacher(id, teacher.id);
  if (!quiz) notFound();

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {quiz.title} <StatusBadge status={quiz.status} />
          </span>
        }
        description={`${quiz.questions.length} questions${quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min time limit` : ""}`}
        actions={
          <>
            <LinkButton href={`/quizzes/${quiz.id}/edit`} variant="outline">Edit</LinkButton>
            <LinkButton href={`/quizzes/${quiz.id}/results`} variant="outline">Results</LinkButton>
            {quiz.status === "published" && (
              <form action={closeQuizAction}>
                <input type="hidden" name="quizId" value={quiz.id} />
                <SubmitButton variant="ghost" pendingText="Closing…">Close quiz</SubmitButton>
              </form>
            )}
          </>
        }
      />

      {quiz.status === "published" && quiz.publicCode ? (
        <SharePanel code={quiz.publicCode} title={quiz.title} subject={quiz.subject} originFallback={baseUrlFromHeaders(hdrs)} justPublished={sp.published === "1"} />
      ) : (
        <Card className="p-6">
          <Alert tone="warning" title={quiz.status === "closed" ? "This quiz is closed" : "This quiz is not published yet"}>
            {quiz.status === "closed"
              ? "Students visiting the link see “This quiz is currently closed.” Reopen it to accept submissions again."
              : "Publish the quiz to generate a unique student link and QR code."}
          </Alert>
          <form action={publishFromFormAction} className="mt-4">
            <input type="hidden" name="quizId" value={quiz.id} />
            <SubmitButton variant="success" pendingText="Publishing…">{quiz.status === "closed" ? "Reopen quiz" : "Publish Quiz"}</SubmitButton>
          </form>
          {quiz.publicCode && (
            <p className="mt-4 text-sm text-slate-500">
              The quiz keeps its code <span className="font-mono font-semibold">{quiz.publicCode}</span>, so existing links will work again once reopened.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
