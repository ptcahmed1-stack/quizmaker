import "server-only";
import { and, avg, count, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { options, questions, quizSettings, quizzes, submissions, teachers } from "@/db/schema";
import { getQuizForAdmin, uniquePublicCode } from "@/lib/quizzes";
import { validateForPublish } from "@/lib/validation";

export interface AssignOptions {
  lockContent: boolean;
  publishNow: boolean;
}

export type AssignResult =
  | { ok: true; title: string; created: { teacherId: string; teacherName: string; quizId: string }[]; skipped: string[] }
  | { ok: false; errors: string[] };

/**
 * Gives each selected teacher their own copy of a quiz. Every copy has its own public link and its own
 * submissions, which is what keeps each teacher's student results private to that teacher.
 */
export async function assignQuizToTeachers(
  sourceId: string,
  teacherIds: string[],
  opts: AssignOptions,
  adminId: string,
): Promise<AssignResult> {
  const source = await getQuizForAdmin(sourceId);
  if (!source) return { ok: false, errors: ["Quiz not found."] };
  if (source.questions.length === 0) return { ok: false, errors: ["Add at least one question to this quiz before assigning it."] };
  if (opts.publishNow) {
    const errors = validateForPublish(source);
    if (errors.length) return { ok: false, errors: ["Fix the quiz before publishing it for teachers:", ...errors] };
  }

  const targets = teacherIds.length
    ? await db.select({ id: teachers.id, name: teachers.name, status: teachers.status }).from(teachers).where(inArray(teachers.id, teacherIds))
    : [];
  const eligible = targets.filter((t) => t.status === "active" && t.id !== source.teacherId);
  if (eligible.length === 0) return { ok: false, errors: ["Select at least one active teacher."] };

  const existing = await db
    .select({ teacherId: quizzes.teacherId })
    .from(quizzes)
    .where(and(eq(quizzes.sourceQuizId, sourceId), inArray(quizzes.teacherId, eligible.map((t) => t.id))));
  const already = new Set(existing.map((e) => e.teacherId));

  const created: { teacherId: string; teacherName: string; quizId: string }[] = [];
  const skipped: string[] = [];
  const { quizId: _sourceSettingsId, ...settingsRest } = source.settings;
  void _sourceSettingsId;

  for (const teacher of eligible) {
    if (already.has(teacher.id)) {
      skipped.push(teacher.name);
      continue;
    }
    let code: string | null = null;
    if (opts.publishNow) {
      code = await uniquePublicCode();
      if (!code) return { ok: false, errors: ["Could not generate a unique quiz code. Please try again."] };
    }
    const now = new Date();
    const quizId = await db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(quizzes)
        .values({
          teacherId: teacher.id,
          title: source.title,
          description: source.description,
          subject: source.subject,
          gradeLevel: source.gradeLevel,
          instructions: source.instructions,
          status: opts.publishNow ? "published" : "draft",
          publicCode: code,
          publishedAt: opts.publishNow ? now : null,
          timeLimitMinutes: source.timeLimitMinutes,
          passingPercentage: source.passingPercentage,
          isDemo: false,
          sourceQuizId: source.id,
          assignedById: adminId,
          assignedAt: now,
          lockedContent: opts.lockContent,
        })
        .returning({ id: quizzes.id });
      await tx.insert(quizSettings).values({ ...settingsRest, quizId: copy.id });
      for (const q of source.questions) {
        const [nq] = await tx
          .insert(questions)
          .values({ quizId: copy.id, type: q.type, text: q.text, marks: q.marks, explanation: q.explanation, expectedAnswer: q.expectedAnswer, position: q.position })
          .returning({ id: questions.id });
        if (q.options.length) {
          await tx.insert(options).values(q.options.map((o) => ({ questionId: nq.id, text: o.text, isCorrect: o.isCorrect, position: o.position })));
        }
      }
      return copy.id;
    });
    created.push({ teacherId: teacher.id, teacherName: teacher.name, quizId });
  }
  return { ok: true, title: source.title, created, skipped };
}

export interface CopyRow {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherStatus: "active" | "suspended";
  status: "draft" | "published" | "closed";
  publicCode: string | null;
  lockedContent: boolean;
  assignedAt: Date | null;
  attempts: number;
  averagePercentage: number | null;
  passRate: number | null;
  lastSubmissionAt: Date | null;
}

