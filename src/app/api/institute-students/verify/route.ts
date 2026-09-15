import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { student_id, password, quizCode, quizId } = await req.json();
  if (!student_id || !password) return NextResponse.json({ error: "Student ID and password required" }, { status: 400 });
  const db = await getDb();
  let quiz: any = null;
  if (quizCode) quiz = await db.prepare("SELECT * FROM quizzes WHERE code=?").get(String(quizCode).toUpperCase()) as any;
  else if (quizId) quiz = await db.prepare("SELECT * FROM quizzes WHERE id=?").get(quizId) as any;
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const teacherId = quiz.teacher_id;
  const student = await db.prepare("SELECT * FROM institute_students WHERE teacher_id=? AND student_id=?").get(teacherId, String(student_id).trim()) as any;
  if (!student) return NextResponse.json({ error: "Student ID not found for this institute", ok: false }, { status: 401 });
  const ok = await bcrypt.compare(String(password), student.password_hash);
  if (!ok) return NextResponse.json({ error: "Incorrect password", ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, student: { student_id: student.student_id, name: student.name, class_name: student.class_name } });
}
