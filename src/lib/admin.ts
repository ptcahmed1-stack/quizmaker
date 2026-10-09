import "server-only";
import { and, avg, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  auditLogs,
  platformSettings,
  quizzes,
  questions,
  submissions,
  teachers,
  type PlatformSettings,
  type Teacher,
} from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const ADMIN_EMAIL = "admin@quizmaker.app";
export const DEFAULT_ADMIN_PASSWORD = "admin1234";
export const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
/** Guarantees that at least one administrator account exists. */
export async function ensureAdminAccount(): Promise<void> {
  const [existing] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.role, "admin")).limit(1);
  if (existing) return;
  const [byEmail] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, ADMIN_EMAIL)).limit(1);
  if (byEmail) {
    await db.update(teachers).set({ role: "admin", status: "active" }).where(eq(teachers.id, byEmail.id));
    return;
  }
  await db
    .insert(teachers)
    .values({
      name: "Platform Admin",
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD),
      school: "QuizMaker",
      role: "admin",
    })
    .onConflictDoNothing();
}

/** True when the built-in admin account still uses the default password. */
export async function isDefaultAdminPasswordInUse(): Promise<boolean> {
  const [admin] = await db
    .select({ hash: teachers.passwordHash })
    .from(teachers)
    .where(and(eq(teachers.email, ADMIN_EMAIL), eq(teachers.role, "admin")))
    .limit(1);
  if (!admin) return false;
  return verifyPassword(DEFAULT_ADMIN_PASSWORD, admin.hash);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export type AuditActor = { id: string; email: string } | null;

export async function logAudit(
  actor: AuditActor,
  action: string,
  target?: { type: string; id?: string | null; label?: string | null },
  details?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? "system",
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    targetLabel: target?.label ?? null,
    details: details ?? null,
  });
}

// ---------------------------------------------------------------------------
// Platform settings (single row)
// ---------------------------------------------------------------------------
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
  if (row) return row;
  await db.insert(platformSettings).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
  return created;
});

export type PlatformSettingsInput = Pick<
  PlatformSettings,
  "allowSignups" | "announcementEnabled" | "announcement" | "maintenanceMode" | "supportEmail"
>;

