"use client";

import { useActionState } from "react";
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
      <Field label="Email" htmlFor="email" hint="Email is used to log in and cannot be changed here.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Field label="School" htmlFor="school">
        <Input id="school" name="school" defaultValue={school} maxLength={200} disabled={isDemo} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ isDemo }: { isDemo: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Current password" htmlFor="currentPassword" required>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required disabled={isDemo} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" hint="At least 8 characters." required>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} disabled={isDemo} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" required>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} disabled={isDemo} />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Updating…">Change password</SubmitButton>
      </div>
    </form>
  );
}
