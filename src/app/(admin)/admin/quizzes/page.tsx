import type { Metadata } from "next";
import Link from "next/link";
import { adminDeleteQuizAction, adminSetQuizStatusAction } from "@/app/(admin)/actions";
import { FlashMessages, Pagination } from "@/components/admin/widgets";
import { ConfirmForm, SubmitButton } from "@/components/client-bits";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge, buttonClass, inputClass } from "@/components/ui";
import { getTeacherById, listAllQuizzes, parsePage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Quizzes · Admin" };

type Search = { q?: string; status?: string; teacherId?: string; page?: string; ok?: string; error?: string };

export default async function AdminQuizzesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [result, teacher] = await Promise.all([
    listAllQuizzes({ q: sp.q, status: sp.status, teacherId: sp.teacherId, page: parsePage(sp.page) }),
    sp.teacherId ? getTeacherById(sp.teacherId) : Promise.resolve(null),
  ]);
  const params = { q: sp.q, status: sp.status, teacherId: sp.teacherId };
  const listPath = `/admin/quizzes${Object.entries(params).some(([, v]) => v) ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>).toString()}` : ""}`;

  return (
    <div>
      <PageHeader
        title="All quizzes"
        description={teacher ? <span>Showing quizzes by <Link href={`/admin/teachers/${teacher.id}`} className="font-semibold text-indigo-600 hover:underline">{teacher.name}</Link>. <Link href="/admin/quizzes" className="underline">Show all</Link></span> : `${result.total} ${result.total === 1 ? "quiz" : "quizzes"} across the platform.`}
      />
      <FlashMessages ok={sp.ok} error={sp.error} />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          {sp.teacherId && <input type="hidden" name="teacherId" value={sp.teacherId} />}
          <div>
            <label htmlFor="q" className="sr-only">Search quizzes</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by title, subject, code or teacher…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="status" className="sr-only">Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}>
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>Filter</button>
            {(sp.q || sp.status) && <Link href={sp.teacherId ? `/admin/quizzes?teacherId=${sp.teacherId}` : "/admin/quizzes"} className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No quizzes found" description="No quizzes match the current filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Quiz</th>
                  <th scope="col" className="px-3 py-3">Teacher</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Questions</th>
                  <th scope="col" className="px-3 py-3">Attempts</th>
                  <th scope="col" className="px-3 py-3">Average</th>
                  <th scope="col" className="px-3 py-3">Created</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/quizzes/${q.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{q.title}</Link>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{q.subject || "No subject"}</span>
                        {q.publicCode && <span className="font-mono">· {q.publicCode}</span>}
                        {q.isDemo && <Badge tone="blue">Demo</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/teachers/${q.teacherId}`} className="text-slate-800 hover:text-indigo-600">{q.teacherName}</Link>
                      <div className="text-xs text-slate-500">{q.teacherEmail}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-3 py-3 text-slate-700">{q.questionCount}</td>
                    <td className="px-3 py-3 text-slate-700">{q.attempts}</td>
                    <td className="px-3 py-3 text-slate-700">{formatPercent(q.averagePercentage)}</td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(q.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {q.publicCode && q.status === "published" && (
                          <a href={`/quiz/${q.publicCode}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>Open ↗</a>
                        )}
                        <LinkButton href={`/admin/quizzes/${q.id}`} variant="outline" size="sm">Manage</LinkButton>
                        {q.status === "published" && (
                          <ConfirmForm action={adminSetQuizStatusAction} message={`Close "${q.title}"? Students will no longer be able to submit.`}>
                            <input type="hidden" name="quizId" value={q.id} />
                            <input type="hidden" name="status" value="closed" />
                            <input type="hidden" name="redirectTo" value={listPath} />
                            <SubmitButton variant="ghost" size="sm" pendingText="…">Close</SubmitButton>
                          </ConfirmForm>
                        )}
                        {q.status === "closed" && q.publicCode && (
                          <form action={adminSetQuizStatusAction}>
                            <input type="hidden" name="quizId" value={q.id} />
                            <input type="hidden" name="status" value="published" />
                            <input type="hidden" name="redirectTo" value={listPath} />
                            <SubmitButton variant="ghost" size="sm" pendingText="…">Reopen</SubmitButton>
                          </form>
                        )}
                        <ConfirmForm action={adminDeleteQuizAction} message={`Permanently delete "${q.title}" and its ${q.attempts} submissions? This cannot be undone.`}>
                          <input type="hidden" name="quizId" value={q.id} />
                          <input type="hidden" name="redirectTo" value={listPath} />
                          <SubmitButton variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" pendingText="…">Delete</SubmitButton>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} basePath="/admin/quizzes" params={params} />
        </Card>
      )}
    </div>
  );
}
