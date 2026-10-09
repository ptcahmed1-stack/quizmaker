import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listTemplates } from "@/lib/assignments";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Assigned quizzes · Admin" };

export default async function AdminAssignmentsPage() {
  await requireAdmin();
  const templates = await listTemplates();
  return (
    <div>
      <PageHeader
        title="Assigned quizzes"
        description="Quizzes you have given to teachers. Each teacher gets their own copy and student link; results are combined here."
        actions={<LinkButton href="/quizzes/new">+ Create quiz</LinkButton>}
      />
      {templates.length === 0 ? (
        <EmptyState
          title="No quizzes assigned yet"
          description="Create a quiz (or open any existing one), then use “Assign to teachers” on its admin page. Each teacher receives their own copy, can send the link to their students, and only sees their own students' results."
          action={
            <>
              <LinkButton href="/quizzes/new">Create a quiz</LinkButton>
              <LinkButton href="/admin/quizzes" variant="outline">Browse all quizzes</LinkButton>
            </>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Quiz</th>
                  <th scope="col" className="px-3 py-3">Teachers</th>
                  <th scope="col" className="px-3 py-3">Published</th>
                  <th scope="col" className="px-3 py-3">Student attempts</th>
                  <th scope="col" className="px-3 py-3">Average</th>
                  <th scope="col" className="px-3 py-3">Pass rate</th>
                  <th scope="col" className="px-5 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/quizzes/${t.id}#assign`} className="font-semibold text-slate-900 hover:text-indigo-600">{t.title}</Link>
                      <div className="text-xs text-slate-500">{t.subject || "No subject"} · by {t.ownerName}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{t.copies}</td>
                    <td className="px-3 py-3 text-slate-700">{t.publishedCopies} / {t.copies}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{t.attempts}</td>
                    <td className="px-3 py-3 text-slate-700">{formatPercent(t.averagePercentage)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatPercent(t.passRate)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
