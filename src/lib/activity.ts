import "server-only";
import { and, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, quizzes, teachers } from "@/db/schema";
import { ACTIVITY_GROUPS } from "@/lib/activity-labels";
import { PAGE_SIZE, type Paged } from "@/lib/admin";

type Actor = { id: string; name: string } | null;

/** Records a teacher activity. Never throws — logging must not break the user's action. */
export async function logActivity(
  teacher: Actor,
  action: string,
  target?: { quizId?: string | null; label?: string | null },
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      teacherId: teacher?.id ?? null,
      teacherName: teacher?.name ?? "",
      action,
      quizId: target?.quizId ?? null,
      targetLabel: target?.label ?? null,
      details: details ?? null,
    });
  } catch (err) {
    console.error("activity log failed", err);
  }
}

/** Autosave fires constantly, so "quiz.edit" is recorded at most once per 30 minutes per quiz. */
export async function logQuizEditThrottled(teacher: NonNullable<Actor>, quizId: string, title: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const [recent] = await db
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(and(eq(activityLogs.teacherId, teacher.id), eq(activityLogs.quizId, quizId), eq(activityLogs.action, "quiz.edit"), gte(activityLogs.createdAt, since)))
      .limit(1);
    if (recent) return;
  } catch {
    return;
  }
  await logActivity(teacher, "quiz.edit", { quizId, label: title });
}

export interface ActivityItem {
  id: string;
  teacherId: string | null;
  teacherName: string;
  teacherEmail: string | null;
  action: string;
  quizId: string | null;
  quizExists: boolean;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ActivityFilters {
  teacherId?: string;
  group?: string;
  q?: string;
  page?: number;
}

export async function listActivity(filters: ActivityFilters = {}): Promise<Paged<ActivityItem>> {
  const conds: SQL[] = [];
  if (filters.teacherId) conds.push(eq(activityLogs.teacherId, filters.teacherId));
  const group = ACTIVITY_GROUPS.find((g) => g.value && g.value === filters.group);
  if (group) conds.push(ilike(activityLogs.action, `${group.prefix}%`));
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    const c = or(ilike(activityLogs.targetLabel, like), ilike(activityLogs.teacherName, like), ilike(teachers.name, like), ilike(teachers.email, like), ilike(activityLogs.action, like));
    if (c) conds.push(c);
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = filters.page ?? 1;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        teacherId: activityLogs.teacherId,
        teacherName: sql<string>`coalesce(${teachers.name}, nullif(${activityLogs.teacherName}, ''), 'Deleted teacher')`,
        teacherEmail: teachers.email,
        action: activityLogs.action,
        quizId: activityLogs.quizId,
        quizExists: sql<boolean>`${quizzes.id} is not null`,
        targetLabel: activityLogs.targetLabel,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(teachers, eq(activityLogs.teacherId, teachers.id))
      .leftJoin(quizzes, eq(activityLogs.quizId, quizzes.id))
      .where(where)
      .orderBy(desc(activityLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(activityLogs).leftJoin(teachers, eq(activityLogs.teacherId, teachers.id)).where(where),
  ]);
  return { items: rows, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listTeacherOptions(): Promise<{ id: string; name: string; email: string }[]> {
  return db.select({ id: teachers.id, name: teachers.name, email: teachers.email }).from(teachers).orderBy(teachers.name);
}
