"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { quizzes, sessions, teachers } from "@/db/schema";
import { logActivity, logQuizEditThrottled } from "@/lib/activity";
import { SESSION_COOKIE, hashPassword, requireTeacher, verifyPassword } from "@/lib/auth";
import { createDemoQuizzes } from "@/lib/demo-data";
import {
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  publishQuiz,
  saveQuizPayload,
  setQuizStatus,
  setResultsReleased,
} from "@/lib/quizzes";
import { sha256 } from "@/lib/utils";
import { quizPayloadSchema } from "@/lib/validation";

function revalidateTeacherPages(quizId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/quizzes");
  revalidatePath("/results");
  if (quizId) revalidatePath(`/quizzes/${quizId}`, "layout");
}

/** Title of a quiz, only if it belongs to the given teacher (doubles as an ownership check). */
async function ownedTitle(quizId: string, teacherId: string): Promise<string | null> {
  const [row] = await db
    .select({ title: quizzes.title })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.teacherId, teacherId)))
    .limit(1);
  return row?.title ?? null;
}

// ---------------------------------------------------------------------------
// Quiz lifecycle
// ---------------------------------------------------------------------------
export interface FormState {
  error?: string;
  success?: string;
}

export async function createQuizAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Quiz title is required." };
  if (title.length > 200) return { error: "Quiz title is too long (max 200 characters)." };
  const id = await createQuiz(teacher.id, {
    title,
    subject: String(formData.get("subject") ?? ""),
    gradeLevel: String(formData.get("gradeLevel") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  await logActivity(teacher, "quiz.create", { quizId: id, label: title });
  revalidateTeacherPages();
  redirect(`/quizzes/${id}/edit`);
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string };

export async function saveQuizAction(quizId: string, payload: unknown): Promise<SaveResult> {
  const teacher = await requireTeacher();
  const parsed = quizPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid quiz data." };
  }
  try {
    const { updatedAt } = await saveQuizPayload(quizId, teacher.id, parsed.data);
    await logQuizEditThrottled(teacher, quizId, parsed.data.title || "Untitled Quiz");
    revalidateTeacherPages(quizId);
    return { ok: true, updatedAt: updatedAt.toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save quiz." };
  }
}

export type PublishResult = { ok: true; code: string } | { ok: false; errors: string[] };

export async function publishQuizAction(quizId: string): Promise<PublishResult> {
  const teacher = await requireTeacher();
  const result = await publishQuiz(quizId, teacher.id);
  if (result.ok) {
    await logActivity(teacher, "quiz.publish", { quizId, label: (await ownedTitle(quizId, teacher.id)) ?? undefined }, { code: result.code });
    revalidateTeacherPages(quizId);
  }
  return result;
}

/** Form-based publish used from list pages; redirects to the share screen or back to the editor. */
export async function publishFromFormAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const result = await publishQuiz(quizId, teacher.id);
  revalidateTeacherPages(quizId);
  if (result.ok) {
    await logActivity(teacher, "quiz.publish", { quizId, label: (await ownedTitle(quizId, teacher.id)) ?? undefined }, { code: result.code });
    redirect(`/quizzes/${quizId}/share?published=1`);
  }
  redirect(`/quizzes/${quizId}/edit?publishErrors=${encodeURIComponent(result.errors.join("\n"))}`);
}

export async function closeQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const title = await ownedTitle(quizId, teacher.id);
  await setQuizStatus(quizId, teacher.id, "closed");
  if (title) await logActivity(teacher, "quiz.close", { quizId, label: title });
  revalidateTeacherPages(quizId);
}

export async function reopenQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const result = await publishQuiz(quizId, teacher.id);
  revalidateTeacherPages(quizId);
  if (!result.ok) redirect(`/quizzes/${quizId}/edit?publishErrors=${encodeURIComponent(result.errors.join("\n"))}`);
  await logActivity(teacher, "quiz.reopen", { quizId, label: (await ownedTitle(quizId, teacher.id)) ?? undefined });
}

export async function unpublishQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const title = await ownedTitle(quizId, teacher.id);
  await setQuizStatus(quizId, teacher.id, "draft");
  if (title) await logActivity(teacher, "quiz.unpublish", { quizId, label: title });
  revalidateTeacherPages(quizId);
}

export async function duplicateQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const title = await ownedTitle(quizId, teacher.id);
  const newId = await duplicateQuiz(quizId, teacher.id);
  revalidateTeacherPages();
  if (newId) {
    await logActivity(teacher, "quiz.duplicate", { quizId: newId, label: title ?? undefined }, { copyTitle: title ? `${title} - Version 2` : undefined });
    redirect(`/quizzes/${newId}/edit?duplicated=1`);
  }
}

export async function deleteQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const title = await ownedTitle(quizId, teacher.id);
  await deleteQuiz(quizId, teacher.id);
  if (title) await logActivity(teacher, "quiz.delete", { quizId, label: title });
  revalidateTeacherPages();
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (redirectTo) redirect(redirectTo);
}

export async function toggleResultsReleasedAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const released = String(formData.get("released") ?? "") === "true";
  const title = await ownedTitle(quizId, teacher.id);
  await setResultsReleased(quizId, teacher.id, released);
  if (title) await logActivity(teacher, released ? "results.release" : "results.hide", { quizId, label: title });
  revalidateTeacherPages(quizId);
}

export async function loadDemoQuizzesAction(): Promise<void> {
  const teacher = await requireTeacher();
  await createDemoQuizzes(teacher.id);
  revalidateTeacherPages();
  redirect("/quizzes");
}

// ---------------------------------------------------------------------------
// Profile & password (available to teachers and administrators)
// ---------------------------------------------------------------------------
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (teacher.isDemo) return { error: "The shared demo account cannot be edited." };
  const name = String(formData.get("name") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  if (name.length < 2) return { error: "Please enter your name." };
  await db.update(teachers).set({ name, school: school || null, updatedAt: new Date() }).where(eq(teachers.id, teacher.id));
  await logActivity({ id: teacher.id, name }, "account.profile_updated");
  revalidatePath("/", "layout");
  return { success: "Profile updated." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (teacher.isDemo) return { error: "The shared demo account password cannot be changed." };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!current) return { error: "Please enter your current password." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next.length > 200) return { error: "New password is too long." };
  if (next !== confirm) return { error: "New passwords do not match." };
  if (next === current) return { error: "Your new password must be different from the current one." };
  const [row] = await db.select({ hash: teachers.passwordHash }).from(teachers).where(eq(teachers.id, teacher.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.hash))) return { error: "Current password is incorrect." };

  await db
    .update(teachers)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(teachers.id, teacher.id));

  // Sign out every other device; keep the current session.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(and(eq(sessions.teacherId, teacher.id), ne(sessions.tokenHash, sha256(token))));
  }
  await logActivity(teacher, "account.password_changed");
  revalidatePath("/", "layout");
  return { success: "Password changed successfully. You have been signed out of your other devices." };
}