export async function updatePlatformSettings(values: PlatformSettingsInput, updatedById: string): Promise<void> {
  const set = { ...values, updatedAt: new Date(), updatedById };
  await db
    .insert(platformSettings)
    .values({ id: 1, ...set })
    .onConflictDoUpdate({ target: platformSettings.id, set });
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function paged<T>(items: T[], total: number, page: number): Paged<T> {
  return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
export interface PlatformStats {
  teachers: number;
  admins: number;
  suspended: number;
  newTeachers7d: number;
  newTeachers30d: number;
  quizzes: number;
  published: number;
  drafts: number;
  closed: number;
  questions: number;
  submissions: number;
  submissions7d: number;
  submissions30d: number;
  inProgress: number;
  abandoned: number;
  averagePercentage: number | null;
  passRate: number | null;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [[t], [q], [qc], [s]] = await Promise.all([
    db
      .select({
        total: count(),
        admins: sql<number>`count(*) filter (where ${teachers.role} = 'admin')`.mapWith(Number),
        suspended: sql<number>`count(*) filter (where ${teachers.status} = 'suspended')`.mapWith(Number),
        new7: sql<number>`count(*) filter (where ${teachers.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        new30: sql<number>`count(*) filter (where ${teachers.createdAt} >= now() - interval '30 days')`.mapWith(Number),
      })
      .from(teachers),
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${quizzes.status} = 'published')`.mapWith(Number),
        drafts: sql<number>`count(*) filter (where ${quizzes.status} = 'draft')`.mapWith(Number),
        closed: sql<number>`count(*) filter (where ${quizzes.status} = 'closed')`.mapWith(Number),
      })
      .from(quizzes),
    db.select({ total: count() }).from(questions),
    db
      .select({
        submitted: sql<number>`count(*) filter (where ${submissions.status} = 'submitted')`.mapWith(Number),
        last7: sql<number>`count(*) filter (where ${submissions.status} = 'submitted' and ${submissions.submittedAt} >= now() - interval '7 days')`.mapWith(Number),
        last30: sql<number>`count(*) filter (where ${submissions.status} = 'submitted' and ${submissions.submittedAt} >= now() - interval '30 days')`.mapWith(Number),
        inProgress: sql<number>`count(*) filter (where ${submissions.status} = 'in_progress')`.mapWith(Number),
        abandoned: sql<number>`count(*) filter (where ${submissions.status} = 'in_progress' and ${submissions.startedAt} < now() - interval '24 hours')`.mapWith(Number),
        avgPct: sql<string | null>`avg(${submissions.percentage}) filter (where ${submissions.status} = 'submitted')`,
        passed: sql<number>`count(*) filter (where ${submissions.status} = 'submitted' and ${submissions.passed})`.mapWith(Number),
      })
      .from(submissions),
  ]);
  return {
    teachers: t.total,
    admins: t.admins,
    suspended: t.suspended,
    newTeachers7d: t.new7,
    newTeachers30d: t.new30,
    quizzes: q.total,
    published: q.published,
    drafts: q.drafts,
    closed: q.closed,
    questions: qc.total,
    submissions: s.submitted,
    submissions7d: s.last7,
    submissions30d: s.last30,
    inProgress: s.inProgress,
    abandoned: s.abandoned,
    averagePercentage: s.avgPct != null ? Number(s.avgPct) : null,
    passRate: s.submitted > 0 ? (s.passed / s.submitted) * 100 : null,
  };
}

export interface DailyPoint {
  day: string;
  label: string;
  submissions: number;
  signups: number;
}

export async function getDailyActivity(days = 14): Promise<DailyPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const subDay = sql<string>`to_char(${submissions.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const teacherDay = sql<string>`to_char(${teachers.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const [subs, signups] = await Promise.all([
    db
      .select({ day: subDay, cnt: count() })
      .from(submissions)
      .where(and(eq(submissions.status, "submitted"), gte(submissions.submittedAt, since)))
      .groupBy(subDay),
    db.select({ day: teacherDay, cnt: count() }).from(teachers).where(gte(teachers.createdAt, since)).groupBy(teacherDay),
  ]);
  const subMap = new Map(subs.map((r) => [r.day, r.cnt]));
  const signMap = new Map(signups.map((r) => [r.day, r.cnt]));
  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push({
      day: key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      submissions: subMap.get(key) ?? 0,
      signups: signMap.get(key) ?? 0,
    });
  }
  return out;
}

export async function getTopQuizzes(limit = 5) {
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      teacherName: teachers.name,
      attempts: count(submissions.id),
      averagePercentage: avg(submissions.percentage),
    })
    .from(quizzes)
    .innerJoin(teachers, eq(quizzes.teacherId, teachers.id))
    .innerJoin(submissions, and(eq(submissions.quizId, quizzes.id), eq(submissions.status, "submitted")))
    .groupBy(quizzes.id, teachers.name)
    .orderBy(desc(count(submissions.id)))
    .limit(limit);
}

export async function getMostActiveTeachers(limit = 5) {
  return db
    .select({
      id: teachers.id,
      name: teachers.name,
      email: teachers.email,
      quizCount: sql<number>`count(distinct ${quizzes.id})`.mapWith(Number),
      attempts: count(submissions.id),
    })
    .from(teachers)
    .innerJoin(quizzes, eq(quizzes.teacherId, teachers.id))
    .innerJoin(submissions, and(eq(submissions.quizId, quizzes.id), eq(submissions.status, "submitted")))
    .groupBy(teachers.id)
    .orderBy(desc(count(submissions.id)))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
export interface TeacherListItem {
  id: string;
  name: string;
  email: string;
  school: string | null;
  role: Teacher["role"];
  status: Teacher["status"];
  isDemo: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  quizCount: number;
  submissionCount: number;
}

export interface TeacherListFilters {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
}

export async function listTeachers(filters: TeacherListFilters = {}): Promise<Paged<TeacherListItem>> {
  const conds: SQL[] = [];
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const c = or(ilike(teachers.name, like), ilike(teachers.email, like), ilike(teachers.school, like));
    if (c) conds.push(c);
  }
  if (filters.role === "admin" || filters.role === "teacher") conds.push(eq(teachers.role, filters.role));
  if (filters.status === "active" || filters.status === "suspended") conds.push(eq(teachers.status, filters.status));
  const where = conds.length ? and(...conds) : undefined;
  const page = filters.page ?? 1;

  const qc = db
    .select({ teacherId: quizzes.teacherId, quizCount: count().as("quiz_count") })
    .from(quizzes)
    .groupBy(quizzes.teacherId)
    .as("qc");
  const sc = db
    .select({ teacherId: quizzes.teacherId, subCount: count().as("sub_count") })
    .from(submissions)
    .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
    .where(eq(submissions.status, "submitted"))
    .groupBy(quizzes.teacherId)
    .as("sc");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: teachers.id,
        name: teachers.name,
        email: teachers.email,
        school: teachers.school,
        role: teachers.role,
        status: teachers.status,
        isDemo: teachers.isDemo,
        createdAt: teachers.createdAt,
        lastLoginAt: teachers.lastLoginAt,
        quizCount: sql<number>`coalesce(${qc.quizCount}, 0)`.mapWith(Number),
        submissionCount: sql<number>`coalesce(${sc.subCount}, 0)`.mapWith(Number),
      })
      .from(teachers)
      .leftJoin(qc, eq(qc.teacherId, teachers.id))
      .leftJoin(sc, eq(sc.teacherId, teachers.id))
      .where(where)
      .orderBy(desc(teachers.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(teachers).where(where),
  ]);
  return paged(rows, total, page);
}

