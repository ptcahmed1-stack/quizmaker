import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { and, eq, getTableColumns, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { sessions, teachers, type Teacher } from "@/db/schema";
import { generateToken, sha256 } from "@/lib/utils";

const scrypt = promisify(scryptCb);
export const SESSION_COOKIE = "qm_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
export async function createSession(teacherId: string): Promise<void> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ teacherId, tokenHash: sha256(token), expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type SafeTeacher = Omit<Teacher, "passwordHash">;

const { passwordHash: _omitPasswordHash, ...teacherSafeColumns } = getTableColumns(teachers);
void _omitPasswordHash;

/** Returns the logged-in, active teacher (or admin) or null. Cached per request. */
export const getCurrentTeacher = cache(async (): Promise<SafeTeacher | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select(teacherSafeColumns)
    .from(sessions)
    .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        gt(sessions.expiresAt, new Date()),
        eq(teachers.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
});

/** Redirects to the login page when no teacher is logged in. */
export async function requireTeacher(): Promise<SafeTeacher> {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");
  return teacher;
}

/** Requires a logged-in platform administrator. Non-admins are sent to their dashboard. */
export async function requireAdmin(): Promise<SafeTeacher> {
  const teacher = await requireTeacher();
  if (teacher.role !== "admin") redirect("/dashboard");
  return teacher;
}

/** Emails listed in ADMIN_EMAILS (comma separated) are automatically granted admin access. */
export function isConfiguredAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

/** For API routes: returns the teacher or throws a 401-style error. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireTeacherApi(): Promise<SafeTeacher> {
  const teacher = await getCurrentTeacher();
  if (!teacher) throw new UnauthorizedError();
  return teacher;
}
