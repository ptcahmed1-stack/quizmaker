"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createTeacherAction,
  generateResetLinkAction,
  updatePlatformSettingsAction,
  type CreateTeacherState,
  type ResetLinkState,
  type SettingsState,
} from "@/app/(admin)/actions";
import { CopyButton, SubmitButton } from "@/components/client-bits";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { PlatformSettings } from "@/db/schema";

export function CreateTeacherForm() {
  const [state, action] = useActionState<CreateTeacherState, FormData>(createTeacherAction, {});
  if (state.success && state.teacherId) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Account created">{state.success}</Alert>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <dl className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><dt className="w-32 text-slate-500">Email</dt><dd className="font-mono font-semibold text-slate-900">{state.email}</dd></div>
            {state.tempPassword ? (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="w-32 text-slate-500">Temporary password</dt>
                <dd className="font-mono font-semibold text-slate-900">{state.tempPassword}</dd>
                <CopyButton text={state.tempPassword} label="Copy" size="sm" />
              </div>
            ) : (
              <div className="flex gap-2"><dt className="w-32 text-slate-500">Password</dt><dd className="text-slate-700">The password you entered.</dd></div>
            )}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Ask the teacher to change their password from Settings after their first login.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/teachers/${state.teacherId}`} className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">View account</Link>
          <Link href="/admin/teachers/new" className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Add another</Link>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" required>
          <Input id="name" name="name" required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" required maxLength={200} autoComplete="off" />
        </Field>
        <Field label="School (optional)" htmlFor="school">
          <Input id="school" name="school" maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Role" htmlFor="role">
          <Select id="role" name="role" defaultValue="teacher">
            <option value="teacher">Teacher</option>
            <option value="admin">Administrator</option>
          </Select>
        </Field>
      </div>
      <Field label="Password (optional)" htmlFor="password" hint="Leave empty to generate a secure temporary password that is shown once.">
        <Input id="password" name="password" type="text" minLength={8} maxLength={200} autoComplete="new-password" placeholder="Auto-generate" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Creating…">Create account</SubmitButton>
      </div>
    </form>
  );
}

export function ResetLinkForm({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const [state, action] = useActionState<ResetLinkState, FormData>(generateResetLinkAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.link ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Reset link for {teacherName} (valid 24 hours)</p>
          <p className="mt-1 break-all font-mono text-xs">{state.link}</p>
          <div className="mt-2"><CopyButton text={state.link} label="Copy link" size="sm" /></div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Generate a one-time password reset link you can send to the teacher by email or chat.</p>
      )}
      <SubmitButton variant="outline" size="sm" pendingText="Generating…">{state.link ? "Generate a new link" : "Generate reset link"}</SubmitButton>
    </form>
  );
}

export function SuspendForm({ teacherId, action }: { teacherId: string; action: (formData: FormData) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!window.confirm("Suspend this account? The teacher will be logged out immediately and their published quizzes will become unavailable to students.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="status" value="suspended" />
      <Field label="Reason (optional, visible in audit log)" htmlFor="reason">
        <Input id="reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Policy violation" />
      </Field>
      <SubmitButton variant="danger" size="sm" pendingText="Suspending…">Suspend account</SubmitButton>
    </form>
  );
}

function CheckboxRow({ name, label, description, defaultChecked }: { name: string; label: string; description?: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-indigo-600" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action] = useActionState<SettingsState, FormData>(updatePlatformSettingsAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <CheckboxRow name="allowSignups" label="Allow new teacher sign-ups" description="When off, the sign-up page is closed and only administrators can create accounts." defaultChecked={settings.allowSignups} />
      <CheckboxRow name="maintenanceMode" label="Maintenance mode" description="Students cannot start new attempts (attempts in progress can still be submitted). Teachers see a banner." defaultChecked={settings.maintenanceMode} />
      <CheckboxRow name="announcementEnabled" label="Show announcement to teachers" description="Displays the message below at the top of every teacher page." defaultChecked={settings.announcementEnabled} />
      <Field label="Announcement message" htmlFor="announcement">
        <Textarea id="announcement" name="announcement" defaultValue={settings.announcement} maxLength={1000} placeholder="e.g. Scheduled maintenance on Saturday 8–9 pm." />
      </Field>
      <Field label="Support email (optional)" htmlFor="supportEmail" hint="Shown to teachers on error messages and the sign-up closed page.">
        <Input id="supportEmail" name="supportEmail" type="email" defaultValue={settings.supportEmail} maxLength={200} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

export function DangerButton({ label, confirm, action, pendingText }: { label: string; confirm: string; action: () => Promise<void>; pendingText?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <SubmitButton variant="outline" size="sm" pendingText={pendingText ?? "Working…"}>{label}</SubmitButton>
    </form>
  );
}

export { Button };