export async function listAllTeachersForExport() {
  const result = await listTeachers({ page: 1 });
  if (result.totalPages <= 1) return result.items;
  const all = [...result.items];
  for (let p = 2; p <= result.totalPages; p++) {
    all.push(...(await listTeachers({ page: p })).items);
  }
  return all;
}

export async function getTeacherById(id: string): Promise<Omit<Teacher, "passwordHash"> | null> {
  const [row] = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      email: teachers.email,
      school: teachers.school,
      role: teachers.role,
      status: teachers.status,
      mustChangePassword: teachers.mustChangePassword,
      isDemo: teachers.isDemo,
      lastLoginAt: teachers.lastLoginAt,
      suspendedAt: teachers.suspendedAt,
      suspendedReason: teachers.suspendedReason,
      createdAt: teachers.createdAt,
      updatedAt: teachers.updatedAt,
    })
    .from(teachers)
    .where(eq(teachers.id, id))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Quizzes (all teachers)
// ---------------------------------------------------------------------------
export interface AdminQuizItem {
  id: string;
  title: string;
  subject: string;
  status: "draft" | "published" | "closed";
  publicCode: string | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  questionCount: number;
  attempts: number;
  averagePercentage: number | null;
}

export interface QuizListFilters {
  q?: string;
  status?: string;
  teacherId?: string;
  page?: number;
}

export async function listAllQuizzes(filters: QuizListFilters = {}): Promise<Paged<AdminQuizItem>> {
  const conds: SQL[] = [];
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const c = or(ilike(quizzes.title, like), ilike(quizzes.subject, like), ilike(teachers.name, like), ilike(teachers.email, like), ilike(quizzes.publicCode, like));
    if (c) conds.push(c);
  }
  if (filters.status === "draft" || filters.status === "published" || filters.status === "closed") conds.push(eq(quizzes.status, filters.status));
  if (filters.teacherId) conds.push(eq(quizzes.teacherId, filters.teacherId));
  const where = conds.length ? and(...conds) : undefined;
  const page = filters.page ?? 1;

  const qc = db
    .select({ quizId: questions.quizId, questionCount: count().as("question_count") })
    .from(questions)
    .groupBy(questions.quizId)
    .as("qqc");
  const sc = db
    .select({ quizId: submissions.quizId, attempts: count().as("attempts"), avgPct: avg(submissions.percentage).as("avg_pct") })
    .from(submissions)
    .where(eq(submissions.status, "submitted"))
    .groupBy(submissions.quizId)
    .as("qsc");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subject: quizzes.subject,
        status: quizzes.status,
        publicCode: quizzes.publicCode,
        isDemo: quizzes.isDemo,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        teacherId: quizzes.teacherId,
        teacherName: teachers.name,
        teacherEmail: teachers.email,
        questionCount: sql<number>`coalesce(${qc.questionCount}, 0)`.mapWith(Number),
        attempts: sql<number>`coalesce(${sc.attempts}, 0)`.mapWith(Number),
        avgPct: sc.avgPct,
      })
      .from(quizzes)
      .innerJoin(teachers, eq(quizzes.teacherId, teachers.id))
      .leftJoin(qc, eq(qc.quizId, quizzes.id))
      .leftJoin(sc, eq(sc.quizId, quizzes.id))
      .where(where)
      .orderBy(desc(quizzes.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(quizzes).innerJoin(teachers, eq(quizzes.teacherId, teachers.id)).where(where),
  ]);
  return paged(
    rows.map(({ avgPct, ...r }) => ({ ...r, averagePercentage: avgPct != null ? Number(avgPct) : null })),
    total,
    page,
  );
}

