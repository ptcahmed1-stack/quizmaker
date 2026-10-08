import type { Metadata } from "next";
import Link from "next/link";
import { adminDeleteSubmissionAction } from "@/app/(admin)/actions";
import { FlashMessages, Pagination } from "@/components/admin/widgets";
import { ConfirmForm, SubmitButton } from "@/components/client-bits";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { listSubmissions, parsePage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Submissions · Admin" };

type Search = { q?: string; status?: string; teacherId?: string; quizId?: string; page?: string; ok?: string; error?: string };

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listSubmissions({ q: sp.q, status: sp.status, teacherId: sp.teacherId, quizId: sp.quizId, page: parsePage(sp.page) });
  const params = { q: sp.q, status: sp.status, teacherId: sp.teacherId, quizId: sp.quizId };
  const active = Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>;
  const here = `/admin/submissions${Object.keys(active).length ? `?${new URLSearchParams(active).toString()}` : ""}`;

  return (
    <div>
      <PageHeader title="Student submissions" description={`${result.total} ${result.total === 1 ? "record" : "records"} match your filters. Includes attempts still in progress.`} />
      <FlashMessages ok={sp.ok} error={sp.error} />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          {sp.teacherId && <input type="hidden" name="teacherId" value={sp.teacherId} />}
          {sp.quizId && <input type="hidden" name="quizId" value={sp.quizId} />}
          <div>
            <label htmlFor="q" className="sr-only">Search submissions</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by student, ID, quiz or teacher…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="status" className="sr-only">Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}>
              <option value="">All</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In progress</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>Filter</button>
            {(sp.q || sp.status || sp.teacherId || sp.quizId) && <Link href="/admin/submissions" className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No submissions found" description="No student submissions match the current filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Student</th>
                  <th scope="col" className="px-3 py-3">Quiz</th>
                  <th scope="col" className="px-3 py-3">Teacher</th>
                  <th scope="col" className="px-3 py-3">Score</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Time</th>
                  <th scope="col" className="px-3 py-3">When</th>
                  <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{s.studentName || <span className="italic text-slate-500">Anonymous</span>}</p>
                      <p className="text-xs text-slate-500">{s.studentIdentifier ? `ID: ${s.studentIdentifier}` : ""}{s.attemptNumber > 1 ? ` · Attempt ${s.attemptNumber}` : ""}</p>
                    </td>
                    <td className="px-3 py-3"><Link href={`/admin/quizzes/${s.quizId}`} className="text-slate-800 hover:text-indigo-600">{s.quizTitle}</Link></td>
                    <td className="px-3 py-3"><Link href={`/admin/teachers/${s.teacherId}`} className="text-slate-700 hover:text-indigo-600">{s.teacherName}</Link></td>
                    <td className="px-3 py-3 font-medium text-slate-900">{s.status === "submitted" ? <>{s.score}/{s.totalMarks} <span className="text-slate-500">({formatPercent(s.percentage)})</span></> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {s.status === "submitted" ? <Badge tone={s.passed ? "green" : "rose"}>{s.passed ? "Pass" : "Fail"}</Badge> : <Badge tone="amber">In progress</Badge>}
                        {s.isLate && <Badge tone="amber">Late</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatDuration(s.timeTakenSeconds)}</td>
                    <td className="px-3 py-3 text-slate-500">{formatDateTime(s.submittedAt ?? s.startedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <ConfirmForm action={adminDeleteSubmissionAction} message={`Delete this ${s.status === "submitted" ? "submission" : "in-progress attempt"} from ${s.studentName || "an anonymous student"}?`}>
                        <input type="hidden" name="submissionId" value={s.id} />
                        <input type="hidden" name="redirectTo" value={here} />
                        <SubmitButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" pendingText="…">Delete</SubmitButton>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} basePath="/admin/submissions" params={params} />
        </Card>
      )}
    </div>
  );
}
