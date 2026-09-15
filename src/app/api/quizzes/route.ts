import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb, { generateId } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const raw = await db.prepare(`
    SELECT q.*, 
      (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as questionCount,
      (SELECT COUNT(*) FROM submissions WHERE quiz_id = q.id) as attempts,
      (SELECT AVG(percentage) FROM submissions WHERE quiz_id = q.id) as avgPercentage
    FROM quizzes q WHERE teacher_id = ? ORDER BY updated_at DESC
  `).all(user.id) as any[];
  const parsed = raw.map((q: any) => ({
    ...q,
    settings: q.settings_json ? JSON.parse(q.settings_json) : {},
    avgPercentage: q.avgPercentage ? Math.round(q.avgPercentage) : null
  }));
  return NextResponse.json({ quizzes: parsed });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const {
    title, description, subject, grade, instructions,
    time_limit, passing_percentage, status,
    settings, questions
  } = body;

  if (!title || !title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const settingsJson = JSON.stringify(settings || {});
  const safeTime = time_limit ? Number(time_limit) : null;
  const safePass = passing_percentage ? Number(passing_percentage) : 50;

  const stmt = await db.prepare(`
    INSERT INTO quizzes (id, teacher_id, title, description, subject, grade, instructions, time_limit, passing_percentage, status, settings_json, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  await stmt.run(id, user.id, title.trim(), description || "", subject || "", grade || "", instructions || "", safeTime, safePass, status || "draft", settingsJson, now, now);

  if (questions && Array.isArray(questions)) {
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

  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ?").get(id);
  return NextResponse.json({ quiz: { ...quiz as any, settings: settings || {} } }, { status: 201 });
}
