import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, ensureAdminAccount, isDefaultAdminPasswordInUse } from "@/lib/admin";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Teacher login" };

export default async function LoginPage() {
  await ensureAdminAccount().catch((err) => console.error("admin bootstrap failed", err));
  const showAdminHint = await isDefaultAdminPasswordInUse().catch(() => false);
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Log in to manage your quizzes and results.</p>
      <LoginForm
        demoEmail={DEMO_EMAIL}
        demoPassword={DEMO_PASSWORD}
        adminHint={showAdminHint ? { email: ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD } : null}
      />
    </>
  );
}
