"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { passwordResetTokens, quizzes, sessions, submissions, teachers } from "@/db/schema";
import { deleteAbandonedAttempts, logAudit, updatePlatformSettings } from "@/lib/admin";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { resetDemoData } from "@/lib/demo-data";
import { baseUrlFromHeaders, generateToken, sha256 } from "@/lib/utils";
import { signupSchema } from "@/lib/validation";

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function withMessage(path: string, kind: "error" | "ok", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

async function loadTarget(teacherId: string) {
  const [t] = await db
    .select({ id: teachers.id, email: teachers.email, name: teachers.name, role: teachers.role, status: teachers.status })
    .from(teachers)
    .where(eq(teachers.id, teacherId))
    .limit(1);
  return t ?? null;
}

// ---------------------------------------------------------------------------
// Teacher accounts
// ---------------------------------------------------------------------------
export async function setTeacherStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const back = `/admin/teachers/${teacherId}`;
  if (teacherId === admin.id) withMessage(back, "error", "You cannot suspend your own account.");
  const target = await loadTarget(teacherId);
  if (!target) redirect("/admin/teachers");

  await db
    .update(teachers)
    .set({
      status,
      suspendedAt: status === "suspended" ? new Date() : null,
      suspendedReason: status === "suspended" ? reason || null : null,
      updatedAt: new Date(),
    })
    .where(eq(teachers.id, teacherId));
  if (status === "suspended") await db.delete(sessions).where(eq(sessions.teacherId, teacherId));
  await logAudit(admin, status === "suspended" ? "teacher.suspend" : "teacher.activate", { type: "teacher", id: target.id, label: target.email }, reason ? { reason } : undefined);
  revalidateAdmin();
  withMessage(back, "ok", status === "suspended" ? `${target.name} has been suspended and logged out.` : `${target.name} has been re-activated.`);
}

export async function setTeacherRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "teacher";
  const back = `/admin/teachers/${teacherId}`;
  if (teacherId === admin.id && role !== "admin") withMessage(back, "error", "You cannot remove your own administrator access.");
  const target = await loadTarget(teacherId);
  if (!target) redirect("/admin/teachers");
  if (role === "teacher") {
    const [{ cnt }] = await db.select({ cnt: count() }).from(teachers).where(and(eq(teachers.role, "admin"), eq(teachers.status, "active")));
    if (cnt <= 1 && target.role === "admin") withMessage(back, "error", "At least one active administrator is required.");
  }
  await db.update(teachers).set({ role, updatedAt: new Date() }).where(eq(teachers.id, teacherId));
  await logAudit(admin, role === "admin" ? "teacher.promote" : "teacher.demote", { type: "teacher", id: target.id, label: target.email });
  revalidateAdmin();
  withMessage(back, "ok", role === "admin" ? `${target.name} is now an administrator.` : `${target.name} no longer has administrator access.`);
}

export async function deleteTeacherAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  if (teacherId === admin.id) withMessage(`/admin/teachers/${teacherId}`, "error", "You cannot delete your own account.");
  const target = await loadTarget(teacherId);
  if (!target) redirect("/admin/teachers");
  const [{ cnt }] = await db.select({ cnt: count() }).from(quizzes).where(eq(quizzes.teacherId, teacherId));
  await db.delete(teachers).where(eq(teachers.id, teacherId));
  await logAudit(admin, "teacher.delete", { type: "teacher", id: target.id, label: target.email }, { name: target.name, quizzesRemoved: cnt });
  revalidateAdmin();
  withMessage("/admin/teachers", "ok", `${target.name} (${target.email}) and ${cnt} ${cnt === 1 ? "quiz" : "quizzes"} were deleted.`);
}

export interface CreateTeacherState {
  error?: string;
  success?: string;
  email?: string;
  tempPassword?: string;
  teacherId?: string;
}

function generateTempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = generateToken(24);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes.charCodeAt(i) % alphabet.length];
  return out;
}

export async function createTeacherAction(_prev: CreateTeacherState, formData: FormData): Promise<CreateTeacherState> {
  const admin = await requireAdmin();
  const providedPassword = String(formData.get("password") ?? "");
  const tempPassword = providedPassword || generateTempPassword();
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    school: formData.get("school") ?? "",
    password: tempPassword,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { name, email, school, password } = parsed.data;
  const role = formData.get("role") === "admin" ? "admin" : "teacher";

  const existing = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, email)).limit(1);
  if (existing.length) return { error: "An account with this email already exists." };

  const [created] = await db
    .insert(teachers)
    .values({ name, email, school: school || null, passwordHash: await hashPassword(password), role })
    .returning({ id: teachers.id });
  await logAudit(admin, "teacher.create", { type: "teacher", id: created.id, label: email }, { role, name });
  revalidateAdmin();
  return {
    success: `Account created for ${name}. Share the temporary password below — it is shown only once.`,
    email,
    tempPassword: providedPassword ? undefined : password,
    teacherId: created.id,
  };
}

export interface ResetLinkState {
  error?: string;
  link?: string;
}

