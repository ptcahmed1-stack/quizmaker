// Isomorphic: human-readable labels for activity-log actions.

export type ActivityTone = "slate" | "green" | "amber" | "rose" | "indigo" | "blue";

const LABELS: Record<string, { label: string; tone: ActivityTone }> = {
  "auth.login": { label: "Logged in", tone: "slate" },
  "auth.signup": { label: "Signed up", tone: "green" },
  "quiz.create": { label: "Created a quiz", tone: "green" },
  "quiz.edit": { label: "Edited a quiz", tone: "slate" },
  "quiz.publish": { label: "Published a quiz", tone: "indigo" },
  "quiz.close": { label: "Closed a quiz", tone: "amber" },
  "quiz.reopen": { label: "Reopened a quiz", tone: "indigo" },
  "quiz.unpublish": { label: "Moved a quiz to draft", tone: "amber" },
  "quiz.duplicate": { label: "Duplicated a quiz", tone: "slate" },
  "quiz.delete": { label: "Deleted a quiz", tone: "rose" },
  "quiz.assigned": { label: "Received an assigned quiz", tone: "blue" },
  "results.release": { label: "Released results to students", tone: "indigo" },
  "results.hide": { label: "Hid results from students", tone: "amber" },
  "results.export": { label: "Exported results (CSV)", tone: "slate" },
  "student.submitted": { label: "Student submitted a quiz", tone: "green" },
  "account.password_changed": { label: "Changed their password", tone: "amber" },
  "account.profile_updated": { label: "Updated their profile", tone: "slate" },
};

export function activityMeta(action: string): { label: string; tone: ActivityTone } {
  return LABELS[action] ?? { label: action, tone: "slate" };
}

export const ACTIVITY_GROUPS: { value: string; label: string; prefix: string }[] = [
  { value: "", label: "All activity", prefix: "" },
  { value: "auth", label: "Logins & sign-ups", prefix: "auth." },
  { value: "quiz", label: "Quiz changes", prefix: "quiz." },
  { value: "student", label: "Student submissions", prefix: "student." },
  { value: "results", label: "Results & exports", prefix: "results." },
  { value: "account", label: "Account changes", prefix: "account." },
];

/** One-line summary of an activity entry's details. */
export function describeActivity(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "";
  const d = details as Record<string, string | number | boolean | undefined>;
  switch (action) {
    case "student.submitted":
      return `${d.student ?? "Student"}${d.studentId ? ` (${d.studentId})` : ""} scored ${d.score} (${d.percentage}%) — ${d.passed ? "passed" : "not passed"}`;
    case "quiz.assigned":
      return `Assigned by ${d.assignedBy ?? "an administrator"}${d.published ? " and already published" : ""}`;
    case "quiz.duplicate":
      return d.copyTitle ? `New copy: ${d.copyTitle}` : "";
    default:
      return "";
  }
}