// ---------------------------------------------------------------------------
// Submissions (all quizzes)
// ---------------------------------------------------------------------------
export interface AdminSubmissionItem {
  id: string;
  studentName: string;
  studentIdentifier: string;
  attemptNumber: number;
  status: "in_progress" | "submitted";
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  isLate: boolean;
  timeTakenSeconds: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  quizId: string;
  quizTitle: string;
  teacherId: string;
  teacherName: string;
}

export interface SubmissionListFilters {
  q?: string;
  status?: string;
  quizId?: string;
  teacherId?: string;
  page?: number;
}

export async function listSubmissions(filters: SubmissionListFilters = {}): Promise<Paged<AdminSubmissionItem>> {
  const conds: SQL[] = [];
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const c = or(ilike(submissions.studentName, like), ilike(submissions.studentIdentifier, like), ilike(quizzes.title, like), ilike(teachers.name, like));
    if (c) conds.push(c);
  }
  if (filters.status === "submitted" || filters.status === "in_progress") conds.push(eq(submissions.status, filters.status));
  if (filters.quizId) conds.push(eq(submissions.quizId, filters.quizId));
  if (filters.teacherId) conds.push(eq(quizzes.teacherId, filters.teacherId));
  const where = conds.length ? and(...conds) : undefined;
  const page = filters.page ?? 1;
  const base = () =>
    db
      .select({
        id: submissions.id,
        studentName: submissions.studentName,
        studentIdentifier: submissions.studentIdentifier,
        attemptNumber: submissions.attemptNumber,
        status: submissions.status,
        score: submissions.score,
        totalMarks: submissions.totalMarks,
        percentage: submissions.percentage,
        passed: submissions.passed,
        isLate: submissions.isLate,
        timeTakenSeconds: submissions.timeTakenSeconds,
        startedAt: submissions.startedAt,
        submittedAt: submissions.submittedAt,
        quizId: submissions.quizId,
        quizTitle: quizzes.title,
        teacherId: quizzes.teacherId,
        teacherName: teachers.name,
      })
      .from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
      .innerJoin(teachers, eq(quizzes.teacherId, teachers.id));

  const [rows, [{ total }]] = await Promise.all([
    base()
      .where(where)
      .orderBy(desc(sql`coalesce(${submissions.submittedAt}, ${submissions.startedAt})`))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
      .innerJoin(teachers, eq(quizzes.teacherId, teachers.id))
      .where(where),
  ]);
  return paged(rows, total, page);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export interface AuditItem {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export async function listAuditLogs(filters: { q?: string; targetId?: string; page?: number } = {}): Promise<Paged<AuditItem>> {
  const conds: SQL[] = [];
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const c = or(ilike(auditLogs.action, like), ilike(auditLogs.actorEmail, like), ilike(auditLogs.targetLabel, like));
    if (c) conds.push(c);
  }
  if (filters.targetId) {
    const c = or(eq(auditLogs.targetId, filters.targetId), eq(auditLogs.actorId, filters.targetId));
    if (c) conds.push(c);
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = filters.page ?? 1;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorEmail: auditLogs.actorEmail,
        actorName: teachers.name,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        targetLabel: auditLogs.targetLabel,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(teachers, eq(auditLogs.actorId, teachers.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);
  return paged(rows, total, page);
}

// ---------------------------------------------------------------------------
// Maintenance tools
// ---------------------------------------------------------------------------
/** Deletes unfinished attempts that were started more than `hours` ago. Returns the number removed. */
export async function deleteAbandonedAttempts(hours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const deleted = await db
    .delete(submissions)
    .where(and(eq(submissions.status, "in_progress"), lt(submissions.startedAt, cutoff)))
    .returning({ id: submissions.id });
  return deleted.length;
}

export async function countAbandonedAttempts(hours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [row] = await db
    .select({ cnt: count() })
    .from(submissions)
    .where(and(eq(submissions.status, "in_progress"), lt(submissions.startedAt, cutoff)));
  return row?.cnt ?? 0;
}
