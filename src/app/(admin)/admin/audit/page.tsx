import type { Metadata } from "next";
import Link from "next/link";
import { ActionLabel, Pagination } from "@/components/admin/widgets";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { listAuditLogs, parsePage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listAuditLogs({ q: sp.q, page: parsePage(sp.page) });

  return (
    <div>
      <PageHeader title="Audit log" description="Every administrative action is recorded here with who did it and when." />
      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">Search audit log</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by action (e.g. teacher.suspend), actor email or target…" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>Search</button>
            {sp.q && <Link href="/admin/audit" className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No audit entries" description="Administrative actions will appear here as they happen." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-3 py-3">Actor</th>
                  <th scope="col" className="px-3 py-3">Action</th>
                  <th scope="col" className="px-3 py-3">Target</th>
                  <th scope="col" className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((a) => (
                  <tr key={a.id} className="align-top hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(a.createdAt)}</td>
                    <td className="px-3 py-3">
                      {a.actorId ? <Link href={`/admin/teachers/${a.actorId}`} className="font-medium text-slate-900 hover:text-indigo-600">{a.actorName ?? a.actorEmail}</Link> : <span className="text-slate-700">{a.actorEmail}</span>}
                      {a.actorName && <div className="text-xs text-slate-500">{a.actorEmail}</div>}
                    </td>
                    <td className="px-3 py-3"><ActionLabel action={a.action} /></td>
                    <td className="px-3 py-3 text-slate-700">
                      {a.targetType === "teacher" && a.targetId ? (
                        <Link href={`/admin/teachers/${a.targetId}`} className="hover:text-indigo-600">{a.targetLabel ?? a.targetId}</Link>
                      ) : a.targetType === "quiz" && a.targetId ? (
                        <Link href={`/admin/quizzes/${a.targetId}`} className="hover:text-indigo-600">{a.targetLabel ?? a.targetId}</Link>
                      ) : (
                        <span>{a.targetLabel ?? a.targetType ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{a.details ? JSON.stringify(a.details) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} basePath="/admin/audit" params={{ q: sp.q }} />
        </Card>
      )}
    </div>
  );
}
