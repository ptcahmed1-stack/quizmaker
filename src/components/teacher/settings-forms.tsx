"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, updateProfileAction, type FormState } from "@/app/(teacher)/actions";
import { SubmitButton } from "@/components/client-bits";
import { Alert, Field, Input } from "@/components/ui";

export function ProfileForm({ name, email, school, isDemo }: { name: string; email: string; school: string; isDemo: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Full name" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={name} required maxLength={100} disabled={isDemo} />
      </Field>
      <Field label="Email" htmlFor="email" hint="Email is used to log in. Ask an administrator if it needs to change.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Field label="School" htmlFor="school">
        <Input id="school" name="school" defaultValue={school} maxLength={200} disabled={isDemo} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…" className={isDemo ? "hidden" : undefined}>Save profile</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ isDemo }: { isDemo: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Current password" htmlFor="currentPassword" required>
        <Input id="currentPassword" name="currentPassword" type={type} autoComplete="current-password" required disabled={isDemo} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" hint="At least 8 characters." required>
          <Input id="newPassword" name="newPassword" type={type} autoComplete="new-password" required minLength={8} disabled={isDemo} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" required>
          <Input id="confirmPassword" name="confirmPassword" type={type} autoComplete="new-password" required minLength={8} disabled={isDemo} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
        Show passwords
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingText="Updating…" className={isDemo ? "hidden" : undefined}>Change password</SubmitButton>
      </div>
    </form>
  );
}
