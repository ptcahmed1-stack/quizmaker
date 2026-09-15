import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";
import bcrypt from "bcryptjs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  await db.prepare("DELETE FROM institute_students WHERE id=? AND teacher_id=?").run(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, student_id, password, class_name } = await req.json();
  const db = await getDb();
  const existing = await db.prepare("SELECT * FROM institute_students WHERE id=? AND teacher_id=?").get(id, user.id) as any;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updates: string[] = [];
  const args: any[] = [];
  if (name) { updates.push("name=?"); args.push(name.trim()); }
  if (student_id) { updates.push("student_id=?"); args.push(String(student_id).trim()); }
  if (class_name !== undefined) { updates.push("class_name=?"); args.push(class_name?.trim() || null); }
  if (password) {
    const hash = await bcrypt.hash(String(password), 10);
    updates.push("password_hash=?");
    args.push(hash);
  }
  if (updates.length === 0) return NextResponse.json({ ok: true });
  args.push(id, user.id);
  await db.prepare(`UPDATE institute_students SET ${updates.join(", ")} WHERE id=? AND teacher_id=?`).run(...args);
  return NextResponse.json({ ok: true });
}