/** All teacher copies of a source quiz with their results. */
export async function listCopies(sourceId: string): Promise<CopyRow[]> {
  const rows = await db
    .select({
      id: quizzes.id,
      teacherId: quizzes.teacherId,
      teacherName: teachers.name,
      teacherEmail: teachers.email,
      teacherStatus: teachers.status,
      status: quizzes.status,
      publicCode: quizzes.publicCode,
      lockedContent: quizzes.lockedContent,
      assignedAt: quizzes.assignedAt,
    })
    .from(quizzes)
    .innerJoin(teachers, eq(quizzes.teacherId, teachers.id))
    .where(eq(quizzes.sourceQuizId, sourceId))
    .orderBy(teachers.name);
  if (rows.length === 0) return [];
  const stats = await db
    .select({
      quizId: submissions.quizId,
      attempts: count(),
      avgPct: avg(submissions.percentage),
      passed: sql<number>`count(*) filter (where ${submissions.passed})`.mapWith(Number),
      last: max(submissions.submittedAt),
    })
    .from(submissions)
    .where(and(inArray(submissions.quizId, rows.map((r) => r.id)), eq(submissions.status, "submitted")))
    .groupBy(submissions.quizId);
  const byQuiz = new Map(stats.map((s) => [s.quizId, s]));
  return rows.map((r) => {
    const s = byQuiz.get(r.id);
    return {
      ...r,
      attempts: s?.attempts ?? 0,
      averagePercentage: s?.avgPct != null ? Number(s.avgPct) : null,
      passRate: s && s.attempts > 0 ? (s.passed / s.attempts) * 100 : null,
      lastSubmissionAt: s?.last ?? null,
    };
  });
}

export interface AssignableTeacher {
  id: string;
  name: string;
  email: string;
  school: string | null;
}

export async function listAssignableTeachers(excludeTeacherId: string): Promise<AssignableTeacher[]> {
  const rows = await db
    .select({ id: teachers.id, name: teachers.name, email: teachers.email, school: teachers.school })
    .from(teachers)
    .where(and(eq(teachers.status, "active"), eq(teachers.isDemo, false)))
    .orderBy(teachers.name);
  return rows.filter((r) => r.id !== excludeTeacherId);
}

export interface TemplateRow {
  id: string;
  title: string;
  subject: string;
  ownerName: string;
  createdAt: Date;
  copies: number;
  publishedCopies: number;
  attempts: number;
  averagePercentage: number | null;
  passRate: number | null;
}

/** Quizzes that have been assigned to teachers, with combined results across all copies. */
export async function listTemplates(): Promise<TemplateRow[]> {
  const copyStats = await db
    .select({
      sourceId: quizzes.sourceQuizId,
      copies: count(),
      published: sql<number>`count(*) filter (where ${quizzes.status} = 'published')`.mapWith(Number),
    })
    .from(quizzes)
    .where(isNotNull(quizzes.sourceQuizId))
    .groupBy(quizzes.sourceQuizId);
  const sourceIds = copyStats.map((c) => c.sourceId).filter((v): v is string => Boolean(v));
  if (sourceIds.length === 0) return [];

  const [sources, subStats] = await Promise.all([
    db
      .select({ id: quizzes.id, title: quizzes.title, subject: quizzes.subject, createdAt: quizzes.createdAt, ownerName: teachers.name })
      .from(quizzes)
      .innerJoin(teachers, eq(quizzes.teacherId, teachers.id))
      .where(inArray(quizzes.id, sourceIds)),
    db
      .select({
        sourceId: quizzes.sourceQuizId,
        attempts: count(),
        avgPct: avg(submissions.percentage),
        passed: sql<number>`count(*) filter (where ${submissions.passed})`.mapWith(Number),
      })
      .from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
      .where(and(inArray(quizzes.sourceQuizId, sourceIds), eq(submissions.status, "submitted")))
      .groupBy(quizzes.sourceQuizId),
  ]);
  const copyMap = new Map(copyStats.map((c) => [c.sourceId, c]));
  const subMap = new Map(subStats.map((s) => [s.sourceId, s]));
  return sources
    .map((s) => {
      const c = copyMap.get(s.id);
      const st = subMap.get(s.id);
      return {
        ...s,
        copies: c?.copies ?? 0,
        publishedCopies: c?.published ?? 0,
        attempts: st?.attempts ?? 0,
        averagePercentage: st?.avgPct != null ? Number(st.avgPct) : null,
        passRate: st && st.attempts > 0 ? (st.passed / st.attempts) * 100 : null,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
