import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Your reset link is valid for one hour.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error">
          This reset link is missing its token. <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>.
        </Alert>
      )}
    </>
  );
}
