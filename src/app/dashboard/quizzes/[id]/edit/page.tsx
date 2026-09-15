import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import QuizEditor from "@/components/QuizEditor";

export default async function EditPage({ params }: { params: Promise<{id:string}> }){
  const {id} = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id=? AND teacher_id=?").get(id, user.id) as any;
  if (!quiz) return notFound();
  const rawQs = await db.prepare("SELECT * FROM questions WHERE quiz_id=? ORDER BY order_index").all(id) as any[];
  const questions = rawQs.map((q:any)=>({
    ...q,
    options: q.options_json? JSON.parse(q.options_json): []
  }));
  const initial = {
    ...quiz,
    settings: quiz.settings_json? JSON.parse(quiz.settings_json): {},
    questions
  };
  return <QuizEditor mode="edit" initial={initial} />;
}
