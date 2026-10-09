import { logActivity } from "@/lib/activity";
import { getCurrentTeacher } from "@/lib/auth";
import { getQuizResults, getQuizResultsAdmin } from "@/lib/quizzes";
import { csvEscape, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const data = teacher.role === "admin" ? await getQuizResultsAdmin(id) : await getQuizResults(id, teacher.id);
  if (!data) return new Response("Not found", { status: 404 });

  if (data.quiz.teacherId === teacher.id) await logActivity(teacher, "results.export", { quizId: data.quiz.id, label: data.quiz.title });

  const header = ["Student Name", "Student ID", "Attempt", "Score", "Total Marks", "Percentage", "Pass/Fail", "Time Taken", "Time Taken (seconds)", "Late", "Submission Date"];
  const lines = [header.join(",")];
  for (const s of data.submissions) {
    lines.push(
      [
        s.studentName,
        s.studentIdentifier,
        s.attemptNumber,
        s.score,
        s.totalMarks,
        s.percentage.toFixed(1),
        s.passed ? "Pass" : "Fail",
        formatDuration(s.timeTakenSeconds),
        s.timeTakenSeconds ?? "",
        s.isLate ? "Yes" : "No",
        s.submittedAt ? s.submittedAt.toISOString() : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const safeTitle = data.quiz.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "quiz";
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
