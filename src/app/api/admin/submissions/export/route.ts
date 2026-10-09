import { listSubmissions } from "@/lib/admin";
import { getCurrentTeacher } from "@/lib/auth";
import { csvEscape, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentTeacher();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    teacherId: url.searchParams.get("teacherId") ?? undefined,
    quizId: url.searchParams.get("quizId") ?? undefined,
  };

  const header = ["Teacher", "Quiz", "Student Name", "Student ID", "Attempt", "Status", "Score", "Total Marks", "Percentage", "Pass/Fail", "Time Taken", "Late", "Submitted / Started"];
  const lines = [header.join(",")];
  const first = await listSubmissions({ ...filters, page: 1 });
  const pages = Math.min(first.totalPages, 400);
  for (let page = 1; page <= pages; page++) {
    const result = page === 1 ? first : await listSubmissions({ ...filters, page });
    for (const s of result.items) {
      lines.push(
        [
          s.teacherName,
          s.quizTitle,
          s.studentName,
          s.studentIdentifier,
          s.attemptNumber,
          s.status === "submitted" ? "Submitted" : "In progress",
          s.status === "submitted" ? s.score : "",
          s.totalMarks,
          s.status === "submitted" ? s.percentage.toFixed(1) : "",
          s.status === "submitted" ? (s.passed ? "Pass" : "Fail") : "",
          formatDuration(s.timeTakenSeconds),
          s.isLate ? "Yes" : "No",
          (s.submittedAt ?? s.startedAt).toISOString(),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quizmaker-all-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
