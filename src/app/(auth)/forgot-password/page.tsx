import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Enter your account email and we will generate a reset link.</p>
      <ForgotPasswordForm />
    </>
  );
}
