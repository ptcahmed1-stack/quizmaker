import * as jose from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import getDb from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "quizmaker-dev-secret-change-in-prod-32chars!";
const secret = new TextEncoder().encode(JWT_SECRET);
const alg = "HS256";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createToken(payload: { userId: string; email: string }) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = await cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  const user = await db.prepare("SELECT id, email, name, institute_name, created_at FROM users WHERE id = ?").get(payload.userId) as any;
  if (user && !user.institute_name) user.institute_name = "Momin Academy";
  return user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
