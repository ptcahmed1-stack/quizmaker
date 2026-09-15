import { NextRequest, NextResponse } from "next/server";
import getDb, { generateId } from "@/lib/db";
import { hashPassword, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, adminCode } = await req.json();
    // Admin signup code gate — take control of who can create teacher accounts
    // Set via Railway Variables -> ADMIN_SIGNUP_CODE, default is Momin2025
    const ADMIN_CODE = process.env.ADMIN_SIGNUP_CODE || "Momin2025";
    if (!adminCode || String(adminCode).trim() !== ADMIN_CODE) {
      return NextResponse.json({ error: "Invalid Admin Signup Code. Ask Momin Academy admin for the code." }, { status: 403 });
    }
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    const db = await getDb();
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    const id = generateId();
    const hash = await hashPassword(password);
    await db.prepare("INSERT INTO users (id, email, password_hash, name, institute_name) VALUES (?,?,?,?,?)").run(id, email.toLowerCase().trim(), hash, name.trim(), "Momin Academy");
    const token = await createToken({ userId: id, email: email.toLowerCase().trim() });
    const res = NextResponse.json({ ok: true, user: { id, email: email.toLowerCase().trim(), name: name.trim() } });
    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
