import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb, { generateId } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rawQuestions = await db.prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC").all(id) as any[];
  const questions = rawQuestions.map((q: any) => ({
    ...q,
    options: q.options_json ? JSON.parse(q.options_json) : [],
  }));
  return NextResponse.json({ quiz: { ...quiz, settings: quiz.settings_json ? JSON.parse(quiz.settings_json) : {}, questions } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { title, description, subject, grade, instructions, time_limit, passing_percentage, status, settings, questions } = body;

  if (!title || !title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const db = await getDb();
  const existing = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "published") {
    const qs = questions || [];
    if (!qs.length) return NextResponse.json({ error: "Add at least one question before publishing" }, { status: 400 });
    for (const q of qs) {
      if (!q.text?.trim()) return NextResponse.json({ error: "Question text required" }, { status: 400 });
      if (!q.correct_answer && !q.correctAnswer) return NextResponse.json({ error: "Correct answer required" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const settingsJson = JSON.stringify(settings || {});
  await db.prepare(`
    UPDATE quizzes SET title=?, description=?, subject=?, grade=?, instructions=?, time_limit=?, passing_percentage=?, status=?, settings_json=?, updated_at=?
    WHERE id=? AND teacher_id=?
  `).run(
    title.trim(), description || "", subject || "", grade || "", instructions || "",
    time_limit ? Number(time_limit) : null,
    passing_percentage ? Number(passing_percentage) : 50,
    status || existing.status,
    settingsJson, now, id, user.id
  );

  if (questions && Array.isArray(questions)) {
    const del = await db.prepare("DELETE FROM questions WHERE quiz_id = ?");
    await del.run(id);
    const qStmt = await db.prepare(`INSERT INTO questions (id, quiz_id, type, text, options_json, correct_answer, marks, explanation, order_index) VALUES (?,?,?,?,?,?,?,?,?)`);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await qStmt.run(
        q.id || generateId(),
        id,
        q.type,
        q.text,
        JSON.stringify(q.options || []),
        q.correct_answer || q.correctAnswer || "",
        Number(q.marks) || 1,
        q.explanation || "",
        i
      );
    }
  }

  const updated = await db.prepare("SELECT * FROM quizzes WHERE id = ?").get(id) as any;
  const rawUpdatedQuestions = await db.prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC").all(id) as any[];
  const updatedQuestions = rawUpdatedQuestions.map((q: any) => ({
    ...q, options: JSON.parse(q.options_json || "[]")
  }));
  return NextResponse.json({ quiz: { ...updated, settings: JSON.parse(updated.settings_json || "{}"), questions: updatedQuestions } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const existing = await db.prepare("SELECT id FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.prepare("DELETE FROM submissions WHERE quiz_id = ?").run(id);
  await db.prepare("DELETE FROM questions WHERE quiz_id = ?").run(id);
  await db.prepare("DELETE FROM quizzes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
