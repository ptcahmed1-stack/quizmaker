import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    const db = await getDb();
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim()) as any;
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const token = await createToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
