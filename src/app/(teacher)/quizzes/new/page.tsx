"use client";

import { useActionState } from "react";
import { createQuizAction, type FormState } from "@/app/(teacher)/actions";
import { SubmitButton } from "@/components/client-bits";
import { Alert, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";

export default function NewQuizPage() {
  const [state, action] = useActionState<FormState, FormData>(createQuizAction, {});
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create a new quiz" description="Start with the basics. You will add questions and configure settings in the next step." />
      <Card className="p-6">
        <form action={action} className="space-y-5" noValidate>
          {state.error && <Alert tone="error">{state.error}</Alert>}
          <Field label="Quiz title" htmlFor="title" required>
            <Input id="title" name="title" required maxLength={200} placeholder="e.g. Science – Chapter 1 Quiz" autoFocus />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Subject" htmlFor="subject">
              <Input id="subject" name="subject" placeholder="e.g. Science" maxLength={100} />
            </Field>
            <Field label="Grade / Class" htmlFor="gradeLevel">
              <Input id="gradeLevel" name="gradeLevel" placeholder="e.g. Grade 7" maxLength={100} />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="description" hint="Shown to students on the quiz start screen.">
            <Textarea id="description" name="description" maxLength={2000} placeholder="What does this quiz cover?" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton size="lg" pendingText="Creating…">Continue to question builder →</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
