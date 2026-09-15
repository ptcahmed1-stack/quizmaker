import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await getDb();
  const quiz = await db.prepare("SELECT q.*, u.institute_name as institute_name FROM quizzes q LEFT JOIN users u ON u.id = q.teacher_id WHERE q.code = ?").get(code.toUpperCase()) as any;
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  if (quiz.status !== "published") {
    return NextResponse.json({ error: quiz.status === "closed" ? "This quiz is currently closed." : "Quiz not available", quiz: { ...quiz, settings: JSON.parse(quiz.settings_json||"{}") }, status: quiz.status }, { status: 403 });
  }
  const settings = quiz.settings_json ? JSON.parse(quiz.settings_json) : {};
  if (settings.startAt) {
    if (new Date() < new Date(settings.startAt)) {
      return NextResponse.json({ error: "Quiz has not started yet", status: "not_started" }, { status: 403 });
    }
  }
  if (settings.endAt) {
    if (new Date() > new Date(settings.endAt)) {
      return NextResponse.json({ error: "Quiz has ended", status: "ended" }, { status: 403 });
    }
  }

  const rawQs = await db.prepare("SELECT id, quiz_id, type, text, options_json, marks, explanation, order_index FROM questions WHERE quiz_id = ? ORDER BY order_index").all(quiz.id) as any[];
  const questions = rawQs.map((q:any)=>({
    id: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    options: q.options_json ? JSON.parse(q.options_json) : [],
  }));

  let outQuestions = [...questions];
  if (settings.randomizeQuestions) {
    outQuestions = outQuestions.sort(()=>Math.random()-0.5);
  }
  if (settings.randomizeOptions) {
    outQuestions = outQuestions.map((q:any)=>{
      if (q.options && q.options.length) {
        return {...q, options: [...q.options].sort(()=>Math.random()-0.5)};
      }
      return q;
    });
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      code: quiz.code,
      title: quiz.title,
      description: quiz.description,
      subject: quiz.subject,
      grade: quiz.grade,
      instructions: quiz.instructions,
      time_limit: quiz.time_limit,
      passing_percentage: quiz.passing_percentage,
      status: quiz.status,
      settings,
      institute_name: quiz.institute_name || "Momin Academy"
    },
    questions: outQuestions
  });
}
