import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { status } = await req.json();
  // status can be 'closed' or 'published' (reopen)
  const newStatus = status === "published" ? "published" : "closed";
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.prepare("UPDATE quizzes SET status=?, updated_at=? WHERE id=?").run(newStatus, new Date().toISOString(), id);
  return NextResponse.json({ ok: true, status: newStatus });
}
