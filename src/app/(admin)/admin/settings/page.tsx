import type { Metadata } from "next";
import Link from "next/link";
import { cleanupAttemptsAction, resetDemoDataAction } from "@/app/(admin)/actions";
import { DangerButton, PlatformSettingsForm } from "@/components/admin/forms";
import { FlashMessages, SectionCard } from "@/components/admin/widgets";
import { Alert } from "@/components/ui";
import { ADMIN_EMAIL, countAbandonedAttempts, getPlatformSettings, isDefaultAdminPasswordInUse } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { DEMO_EMAIL } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Platform settings · Admin" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [sp, settings, abandoned, defaultPassword] = await Promise.all([searchParams, getPlatformSettings(), countAbandonedAttempts(24), isDefaultAdminPasswordInUse()]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Platform settings</h1>
        <p className="mt-1 text-sm text-slate-600">Control sign-ups, announcements and maintenance for the whole deployment. Last updated {formatDateTime(settings.updatedAt)}.</p>
      </div>
      <FlashMessages ok={sp.ok} error={sp.error} />
      {defaultPassword && (
        <div className="mb-6">
          <Alert tone="warning" title="Default administrator password in use">
            The <span className="font-mono">{ADMIN_EMAIL}</span> account still uses the default password. <Link href="/settings" className="font-semibold underline">Change it now</Link>.
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        <SectionCard title="General">
          <div className="p-5"><PlatformSettingsForm settings={settings} /></div>
        </SectionCard>

        <SectionCard title="Administrator access" description="How admin accounts are granted.">
          <div className="space-y-3 p-5 text-sm text-slate-700">
            <p>• Promote any teacher from their account page under <span className="font-semibold">Teachers → Manage → Make administrator</span>.</p>
            <p>• Set the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">ADMIN_EMAILS</code> environment variable (comma-separated) to grant admin access automatically on sign-up or login. Currently: <span className="font-mono text-xs">{process.env.ADMIN_EMAILS || "not set"}</span>.</p>
            <p>• The built-in account <span className="font-mono text-xs">{ADMIN_EMAIL}</span> is created automatically when no administrator exists (password from <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">ADMIN_PASSWORD</code>, default <span className="font-mono text-xs">admin1234</span>).</p>
          </div>
        </SectionCard>

        <SectionCard title="Maintenance tools" description="Housekeeping actions. Each one is recorded in the audit log." className="scroll-mt-6">
          <div id="maintenance" className="divide-y divide-slate-100">
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Clean up abandoned attempts</h3>
                <p className="text-xs text-slate-500">Removes quiz attempts that were started but never submitted within 24 hours. Currently <span className="font-semibold text-slate-800">{abandoned}</span> {abandoned === 1 ? "attempt" : "attempts"}.</p>
              </div>
              <DangerButton label={`Remove ${abandoned} abandoned`} confirm={`Delete ${abandoned} abandoned attempts older than 24 hours?`} action={cleanupAttemptsAction} pendingText="Cleaning…" />
            </div>
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Reset demo data</h3>
                <p className="text-xs text-slate-500">Deletes and re-creates the sample quizzes and submissions owned by <span className="font-mono">{DEMO_EMAIL}</span>. Useful after visitors have modified the demo account.</p>
              </div>
              <DangerButton label="Reset demo data" confirm="Delete and re-create all demo quizzes and their submissions?" action={resetDemoDataAction} pendingText="Resetting…" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Deployment checklist" description="Environment variables that affect the platform.">
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
            {[
              ["DATABASE_URL", Boolean(process.env.DATABASE_URL), "Required. PostgreSQL connection string."],
              ["NEXT_PUBLIC_APP_URL", Boolean(process.env.NEXT_PUBLIC_APP_URL), "Optional. Public base URL used in share links when behind a proxy."],
              ["RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY), "Optional. Enables password-reset emails. Without it, reset links are shown here for you to send manually."],
              ["ADMIN_EMAILS", Boolean(process.env.ADMIN_EMAILS), "Optional. Comma-separated emails that are automatically administrators."],
              ["ADMIN_PASSWORD", Boolean(process.env.ADMIN_PASSWORD), "Optional. Initial password for the built-in admin account."],
            ].map(([key, set, desc]) => (
              <div key={String(key)} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs font-semibold text-slate-900">{key}</code>
                  <span className={`text-xs font-semibold ${set ? "text-emerald-700" : "text-slate-400"}`}>{set ? "Set" : "Not set"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
