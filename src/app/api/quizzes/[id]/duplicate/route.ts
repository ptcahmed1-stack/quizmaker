import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb, { generateId } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const questions = await db.prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index").all(id) as any[];

  const newId = generateId();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO quizzes (id, teacher_id, title, description, subject, grade, instructions, time_limit, passing_percentage, status, settings_json, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(newId, user.id, quiz.title + " - Copy", quiz.description, quiz.subject, quiz.grade, quiz.instructions, quiz.time_limit, quiz.passing_percentage, "draft", quiz.settings_json, now, now);

  const stmt = await db.prepare(`INSERT INTO questions (id, quiz_id, type, text, options_json, correct_answer, marks, explanation, order_index) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (let i=0;i<questions.length;i++) {
    const q = questions[i];
    await stmt.run(generateId(), newId, q.type, q.text, q.options_json, q.correct_answer, q.marks, q.explanation, i);
  }

  const newQuiz = await db.prepare("SELECT * FROM quizzes WHERE id = ?").get(newId);
  return NextResponse.json({ quiz: newQuiz });
}
