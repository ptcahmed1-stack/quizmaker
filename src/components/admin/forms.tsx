"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  assignQuizAction,
  bulkCreateTeachersAction,
  createTeacherAction,
  setTeacherPasswordAction,
  generateResetLinkAction,
  updatePlatformSettingsAction,
  type BulkCreateState,
  type CreateTeacherState,
  type SetPasswordState,
  type ResetLinkState,
  type SettingsState,
} from "@/app/(admin)/actions";
import { CopyButton, PrintButton, SubmitButton } from "@/components/client-bits";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
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

// ---------------------------------------------------------------------------
// Set a teacher's password
// ---------------------------------------------------------------------------
export function SetPasswordForm({ teacherId }: { teacherId: string }) {
  const [state, action] = useActionState<SetPasswordState, FormData>(setTeacherPasswordAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && (
        <Alert tone="success">
          {state.success}
          {state.password && (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span>New password:</span>
              <code className="rounded bg-white px-2 py-1 font-mono font-semibold">{state.password}</code>
              <CopyButton text={state.password} label="Copy" size="sm" />
            </span>
          )}
        </Alert>
      )}
      <Field label="New password" htmlFor="newPassword" hint="Leave empty to generate a secure one (shown once).">
        <Input id="newPassword" name="newPassword" type="text" minLength={8} maxLength={200} autoComplete="off" placeholder="Auto-generate" />
      </Field>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="forceChange" defaultChecked className="mt-0.5 h-4 w-4 accent-indigo-600" />
        Ask them to choose their own password after logging in
      </label>
      <SubmitButton variant="outline" size="sm" pendingText="Saving…">Set password</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bulk-add teachers
// ---------------------------------------------------------------------------
export function BulkCreateForm() {
  const [state, action] = useActionState<BulkCreateState, FormData>(bulkCreateTeachersAction, {});
  const created = state.rows?.filter((r) => r.status === "created") ?? [];
  const credentials = created.map((r) => `${r.name} <${r.email}> — temporary password: ${r.password}`).join("\n");
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Field label="Teachers (one per line)" htmlFor="lines" hint="Format: Full name, email, school (school is optional). Up to 50 per batch. Each gets a temporary password.">
          <Textarea id="lines" name="lines" className="min-h-[150px] font-mono text-sm" placeholder={"Sara Khan, sara@school.edu, City School\nAli Raza, ali@school.edu"} />
        </Field>
        <SubmitButton pendingText="Creating accounts…">Create accounts</SubmitButton>
      </form>

      {state.rows && (
        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {created.length} created · {state.rows.length - created.length} skipped
            </p>
            {created.length > 0 && (
              <div className="flex gap-2">
                <CopyButton text={credentials} label="Copy all logins" size="sm" />
                <PrintButton label="Print" className="h-9 text-sm" />
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2">Teacher</th>
                  <th scope="col" className="px-3 py-2">Result</th>
                  <th scope="col" className="px-4 py-2">Temporary password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.rows.map((r) => (
                  <tr key={`${r.line}-${r.email}`}>
                    <td className="px-4 py-2"><p className="font-medium text-slate-900">{r.name || "—"}</p><p className="text-xs text-slate-500">{r.email || "—"}</p></td>
                    <td className="px-3 py-2">
                      {r.status === "created" ? <Badge tone="green">Created</Badge> : r.status === "exists" ? <Badge tone="amber">Already exists</Badge> : <Badge tone="rose">Invalid</Badge>}
                      {r.message && <p className="mt-0.5 text-xs text-slate-500">{r.message}</p>}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm font-semibold text-slate-900">{r.password ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {created.length > 0 && <p className="border-t border-slate-200 p-3 text-xs text-slate-500">Passwords are shown only now. Teachers are asked to choose their own at first login.</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign a quiz to teachers
// ---------------------------------------------------------------------------
export interface AssignableTeacherOption {
  id: string;
  name: string;
  email: string;
  school: string | null;
  assigned: boolean;
}

export function AssignQuizForm({ quizId, teachers }: { quizId: string; teachers: AssignableTeacherOption[] }) {
  const available = teachers.filter((t) => !t.assigned);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = available.length > 0 && selected.size === available.length;

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        There are no other active teachers yet. <Link href="/admin/teachers/new" className="font-semibold text-indigo-600 underline">Add teachers</Link> first.
      </p>
    );
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      action={assignQuizAction}
      className="space-y-4"
      onSubmit={(e) => {
        if (selected.size === 0) {
          e.preventDefault();
          window.alert("Select at least one teacher.");
        }
      }}
    >
      <input type="hidden" name="quizId" value={quizId} />
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{selected.size} selected</span>
        {available.length > 0 && (
          <button type="button" className="font-semibold text-indigo-600 hover:underline" onClick={() => setSelected(allSelected ? new Set() : new Set(available.map((t) => t.id)))}>
            {allSelected ? "Clear selection" : "Select all available"}
          </button>
        )}
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {teachers.map((t) => (
          <li key={t.id}>
            <label className={`flex items-center gap-3 px-4 py-2.5 ${t.assigned ? "opacity-60" : "cursor-pointer hover:bg-slate-50"}`}>
              <input type="checkbox" name="teacherIds" value={t.id} disabled={t.assigned} checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 accent-indigo-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{t.name}</span>
                <span className="block truncate text-xs text-slate-500">{t.email}{t.school ? ` · ${t.school}` : ""}</span>
              </span>
              {t.assigned && <Badge tone="green">Assigned</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="publishNow" defaultChecked className="mt-0.5 h-4 w-4 accent-indigo-600" />
          <span><span className="font-semibold">Publish for them now</span> — each teacher gets a ready-to-share student link.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="lockContent" defaultChecked className="mt-0.5 h-4 w-4 accent-indigo-600" />
          <span><span className="font-semibold">Lock questions</span> — everyone sits the same paper (teachers can still set timing and result options).</span>
        </label>
      </div>
      <SubmitButton pendingText="Assigning…">Assign to selected teachers</SubmitButton>
      <p className="text-xs text-slate-500">Each teacher receives their own copy with its own link. They only see results from their own students; you see everything.</p>
    </form>
  );
}
