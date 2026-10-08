import { listAllTeachersForExport } from "@/lib/admin";
import { getCurrentTeacher } from "@/lib/auth";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  if (teacher.role !== "admin") return new Response("Forbidden", { status: 403 });
  const rows = await listAllTeachersForExport();
  const header = ["Name", "Email", "School", "Role", "Status", "Quizzes", "Submissions", "Joined", "Last Login", "Demo"];
  const lines = [header.join(",")];
  for (const t of rows) {
    lines.push(
      [t.name, t.email, t.school ?? "", t.role, t.status, t.quizCount, t.submissionCount, t.createdAt.toISOString(), t.lastLoginAt ? t.lastLoginAt.toISOString() : "", t.isDemo ? "Yes" : "No"]
        .map(csvEscape)
        .join(","),
    );
  }
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quizmaker-teachers.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
