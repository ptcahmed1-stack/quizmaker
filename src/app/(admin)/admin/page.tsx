import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ActionLabel, BarChart, MiniStat, SectionCard } from "@/components/admin/widgets";
import { listActivity } from "@/lib/activity";
import { activityMeta, describeActivity } from "@/lib/activity-labels";
import { Alert, Badge, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import {
  getDailyActivity,
  getMostActiveTeachers,
  getPlatformSettings,
  getPlatformStats,
  getTopQuizzes,
  isDefaultAdminPasswordInUse,
  listAuditLogs,
  listTeachers,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPercent } from "@/lib/format";
import { baseUrlFromHeaders } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const [stats, daily, topQuizzes, activeTeachers, recentTeachers, recentAudit, recentActivity, settings, defaultPassword, hdrs] = await Promise.all([
    getPlatformStats(),
    getDailyActivity(14),
    getTopQuizzes(5),
    getMostActiveTeachers(5),
    listTeachers({ page: 1 }),
    listAuditLogs({ page: 1 }),
    listActivity({ page: 1 }),
    getPlatformSettings(),
    isDefaultAdminPasswordInUse(),
    headers(),
  ]);
  const totalSubs14 = daily.reduce((s, d) => s + d.submissions, 0);
  const totalSignups14 = daily.reduce((s, d) => s + d.signups, 0);

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description={`Signed in as ${admin.name}. Here is the health of your QuizMaker deployment.`}
        actions={
          <>
            <LinkButton href="/admin/teachers/new" variant="outline">+ Add teacher</LinkButton>
            <LinkButton href="/quizzes/new" variant="outline">+ Create quiz</LinkButton>
            <LinkButton href="/admin/settings">Platform settings</LinkButton>
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {defaultPassword && (
          <Alert tone="warning" title="Default administrator password in use">
            The built-in admin account still uses the default password. <Link href="/settings" className="font-semibold underline">Change it now</Link> to secure your deployment.
          </Alert>
        )}
        {settings.maintenanceMode && (
          <Alert tone="warning" title="Maintenance mode is on">
            Students cannot start new quiz attempts. <Link href="/admin/settings" className="font-semibold underline">Turn it off in platform settings</Link>.
          </Alert>
        )}
        {!settings.allowSignups && (
          <Alert tone="info">New teacher sign-ups are disabled. Accounts can only be created from the admin panel.</Alert>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Teachers" value={stats.teachers} hint={`${stats.newTeachers30d} new in 30 days · ${stats.admins} admin${stats.admins === 1 ? "" : "s"}`} />
        <MiniStat label="Suspended" value={stats.suspended} tone={stats.suspended ? "rose" : "slate"} hint="accounts" />
        <MiniStat label="Quizzes" value={stats.quizzes} hint={`${stats.published} live · ${stats.drafts} draft · ${stats.closed} closed`} />
        <MiniStat label="Questions" value={stats.questions} hint="across all quizzes" />
        <MiniStat label="Submissions" value={stats.submissions} tone="indigo" hint={`${stats.submissions7d} in last 7 days`} />
        <MiniStat label="Average score" value={formatPercent(stats.averagePercentage)} tone="green" hint={`Pass rate ${formatPercent(stats.passRate)}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarChart title="Submissions · last 14 days" points={daily.map((d) => ({ label: d.label, value: d.submissions }))} total={totalSubs14} />
        <BarChart title="Teacher sign-ups · last 14 days" points={daily.map((d) => ({ label: d.label, value: d.signups }))} total={totalSignups14} color="bg-emerald-500" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Most attempted quizzes" action={<Link href="/admin/quizzes" className="text-sm font-medium text-indigo-600 hover:underline">All quizzes</Link>}>
          {topQuizzes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topQuizzes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/quizzes/${q.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-600">{q.title}</Link>
                    <p className="text-xs text-slate-500">{q.teacherName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <StatusBadge status={q.status} />
                    <span className="font-semibold text-slate-900">{q.attempts}</span>
                    <span className="w-12 text-right text-slate-500">{formatPercent(q.averagePercentage != null ? Number(q.averagePercentage) : null)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Most active teachers" action={<Link href="/admin/teachers" className="text-sm font-medium text-indigo-600 hover:underline">All teachers</Link>}>
          {activeTeachers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeTeachers.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/teachers/${t.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-600">{t.name}</Link>
                    <p className="truncate text-xs text-slate-500">{t.email}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-semibold text-slate-900">{t.attempts} submissions</p>
                    <p className="text-xs text-slate-500">{t.quizCount} {t.quizCount === 1 ? "quiz" : "quizzes"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Live teacher activity" description="Logins, quiz changes and student submissions as they happen." className="lg:col-span-2" action={<Link href="/admin/activity" className="text-sm font-medium text-indigo-600 hover:underline">See all activity</Link>}>
          {recentActivity.items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No teacher activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.items.slice(0, 8).map((a) => {
                const meta = activityMeta(a.action);
                const detail = describeActivity(a.action, a.details);
                return (
                  <li key={a.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.teacherId ? <Link href={`/admin/teachers/${a.teacherId}`} className="text-sm font-semibold text-slate-900 hover:text-indigo-600">{a.teacherName}</Link> : <span className="text-sm font-semibold text-slate-900">{a.teacherName}</span>}
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {a.targetLabel && <span className="truncate text-sm text-slate-600">{a.targetLabel}</span>}
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

        <SectionCard title="Newest teachers" action={<Link href="/admin/teachers" className="text-sm font-medium text-indigo-600 hover:underline">Manage</Link>}>
          <ul className="divide-y divide-slate-100">
            {recentTeachers.items.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/teachers/${t.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-600">{t.name}</Link>
                  <p className="truncate text-xs text-slate-500">{t.email}{t.school ? ` · ${t.school}` : ""}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">{formatDateTime(t.createdAt)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Recent admin activity" action={<Link href="/admin/audit" className="text-sm font-medium text-indigo-600 hover:underline">Full audit log</Link>}>
          {recentAudit.items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No audit entries yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAudit.items.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><ActionLabel action={a.action} />{a.targetLabel && <span className="truncate text-sm text-slate-700">{a.targetLabel}</span>}</div>
                    <p className="mt-0.5 text-xs text-slate-500">by {a.actorName ?? a.actorEmail}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="System" description="Deployment configuration and housekeeping." className="mt-6">
        <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-slate-500">Public URL</dt><dd className="mt-0.5 break-all font-mono text-xs text-slate-800">{baseUrlFromHeaders(hdrs)}</dd></div>
          <div><dt className="text-xs text-slate-500">Database</dt><dd className="mt-0.5 font-semibold text-emerald-700">Connected</dd></div>
          <div><dt className="text-xs text-slate-500">Email delivery (RESEND_API_KEY)</dt><dd className={`mt-0.5 font-semibold ${process.env.RESEND_API_KEY ? "text-emerald-700" : "text-amber-700"}`}>{process.env.RESEND_API_KEY ? "Configured" : "Not configured — reset links are shown in the admin panel"}</dd></div>
          <div><dt className="text-xs text-slate-500">Auto-admin emails (ADMIN_EMAILS)</dt><dd className="mt-0.5 font-semibold text-slate-800">{process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS : "Not set"}</dd></div>
          <div><dt className="text-xs text-slate-500">Attempts in progress</dt><dd className="mt-0.5 font-semibold text-slate-800">{stats.inProgress} <span className="font-normal text-slate-500">({stats.abandoned} abandoned &gt; 24h)</span></dd></div>
          <div><dt className="text-xs text-slate-500">Node.js</dt><dd className="mt-0.5 font-mono text-xs text-slate-800">{process.version}</dd></div>
          <div><dt className="text-xs text-slate-500">Housekeeping</dt><dd className="mt-0.5"><Link href="/admin/settings#maintenance" className="font-semibold text-indigo-600 hover:underline">Maintenance tools →</Link></dd></div>
        </dl>
      </SectionCard>
    </div>
  );
}
