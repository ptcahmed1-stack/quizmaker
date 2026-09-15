import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb, { generateId } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const students = await db.prepare("SELECT id, teacher_id, student_id, name, class_name, created_at FROM institute_students WHERE teacher_id = ? ORDER BY created_at DESC").all(user.id) as any[];
  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  // body can be { students: [{student_id, name, password, class_name}] } or single {student_id, name, password, class_name}
  let list: any[] = [];
  if (Array.isArray(body.students)) list = body.students;
  else if (body.student_id) list = [body];
  else if (Array.isArray(body)) list = body;
  else return NextResponse.json({ error: "No students provided" }, { status: 400 });

  if (list.length === 0) return NextResponse.json({ error: "Empty list" }, { status: 400 });
  if (list.length > 500) return NextResponse.json({ error: "Max 500 students per upload" }, { status: 400 });

  const db = await getDb();
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const s of list) {
    const sid = String(s.student_id || s.studentId || "").trim();
    const name = String(s.name || "").trim();
    const password = String(s.password || "").trim();
    const className = String(s.class_name || s.className || s.class || "").trim();
    if (!sid || !name || !password) {
      errors.push(`Skipped ${sid || name}: missing id/name/password`);
      skipped++;
      continue;
    }
    // check duplicate
    const exists = await db.prepare("SELECT id FROM institute_students WHERE teacher_id=? AND student_id=?").get(user.id, sid) as any;
    if (exists) {
      // update existing? For now skip or update password/name
      // Update name/class and password if provided
      const hash = await bcrypt.hash(password, 10);
      await db.prepare("UPDATE institute_students SET name=?, password_hash=?, class_name=? WHERE teacher_id=? AND student_id=?").run(name, hash, className || null, user.id, sid);
      added++;
      continue;
    }
    const id = generateId();
    const hash = await bcrypt.hash(password, 10);
    try {
      await db.prepare("INSERT INTO institute_students (id, teacher_id, student_id, name, password_hash, class_name) VALUES (?,?,?,?,?,?)").run(id, user.id, sid, name, hash, className || null);
      added++;
    } catch (e:any) {
      errors.push(`Failed ${sid}: ${e.message}`);
      skipped++;
    }
  }

  return NextResponse.json({ added, skipped, errors });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const bulk = searchParams.get("bulk"); // bulk delete all?
  const db = await getDb();
  if (bulk === "all") {
    await db.prepare("DELETE FROM institute_students WHERE teacher_id=?").run(user.id);
    return NextResponse.json({ ok: true });
  }
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.prepare("DELETE FROM institute_students WHERE id=? AND teacher_id=?").run(id, user.id);
  return NextResponse.json({ ok: true });
}
