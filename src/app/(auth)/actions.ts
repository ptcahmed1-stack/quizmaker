"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { passwordResetTokens, sessions, teachers } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { ensureAdminAccount, getPlatformSettings, logAudit } from "@/lib/admin";
import { createSession, destroySession, hashPassword, isConfiguredAdminEmail, verifyPassword } from "@/lib/auth";
import { DEMO_EMAIL, ensureDemoTeacher } from "@/lib/demo-data";
import { clientIp, hit, isBlocked, reset, waitText } from "@/lib/rate-limit";
import { baseUrlFromHeaders, generateToken, sha256 } from "@/lib/utils";
import { loginSchema, signupSchema } from "@/lib/validation";

export interface AuthState {
  error?: string;
  success?: string;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    school: formData.get("school") ?? "",
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { name, email, school, password } = parsed.data;

  const settings = await getPlatformSettings();
  if (!settings.allowSignups && !isConfiguredAdminEmail(email)) {
    return { error: "New sign-ups are currently disabled. Please contact your administrator." };
  }

  const existing = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, email)).limit(1);
  if (existing.length) return { error: "An account with this email already exists. Please log in instead." };

  const role = isConfiguredAdminEmail(email) ? "admin" : "teacher";
  const [teacher] = await db
    .insert(teachers)
    .values({ name, email, school: school || null, passwordHash: await hashPassword(password), role, lastLoginAt: new Date() })
    .returning({ id: teachers.id });
  await logAudit({ id: teacher.id, email }, "auth.signup", { type: "teacher", id: teacher.id, label: email }, { role });
  await logActivity({ id: teacher.id, name }, "auth.signup", undefined, { role });
  await createSession(teacher.id);
  redirect(role === "admin" ? "/admin" : "/dashboard");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { email, password } = parsed.data;

  await ensureAdminAccount().catch((err) => console.error("admin bootstrap failed", err));

  // Brute-force protection: 8 failures per account+IP and 40 per IP in 15 minutes.
  const ip = clientIp(await headers());
  const accountKey = `login:${ip}:${email}`;
  const ipKey = `login-ip:${ip}`;
  const blocked = isBlocked(accountKey, 8).blocked ? isBlocked(accountKey, 8) : isBlocked(ipKey, 40);
  if (blocked.blocked) {
    return { error: `Too many failed log-in attempts. Please try again in ${waitText(blocked.retryAfterSeconds)}.` };
  }

  const [teacher] = await db.select().from(teachers).where(eq(teachers.email, email)).limit(1);
  if (!teacher || !(await verifyPassword(password, teacher.passwordHash))) {
    hit(accountKey, 15 * 60 * 1000);
    hit(ipKey, 15 * 60 * 1000);
    return { error: "Incorrect email or password." };
  }
  reset(accountKey);
  if (teacher.status === "suspended") {
    return { error: "Your account has been suspended. Please contact the administrator." };
  }
  let role = teacher.role;
  if (role !== "admin" && isConfiguredAdminEmail(teacher.email)) {
    role = "admin";
    await logAudit(null, "teacher.auto_promote", { type: "teacher", id: teacher.id, label: teacher.email }, { reason: "ADMIN_EMAILS" });
  }
  await db.update(teachers).set({ role, lastLoginAt: new Date() }).where(eq(teachers.id, teacher.id));
  await createSession(teacher.id);
  await logActivity({ id: teacher.id, name: teacher.name }, "auth.login");
  if (teacher.mustChangePassword) redirect(role === "admin" ? "/admin/account?welcome=1" : "/settings?welcome=1");
  redirect(role === "admin" ? "/admin" : "/dashboard");
}

export async function loginAsDemo(): Promise<void> {
  const id = await ensureDemoTeacher();
  await db.update(teachers).set({ lastLoginAt: new Date() }).where(eq(teachers.id, id));
  await createSession(id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function forgotPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };
  const generic = { success: "If an account exists for that email, a password reset link has been generated." };
  if (hit(`forgot:${clientIp(await headers())}`, 60 * 60 * 1000) > 8) {
    return { error: "Too many reset requests. Please try again later or ask your administrator." };
  }

  const [teacher] = await db.select({ id: teachers.id, name: teachers.name }).from(teachers).where(eq(teachers.email, email)).limit(1);
  if (!teacher) return generic;
  if (email === DEMO_EMAIL) return { error: "The shared demo account password cannot be reset." };

  const token = generateToken(32);
  await db.insert(passwordResetTokens).values({
    teacherId: teacher.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const resetUrl = `${baseUrlFromHeaders(await headers())}/reset-password?token=${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "QuizMaker <onboarding@resend.dev>",
          to: [email],
          subject: "Reset your QuizMaker password",
          html: `<p>Hello ${teacher.name},</p><p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        }),
      });
      return { success: "A password reset link has been sent to your email address." };
    } catch {
      return { error: "We could not send the reset email. Please try again later." };
    }
  }

  // No email provider configured: log the link so an administrator can share it.
  console.log(`[QuizMaker] Password reset link for ${email}: ${resetUrl}`);
  return {
    success:
      "Email delivery is not set up on this deployment, so we cannot email you a link. Please ask your administrator to reset your password — they can set a new one or send you a reset link from the admin panel.",
  };
}

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) return { error: "This reset link is invalid." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);
  if (!row) return { error: "This reset link is invalid or has expired. Please request a new one." };

  await db.transaction(async (tx) => {
    await tx.update(teachers).set({ passwordHash: await hashPassword(password), mustChangePassword: false, updatedAt: new Date() }).where(eq(teachers.id, row.teacherId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await tx.delete(sessions).where(eq(sessions.teacherId, row.teacherId));
  });
  return { success: "Your password has been updated. You can now log in." };
}
