import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/teacher/settings-forms";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ADMIN_EMAIL, isDefaultAdminPasswordInUse } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My account · Admin" };

export default async function AdminAccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [admin, sp, defaultPassword] = await Promise.all([requireAdmin(), searchParams, isDefaultAdminPasswordInUse()]);
  const usingDefault = defaultPassword && admin.email === ADMIN_EMAIL;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My account & password" description={`Signed in as ${admin.email} · Administrator since ${formatDate(admin.createdAt)}.`} />
      {(usingDefault || (sp.welcome && admin.mustChangePassword)) && (
        <div className="mb-6">
          <Alert tone="warning" title="Change your password">
            {usingDefault ? "This account is still using the default administrator password. Anyone who knows it can manage your whole platform — please change it now." : "You are using a temporary password. Please choose your own below."}
          </Alert>
        </div>
      )}
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Change password</h2>
          <p className="mb-4 text-sm text-slate-600">Enter your current password, then choose a new one. Changing it signs you out of your other devices.</p>
          <PasswordForm isDemo={false} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile</h2>
          <ProfileForm name={admin.name} email={admin.email} school={admin.school ?? ""} isDemo={false} />
        </Card>
      </div>
    </div>
  );
}
