import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/client-bits";
import { PasswordForm, ProfileForm } from "@/components/teacher/settings-forms";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & Settings" description={`Member since ${formatDate(teacher.createdAt)}.`} />
      {teacher.isDemo && (
        <div className="mb-6">
          <Alert tone="info" title="Shared demo account">You are using the shared demo account. Profile and password changes are disabled. Create your own free account to keep your quizzes private.</Alert>
        </div>
      )}
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile</h2>
          <ProfileForm name={teacher.name} email={teacher.email} school={teacher.school ?? ""} isDemo={teacher.isDemo} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Change password</h2>
          <PasswordForm isDemo={teacher.isDemo} />
        </Card>
        <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Session</h2>
            <p className="text-sm text-slate-600">Log out of QuizMaker on this device.</p>
          </div>
          <form action={logout}>
            <SubmitButton variant="outline" pendingText="Logging out…">Log out</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
