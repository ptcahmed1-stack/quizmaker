import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/admin/widgets";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { listActivity, listTeacherOptions } from "@/lib/activity";
import { ACTIVITY_GROUPS, activityMeta, describeActivity } from "@/lib/activity-labels";
import { parsePage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Teacher activity · Admin" };

type Search = { teacherId?: string; group?: string; q?: string; page?: string };

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [result, teachers] = await Promise.all([
    listActivity({ teacherId: sp.teacherId, group: sp.group, q: sp.q, page: parsePage(sp.page) }),
    listTeacherOptions(),
  ]);
  const params = { teacherId: sp.teacherId, group: sp.group, q: sp.q };
  const filtered = Boolean(sp.teacherId || sp.group || sp.q);

  return (
    <div>
      <PageHeader title="Teacher activity" description="Everything your teachers do — logins, quiz changes, publishing, exports — and every student submission on their quizzes." />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label htmlFor="q" className="sr-only">Search activity</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by teacher, quiz or action…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="teacherId" className="sr-only">Teacher</label>
            <select id="teacherId" name="teacherId" defaultValue={sp.teacherId ?? ""} className={inputClass}>
              <option value="">All teachers</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="group" className="sr-only">Activity type</label>
            <select id="group" name="group" defaultValue={sp.group ?? ""} className={inputClass}>
              {ACTIVITY_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>Filter</button>
            {filtered && <Link href="/admin/activity" className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No activity yet" description="When teachers log in, create or publish quizzes and students submit answers, it will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-3 py-3">Teacher</th>
                  <th scope="col" className="px-3 py-3">Activity</th>
                  <th scope="col" className="px-3 py-3">Quiz</th>
                  <th scope="col" className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((a) => {
                  const meta = activityMeta(a.action);
                  return (
                    <tr key={a.id} className="align-top hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(a.createdAt)}</td>
                      <td className="px-3 py-3">
                        {a.teacherId ? <Link href={`/admin/teachers/${a.teacherId}`} className="font-medium text-slate-900 hover:text-indigo-600">{a.teacherName}</Link> : <span className="text-slate-700">{a.teacherName}</span>}
                        {a.teacherEmail && <div className="text-xs text-slate-500">{a.teacherEmail}</div>}
                      </td>
                      <td className="px-3 py-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="px-3 py-3 text-slate-700">
                        {a.targetLabel ? (a.quizId && a.quizExists ? <Link href={`/admin/quizzes/${a.quizId}`} className="hover:text-indigo-600">{a.targetLabel}</Link> : <span>{a.targetLabel}{a.quizId && !a.quizExists ? " (deleted)" : ""}</span>) : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{describeActivity(a.action, a.details) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} basePath="/admin/activity" params={params} />
        </Card>
      )}
    </div>
  );
}
