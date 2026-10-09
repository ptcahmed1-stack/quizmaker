import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/client-bits";
import { PasswordForm, ProfileForm } from "@/components/teacher/settings-forms";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Profile & Password" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [teacher, sp] = await Promise.all([requireTeacher(), searchParams]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & Password" description={`Member since ${formatDate(teacher.createdAt)}.`} />
      {sp.welcome && teacher.mustChangePassword && (
        <div className="mb-6">
          <Alert tone="warning" title="Welcome! Please set your own password">Your administrator gave you a temporary password. Choose a new one below — you will need the temporary password as your “current password”.</Alert>
        </div>
      )}
      {teacher.isDemo && (
        <div className="mb-6">
          <Alert tone="info" title="Shared demo account">You are using the shared demo account. Profile and password changes are disabled. Create your own free account to keep your quizzes private.</Alert>
        </div>
      )}
      <div className="space-y-6">
        <Card className="p-6" >
          <h2 id="password" className="mb-1 text-lg font-semibold text-slate-900">Change password</h2>
          <p className="mb-4 text-sm text-slate-600">Choose a strong password you do not use anywhere else. Changing it signs you out of your other devices.</p>
          <PasswordForm isDemo={teacher.isDemo} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile</h2>
          <ProfileForm name={teacher.name} email={teacher.email} school={teacher.school ?? ""} isDemo={teacher.isDemo} />
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
