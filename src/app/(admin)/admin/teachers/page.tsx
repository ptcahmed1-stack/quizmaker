import type { Metadata } from "next";
import Link from "next/link";
import { setTeacherStatusAction } from "@/app/(admin)/actions";
import { AccountStatusBadge, FlashMessages, Pagination, RoleBadge } from "@/components/admin/widgets";
import { ConfirmForm, SubmitButton } from "@/components/client-bits";
import { Badge, Card, EmptyState, LinkButton, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { listTeachers, parsePage } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Teachers · Admin" };

type Search = { q?: string; role?: string; status?: string; page?: string; ok?: string; error?: string };

export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const result = await listTeachers({ q: sp.q, role: sp.role, status: sp.status, page: parsePage(sp.page) });
  const params = { q: sp.q, role: sp.role, status: sp.status };

  return (
    <div>
      <PageHeader
        title="Teachers"
        description={`${result.total} ${result.total === 1 ? "account" : "accounts"} match your filters.`}
        actions={
          <>
            <a href="/api/admin/teachers/export" download className={buttonClass("outline")}>Export CSV</a>
            <LinkButton href="/admin/teachers/new">+ Add teacher</LinkButton>
          </>
        }
      />
      <FlashMessages ok={sp.ok} error={sp.error} />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label htmlFor="q" className="sr-only">Search teachers</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search by name, email or school…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="role" className="sr-only">Role</label>
            <select id="role" name="role" defaultValue={sp.role ?? ""} className={inputClass}>
              <option value="">All roles</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="sr-only">Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("primary")}>Filter</button>
            {(sp.q || sp.role || sp.status) && <Link href="/admin/teachers" className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="No teachers found" description="Try different search terms or create a new account." action={<LinkButton href="/admin/teachers/new">Add teacher</LinkButton>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Teacher</th>
                  <th scope="col" className="px-3 py-3">Role</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3">Quizzes</th>
                  <th scope="col" className="px-3 py-3">Submissions</th>
                  <th scope="col" className="px-3 py-3">Joined</th>
                  <th scope="col" className="px-3 py-3">Last login</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/teachers/${t.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{t.name}</Link>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{t.email}</span>
                        {t.school && <span>· {t.school}</span>}
                        {t.isDemo && <Badge tone="blue">Demo</Badge>}
                        {t.id === admin.id && <Badge tone="indigo">You</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3"><RoleBadge role={t.role} /></td>
                    <td className="px-3 py-3"><AccountStatusBadge status={t.status} /></td>
                    <td className="px-3 py-3 text-slate-700">{t.quizCount}</td>
                    <td className="px-3 py-3 text-slate-700">{t.submissionCount}</td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-500">{t.lastLoginAt ? formatDateTime(t.lastLoginAt) : "Never"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <LinkButton href={`/admin/teachers/${t.id}`} variant="outline" size="sm">Manage</LinkButton>
                        {t.id !== admin.id && (
                          t.status === "active" ? (
                            <ConfirmForm action={setTeacherStatusAction} message={`Suspend ${t.name}? They will be logged out and their quizzes will become unavailable to students.`}>
                              <input type="hidden" name="teacherId" value={t.id} />
                              <input type="hidden" name="status" value="suspended" />
                              <SubmitButton variant="ghost" size="sm" pendingText="…">Suspend</SubmitButton>
                            </ConfirmForm>
                          ) : (
                            <form action={setTeacherStatusAction}>
                              <input type="hidden" name="teacherId" value={t.id} />
                              <input type="hidden" name="status" value="active" />
                              <SubmitButton variant="success" size="sm" pendingText="…">Activate</SubmitButton>
                            </form>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} basePath="/admin/teachers" params={params} />
        </Card>
      )}
    </div>
  );
}
