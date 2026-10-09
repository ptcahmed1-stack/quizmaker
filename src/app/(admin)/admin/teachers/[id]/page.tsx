import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTeacherAction, setTeacherRoleAction, setTeacherStatusAction } from "@/app/(admin)/actions";
import { ResetLinkForm, SetPasswordForm, SuspendForm } from "@/components/admin/forms";
import { AccountStatusBadge, ActionLabel, FlashMessages, MiniStat, RoleBadge, SectionCard } from "@/components/admin/widgets";
import { ConfirmForm, SubmitButton } from "@/components/client-bits";
import { Badge, Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { activityMeta, describeActivity } from "@/lib/activity-labels";
import { getTeacherById, listAuditLogs, listSubmissions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPercent } from "@/lib/format";
import { listQuizzesForTeacher } from "@/lib/quizzes";

export const metadata: Metadata = { title: "Teacher · Admin" };

export default async function AdminTeacherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const teacher = await getTeacherById(id);
  if (!teacher) notFound();
  const [quizzes, submissions, audit, activity] = await Promise.all([
    listQuizzesForTeacher(id),
    listSubmissions({ teacherId: id, status: "submitted", page: 1 }),
    listAuditLogs({ targetId: id, page: 1 }),
    listActivity({ teacherId: id, page: 1 }),
  ]);
  const isSelf = teacher.id === admin.id;
  const totalAttempts = quizzes.reduce((s, q) => s + q.attempts, 0);
  const weighted = quizzes.filter((q) => q.averagePercentage !== null && q.attempts > 0);
  const avg = weighted.length ? weighted.reduce((s, q) => s + (q.averagePercentage ?? 0) * q.attempts, 0) / Math.max(1, weighted.reduce((s, q) => s + q.attempts, 0)) : null;

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/admin/teachers" className="hover:text-indigo-600">Teachers</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {teacher.name} <RoleBadge role={teacher.role} /> <AccountStatusBadge status={teacher.status} />
            {teacher.isDemo && <Badge tone="blue">Demo</Badge>}
            {isSelf && <Badge tone="indigo">You</Badge>}
          </span>
        }
        description={
          <span>
            {teacher.email}
            {teacher.school ? ` · ${teacher.school}` : ""} · Joined {formatDateTime(teacher.createdAt)} · Last login {teacher.lastLoginAt ? formatDateTime(teacher.lastLoginAt) : "never"}
          </span>
        }
        actions={<LinkButton href={`/admin/quizzes?teacherId=${teacher.id}`} variant="outline">All quizzes</LinkButton>}
      />
      <FlashMessages ok={sp.ok} error={sp.error} />

      {teacher.status === "suspended" && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">This account is suspended{teacher.suspendedAt ? ` since ${formatDateTime(teacher.suspendedAt)}` : ""}.</p>
          <p>{teacher.suspendedReason ? `Reason: ${teacher.suspendedReason}` : "No reason was recorded."} The teacher cannot log in and their published quizzes are unavailable to students.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Quizzes" value={quizzes.length} hint={`${quizzes.filter((q) => q.status === "published").length} published`} />
        <MiniStat label="Student submissions" value={totalAttempts} tone="indigo" />
        <MiniStat label="Average score" value={formatPercent(avg)} tone="green" />
        <MiniStat label="Questions written" value={quizzes.reduce((s, q) => s + q.questionCount, 0)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Quizzes" description="Every quiz owned by this teacher.">
            {quizzes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">This teacher has not created any quizzes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3">Quiz</th>
                      <th scope="col" className="px-3 py-3">Status</th>
                      <th scope="col" className="px-3 py-3">Questions</th>
                      <th scope="col" className="px-3 py-3">Attempts</th>
                      <th scope="col" className="px-3 py-3">Average</th>
                      <th scope="col" className="px-5 py-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quizzes.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <Link href={`/admin/quizzes/${q.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{q.title}</Link>
                          <div className="text-xs text-slate-500">{q.subject || "No subject"}{q.publicCode ? ` · ${q.publicCode}` : ""}</div>
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={q.status} /></td>
                        <td className="px-3 py-3 text-slate-700">{q.questionCount}</td>
                        <td className="px-3 py-3 text-slate-700">{q.attempts}</td>
                        <td className="px-3 py-3 text-slate-700">{formatPercent(q.averagePercentage)}</td>
                        <td className="px-5 py-3 text-right text-slate-500">{formatDateTime(q.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent submissions" action={<Link href={`/admin/submissions?teacherId=${teacher.id}`} className="text-sm font-medium text-indigo-600 hover:underline">View all</Link>}>
            {submissions.items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No student submissions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {submissions.items.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admin/submissions/${s.id}`} className="block truncate font-semibold text-slate-900 hover:text-indigo-600">{s.studentName || "Anonymous"}{s.studentIdentifier ? ` (${s.studentIdentifier})` : ""}</Link>
                      <p className="truncate text-xs text-slate-500">{s.quizTitle}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-slate-900">{s.score}/{s.totalMarks} · {formatPercent(s.percentage)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(s.submittedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Teacher activity" description="What this teacher has been doing." action={<Link href={`/admin/activity?teacherId=${teacher.id}`} className="text-sm font-medium text-indigo-600 hover:underline">View all</Link>}>
            {activity.items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.items.slice(0, 12).map((a) => {
                  const meta = activityMeta(a.action);
                  const detail = describeActivity(a.action, a.details);
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {a.targetLabel && (a.quizId && a.quizExists ? <Link href={`/admin/quizzes/${a.quizId}`} className="truncate text-sm text-slate-800 hover:text-indigo-600">{a.targetLabel}</Link> : <span className="truncate text-sm text-slate-700">{a.targetLabel}</span>)}
                        </div>
                        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">{formatDateTime(a.createdAt)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Account history" description="Audit entries involving this account.">
            {audit.items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No audit entries for this account.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {audit.items.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><ActionLabel action={a.action} />{a.details?.reason ? <span className="text-sm text-slate-600">“{String(a.details.reason)}”</span> : null}</div>
                      <p className="mt-0.5 text-xs text-slate-500">by {a.actorName ?? a.actorEmail}</p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Account actions">
            <div className="space-y-5 p-5">
              {isSelf ? (
                <p className="text-sm text-slate-500">This is your own account. Manage your profile and password from <Link href="/settings" className="font-semibold text-indigo-600 underline">Settings</Link>.</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Role</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Administrators can access this admin panel and manage all accounts.</p>
                    <ConfirmForm action={setTeacherRoleAction} message={teacher.role === "admin" ? `Remove administrator access from ${teacher.name}?` : `Make ${teacher.name} a platform administrator? They will be able to manage every account and quiz.`} className="mt-2">
                      <input type="hidden" name="teacherId" value={teacher.id} />
                      <input type="hidden" name="role" value={teacher.role === "admin" ? "teacher" : "admin"} />
                      <SubmitButton variant="outline" size="sm" pendingText="Updating…">{teacher.role === "admin" ? "Remove admin access" : "Make administrator"}</SubmitButton>
                    </ConfirmForm>
                  </div>
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">Access</h3>
                    {teacher.status === "active" ? (
                      <div className="mt-2"><SuspendForm teacherId={teacher.id} action={setTeacherStatusAction} /></div>
                    ) : (
                      <form action={setTeacherStatusAction} className="mt-2">
                        <input type="hidden" name="teacherId" value={teacher.id} />
                        <input type="hidden" name="status" value="active" />
                        <SubmitButton variant="success" size="sm" pendingText="Activating…">Re-activate account</SubmitButton>
                      </form>
                    )}
                  </div>
                </>
              )}
              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">Password</h3>
                <div className="mt-2 space-y-5">
                  {!isSelf && !teacher.isDemo && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Set a new password</p>
                      <SetPasswordForm teacherId={teacher.id} />
                    </div>
                  )}
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Or send a reset link</p>
                    <ResetLinkForm teacherId={teacher.id} teacherName={teacher.name} />
                  </div>
                </div>
              </div>
              {!isSelf && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-semibold text-rose-700">Danger zone</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Permanently deletes the account, all {quizzes.length} quizzes and {totalAttempts} student submissions.</p>
                  <ConfirmForm action={deleteTeacherAction} message={`Permanently delete ${teacher.name} (${teacher.email})?\n\nThis removes ${quizzes.length} quizzes and ${totalAttempts} submissions and cannot be undone.`} className="mt-2">
                    <input type="hidden" name="teacherId" value={teacher.id} />
                    <SubmitButton variant="danger" size="sm" pendingText="Deleting…">Delete account</SubmitButton>
                  </ConfirmForm>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
