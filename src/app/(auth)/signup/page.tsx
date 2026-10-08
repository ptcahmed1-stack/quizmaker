import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { getPlatformSettings } from "@/lib/admin";

export const metadata: Metadata = { title: "Create teacher account" };

export default async function SignupPage() {
  const settings = await getPlatformSettings();
  if (!settings.allowSignups) {
    return (
      <>
        <h1 className="text-2xl font-bold text-slate-900">Sign-ups are closed</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">New teacher accounts are created by the administrator on this deployment.</p>
        <Alert tone="info">
          {settings.supportEmail ? (
            <>Please contact <a href={`mailto:${settings.supportEmail}`} className="font-semibold underline">{settings.supportEmail}</a> to request an account.</>
          ) : (
            <>Please contact your administrator to request an account.</>
          )}
        </Alert>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Log in</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Create your teacher account</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Free to use. Start building quizzes in minutes.</p>
      <SignupForm />
    </>
  );
}
