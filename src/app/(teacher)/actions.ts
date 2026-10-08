"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { hashPassword, requireTeacher, verifyPassword } from "@/lib/auth";
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
import { quizPayloadSchema } from "@/lib/validation";

function revalidateTeacherPages(quizId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/quizzes");
  revalidatePath("/results");
  if (quizId) revalidatePath(`/quizzes/${quizId}`, "layout");
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
  if (result.ok) revalidateTeacherPages(quizId);
  return result;
}

/** Form-based publish used from list pages; redirects to the share screen or back to the editor. */
export async function publishFromFormAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const result = await publishQuiz(quizId, teacher.id);
  revalidateTeacherPages(quizId);
  if (result.ok) redirect(`/quizzes/${quizId}/share?published=1`);
  redirect(`/quizzes/${quizId}/edit?publishErrors=${encodeURIComponent(result.errors.join("\n"))}`);
}

export async function closeQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  await setQuizStatus(quizId, teacher.id, "closed");
  revalidateTeacherPages(quizId);
}

export async function reopenQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const result = await publishQuiz(quizId, teacher.id);
  revalidateTeacherPages(quizId);
  if (!result.ok) redirect(`/quizzes/${quizId}/edit?publishErrors=${encodeURIComponent(result.errors.join("\n"))}`);
}

export async function unpublishQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  await setQuizStatus(quizId, teacher.id, "draft");
  revalidateTeacherPages(quizId);
}

export async function duplicateQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const newId = await duplicateQuiz(quizId, teacher.id);
  revalidateTeacherPages();
  if (newId) redirect(`/quizzes/${newId}/edit?duplicated=1`);
}

export async function deleteQuizAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  await deleteQuiz(quizId, teacher.id);
  revalidateTeacherPages();
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (redirectTo) redirect(redirectTo);
}

export async function toggleResultsReleasedAction(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const quizId = String(formData.get("quizId") ?? "");
  const released = String(formData.get("released") ?? "") === "true";
  await setResultsReleased(quizId, teacher.id, released);
  revalidateTeacherPages(quizId);
}

export async function loadDemoQuizzesAction(): Promise<void> {
  const teacher = await requireTeacher();
  await createDemoQuizzes(teacher.id);
  revalidateTeacherPages();
  redirect("/quizzes");
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (teacher.isDemo) return { error: "The shared demo account cannot be edited." };
  const name = String(formData.get("name") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  if (name.length < 2) return { error: "Please enter your name." };
  await db.update(teachers).set({ name, school: school || null, updatedAt: new Date() }).where(eq(teachers.id, teacher.id));
  revalidatePath("/", "layout");
  return { success: "Profile updated." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (teacher.isDemo) return { error: "The shared demo account password cannot be changed." };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };
  const [row] = await db.select({ hash: teachers.passwordHash }).from(teachers).where(eq(teachers.id, teacher.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.hash))) return { error: "Current password is incorrect." };
  await db.update(teachers).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(teachers.id, teacher.id));
  return { success: "Password changed successfully." };
}
