import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb, { generateQuizCode } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const questions = await db.prepare("SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?").get(id) as any;
  if (questions.c === 0) return NextResponse.json({ error: "Add at least one question before publishing" }, { status: 400 });

  let code = quiz.code;
  if (!code) code = await generateQuizCode();
  const now = new Date().toISOString();
  await db.prepare("UPDATE quizzes SET status='published', code=?, published_at=?, updated_at=? WHERE id=?").run(code, now, now, id);

  const updated = await db.prepare("SELECT * FROM quizzes WHERE id = ?").get(id);
  return NextResponse.json({ quiz: updated, code });
}