export async function generateResetLinkAction(_prev: ResetLinkState, formData: FormData): Promise<ResetLinkState> {
  const admin = await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const target = await loadTarget(teacherId);
  if (!target) return { error: "Teacher not found." };
  const token = generateToken(32);
  await db.insert(passwordResetTokens).values({
    teacherId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await logAudit(admin, "teacher.reset_link", { type: "teacher", id: target.id, label: target.email });
  return { link: `${baseUrlFromHeaders(await headers())}/reset-password?token=${token}` };
}

// ---------------------------------------------------------------------------
// Quizzes & submissions
// ---------------------------------------------------------------------------
export async function adminSetQuizStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const quizId = String(formData.get("quizId") ?? "");
  const status = formData.get("status") === "published" ? "published" : "closed";
  const back = String(formData.get("redirectTo") ?? `/admin/quizzes/${quizId}`);
  const [quiz] = await db.select({ id: quizzes.id, title: quizzes.title, publicCode: quizzes.publicCode }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) redirect("/admin/quizzes");
  if (status === "published" && !quiz.publicCode) withMessage(back, "error", "This quiz has never been published by its teacher, so it cannot be reopened here.");
  await db.update(quizzes).set({ status, updatedAt: new Date() }).where(eq(quizzes.id, quizId));
  await logAudit(admin, status === "published" ? "quiz.reopen" : "quiz.close", { type: "quiz", id: quiz.id, label: quiz.title });
  revalidateAdmin();
  revalidatePath("/quizzes");
  withMessage(back, "ok", status === "published" ? `"${quiz.title}" has been reopened.` : `"${quiz.title}" has been closed. Students can no longer submit.`);
}

export async function adminDeleteQuizAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const quizId = String(formData.get("quizId") ?? "");
  const [quiz] = await db.select({ id: quizzes.id, title: quizzes.title, teacherId: quizzes.teacherId }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) redirect("/admin/quizzes");
  const [{ cnt }] = await db.select({ cnt: count() }).from(submissions).where(eq(submissions.quizId, quizId));
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  await logAudit(admin, "quiz.delete", { type: "quiz", id: quiz.id, label: quiz.title }, { teacherId: quiz.teacherId, submissionsRemoved: cnt });
  revalidateAdmin();
  revalidatePath("/quizzes");
  withMessage(String(formData.get("redirectTo") ?? "/admin/quizzes"), "ok", `"${quiz.title}" and ${cnt} ${cnt === 1 ? "submission" : "submissions"} were deleted.`);
}

export async function adminDeleteSubmissionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "");
  const back = String(formData.get("redirectTo") ?? "/admin/submissions");
  const [sub] = await db
    .select({ id: submissions.id, studentName: submissions.studentName, quizId: submissions.quizId, score: submissions.score, totalMarks: submissions.totalMarks })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!sub) redirect(back);
  await db.delete(submissions).where(eq(submissions.id, submissionId));
  await logAudit(admin, "submission.delete", { type: "submission", id: sub.id, label: sub.studentName || "Anonymous" }, { quizId: sub.quizId, score: `${sub.score}/${sub.totalMarks}` });
  revalidateAdmin();
  revalidatePath("/quizzes");
  withMessage(back, "ok", `Submission from ${sub.studentName || "an anonymous student"} was deleted.`);
}

// ---------------------------------------------------------------------------
// Platform settings & maintenance
// ---------------------------------------------------------------------------
export interface SettingsState {
  error?: string;
  success?: string;
}

export async function updatePlatformSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const announcement = String(formData.get("announcement") ?? "").trim().slice(0, 1000);
  const supportEmail = String(formData.get("supportEmail") ?? "").trim().slice(0, 200);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return { error: "Please enter a valid support email address." };
  const values = {
    allowSignups: formData.get("allowSignups") === "on",
    announcementEnabled: formData.get("announcementEnabled") === "on" && announcement.length > 0,
    announcement,
    maintenanceMode: formData.get("maintenanceMode") === "on",
    supportEmail,
  };
  await updatePlatformSettings(values, admin.id);
  await logAudit(admin, "settings.update", { type: "settings", id: "platform" }, values);
  revalidatePath("/", "layout");
  return { success: "Platform settings saved." };
}

export async function cleanupAttemptsAction(): Promise<void> {
  const admin = await requireAdmin();
  const removed = await deleteAbandonedAttempts(24);
  await logAudit(admin, "maintenance.cleanup_attempts", { type: "system" }, { removed });
  revalidateAdmin();
  withMessage("/admin/settings", "ok", `Removed ${removed} abandoned ${removed === 1 ? "attempt" : "attempts"} older than 24 hours.`);
}

export async function resetDemoDataAction(): Promise<void> {
  const admin = await requireAdmin();
  const { created } = await resetDemoData();
  await logAudit(admin, "maintenance.reset_demo", { type: "system" }, { quizzesCreated: created });
  revalidateAdmin();
  revalidatePath("/quizzes");
  withMessage("/admin/settings", "ok", `Demo data was reset (${created} demo quizzes re-created).`);
}
