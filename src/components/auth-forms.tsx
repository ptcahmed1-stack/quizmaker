"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, login, loginAsDemo, resetPassword, signup, type AuthState } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/client-bits";
import { Alert, Field, Input } from "@/components/ui";

const initial: AuthState = {};

export function LoginForm({
  demoEmail,
  demoPassword,
  adminHint,
}: {
  demoEmail: string;
  demoPassword: string;
  adminHint: { email: string; password: string } | null;
}) {
  const [state, action] = useActionState(login, initial);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="font-medium text-indigo-600 hover:underline">Forgot password?</Link>
        </div>
        <SubmitButton className="w-full" size="lg" pendingText="Logging in…">Log in</SubmitButton>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide text-slate-500"><span className="bg-white px-2">or</span></div>
      </div>

      <form action={loginAsDemo} className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4">
        <p className="text-sm font-semibold text-indigo-900">Try the demo account</p>
        <p className="mt-1 text-xs text-indigo-800">
          Explore with sample quizzes and results. Email <span className="font-mono">{demoEmail}</span> · Password <span className="font-mono">{demoPassword}</span>
        </p>
        <SubmitButton variant="secondary" className="mt-3 w-full" pendingText="Preparing demo…">Log in as demo teacher</SubmitButton>
        {adminHint && (
          <p className="mt-3 border-t border-indigo-200 pt-3 text-xs text-indigo-800">
            <span className="font-semibold">Admin panel:</span> log in above with <span className="font-mono">{adminHint.email}</span> · <span className="font-mono">{adminHint.password}</span>. This hint disappears once the default password is changed.
          </p>
        )}
      </form>

      <p className="text-center text-sm text-slate-600">
        New to QuizMaker? <Link href="/signup" className="font-semibold text-indigo-600 hover:underline">Create a free account</Link>
      </p>
    </div>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full name" htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required placeholder="e.g. Sarah Ahmed" />
      </Field>
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </Field>
      <Field label="School (optional)" htmlFor="school">
        <Input id="school" name="school" autoComplete="organization" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPassword, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Back to login</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && (
        <Alert tone="success">
          {state.success} <Link href="/login" className="font-semibold underline">Log in</Link>
        </Alert>
      )}
      <Field label="New password" htmlFor="password" hint="At least 8 characters." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
