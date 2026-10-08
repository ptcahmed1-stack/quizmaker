"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publishQuizAction, saveQuizAction } from "@/app/(teacher)/actions";
import { CopyButton, useOrigin } from "@/components/client-bits";
import { Alert, Button, Card, Field, Input, LinkButton, Select, StatusBadge, Textarea, Toggle, buttonClass } from "@/components/ui";
import { cn, questionTypeLabel, toDateTimeLocal } from "@/lib/format";
import type { EditorQuestion, QuizPayload } from "@/lib/validation";

type Tab = "details" | "questions" | "settings";
type SaveState = "saved" | "unsaved" | "saving" | "error";
type QType = EditorQuestion["type"];

interface Props {
  quizId: string;
  status: "draft" | "published" | "closed";
  publicCode: string | null;
  initial: QuizPayload;
  submissionCount: number;
  initialPublishErrors: string[];
  originFallback: string;
  notice?: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function blankOptions(count = 4) {
  return Array.from({ length: count }, (_, i) => ({ id: uuid(), text: "", isCorrect: i === 0 }));
}

function newQuestion(type: QType): EditorQuestion {
  const base = { id: uuid(), type, text: "", marks: 1, explanation: "", expectedAnswer: "" };
  if (type === "multiple_choice") return { ...base, options: blankOptions() };
  if (type === "true_false")
    return { ...base, options: [{ id: uuid(), text: "True", isCorrect: true }, { id: uuid(), text: "False", isCorrect: false }] };
  return { ...base, options: [] };
}

export function QuizEditor({ quizId, status, publicCode, initial, submissionCount, initialPublishErrors, originFallback, notice }: Props) {
  const router = useRouter();
  const origin = useOrigin(originFallback);
  const [data, setData] = useState<QuizPayload>(initial);
  const [tab, setTab] = useState<Tab>("questions");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>(initialPublishErrors);
  const [publishing, setPublishing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const latest = useRef(data);
  const dirty = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const studentUrl = publicCode ? `${origin}/quiz/${publicCode}` : null;
  const totalMarks = useMemo(() => data.questions.reduce((s, q) => s + (Number(q.marks) || 0), 0), [data.questions]);

  // ---------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------
  const flush = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setSaveState("saving");
    const run = (async () => {
      const result = await saveQuizAction(quizId, latest.current);
      if (result.ok) {
        setSaveError(null);
        setSaveState(dirty.current ? "unsaved" : "saved");
        return true;
      }
      dirty.current = true;
      setSaveError(result.error);
      setSaveState("error");
      return false;
    })().catch(() => {
      dirty.current = true;
      setSaveError("Connection problem — your latest changes are not saved yet.");
      setSaveState("error");
      return false;
    });
    inflight.current = run;
    const ok = await run;
    inflight.current = null;
    return ok;
  }, [quizId]);

  useEffect(() => {
    latest.current = data;
  }, [data]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Applies a change, marks the quiz dirty and schedules a debounced autosave. */
  const update = useCallback(
    (fn: (d: QuizPayload) => QuizPayload) => {
      setData(fn);
      dirty.current = true;
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1200);
    },
    [flush],
  );

  // Retry failed saves periodically & warn before leaving with unsaved changes.
  useEffect(() => {
    const retry = setInterval(() => {
      if (dirty.current && !inflight.current) void flush();
    }, 8000);
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      clearInterval(retry);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [flush]);

  // ---------------------------------------------------------------------
  // Mutators
  // ---------------------------------------------------------------------
  const patch = (p: Partial<QuizPayload>) => update((d) => ({ ...d, ...p }));
  const patchSettings = (p: Partial<QuizPayload["settings"]>) => update((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  const setQuestions = (fn: (qs: EditorQuestion[]) => EditorQuestion[]) => update((d) => ({ ...d, questions: fn(d.questions) }));
  const patchQuestion = (id: string, p: Partial<EditorQuestion>) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q)));

  const addQuestion = (type: QType) => {
    setQuestions((qs) => [...qs, newQuestion(type)]);
    setTab("questions");
  };
  const removeQuestion = (id: string) => {
    if (!window.confirm("Delete this question?")) return;
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  };
  const duplicateQuestion = (id: string) =>
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      if (i < 0) return qs;
      const src = qs[i];
      const copy: EditorQuestion = { ...src, id: uuid(), options: src.options.map((o) => ({ ...o, id: uuid() })) };
      return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
    });
  const move = (from: number, to: number) =>
    setQuestions((qs) => {
      if (to < 0 || to >= qs.length || from === to) return qs;
      const copy = [...qs];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  const changeType = (q: EditorQuestion, type: QType) => {
    if (type === q.type) return;
    const fresh = newQuestion(type);
    patchQuestion(q.id, { type, options: fresh.options, expectedAnswer: type === "short_answer" ? q.expectedAnswer : "" });
  };

  // ---------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------
  const publish = async () => {
    setPublishing(true);
    setPublishErrors([]);
    const saved = await flush();
    if (!saved) {
      setPublishing(false);
      setPublishErrors(["Your latest changes could not be saved. Please check your connection and try again."]);
      return;
    }
    const result = await publishQuizAction(quizId);
    setPublishing(false);
    if (result.ok) {
      router.push(`/quizzes/${quizId}/share?published=1`);
    } else {
      setPublishErrors(result.errors);
      setTab("questions");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const saveLabel =
    saveState === "saved" ? "All changes saved" : saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : "Save failed";

  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "questions", label: `Questions (${data.questions.length})` },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/quizzes" className="hover:text-indigo-600">My Quizzes</Link>
            <span aria-hidden>/</span>
            <span>Edit</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{data.title || "Untitled Quiz"}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">
            {data.questions.length} {data.questions.length === 1 ? "question" : "questions"} · {totalMarks} marks ·{" "}
            <span className={cn(saveState === "error" ? "text-rose-600" : saveState === "saved" ? "text-emerald-600" : "text-amber-600")}>{saveLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void flush()} disabled={saveState === "saving" || saveState === "saved"}>
            Save now
          </Button>
          <LinkButton href={`/quizzes/${quizId}/preview`} variant="outline">Preview</LinkButton>
          {status === "published" ? (
            <LinkButton href={`/quizzes/${quizId}/share`} variant="secondary">Share link &amp; QR</LinkButton>
          ) : (
            <Button variant="success" onClick={() => void publish()} disabled={publishing}>
              {publishing ? "Publishing…" : status === "closed" ? "Reopen & Publish" : "Publish Quiz"}
            </Button>
          )}
        </div>
      </div>

      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
      {saveError && <div className="mb-4"><Alert tone="error" title="Save problem">{saveError}</Alert></div>}
      {publishErrors.length > 0 && (
        <div className="mb-4">
          <Alert tone="error" title="Fix these before publishing">
            <ul className="list-disc space-y-0.5 pl-5">
              {publishErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </Alert>
        </div>
      )}
      {status === "published" && studentUrl && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm text-emerald-900">
            <p className="font-semibold">This quiz is live.</p>
            <p className="truncate">Student link: <a href={studentUrl} target="_blank" rel="noopener noreferrer" className="font-mono underline">{studentUrl}</a></p>
            {submissionCount > 0 && <p className="mt-1 text-xs">{submissionCount} submission{submissionCount === 1 ? "" : "s"} so far — changing questions may affect existing results.</p>}
          </div>
          <CopyButton text={studentUrl} size="sm" />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Quiz editor sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              tab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Details */}
      {tab === "details" && (
        <Card className="space-y-5 p-6">
          <Field label="Quiz title" htmlFor="title" required>
            <Input id="title" value={data.title} onChange={(e) => patch({ title: e.target.value })} maxLength={200} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Subject" htmlFor="subject"><Input id="subject" value={data.subject} onChange={(e) => patch({ subject: e.target.value })} maxLength={100} /></Field>
            <Field label="Grade / Class" htmlFor="grade"><Input id="grade" value={data.gradeLevel} onChange={(e) => patch({ gradeLevel: e.target.value })} maxLength={100} /></Field>
          </div>
          <Field label="Description" htmlFor="description" hint="Shown to students before they start.">
            <Textarea id="description" value={data.description} onChange={(e) => patch({ description: e.target.value })} maxLength={5000} />
          </Field>
          <Field label="Instructions" htmlFor="instructions" hint="e.g. Answer all questions carefully. Each question has one correct answer.">
            <Textarea id="instructions" value={data.instructions} onChange={(e) => patch({ instructions: e.target.value })} maxLength={5000} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Time limit (minutes)" htmlFor="timeLimit" hint="Leave empty or 0 for no time limit.">
              <Input
                id="timeLimit"
                type="number"
                min={0}
                max={600}
                inputMode="numeric"
                value={data.timeLimitMinutes ?? ""}
                onChange={(e) => patch({ timeLimitMinutes: e.target.value === "" ? null : Math.max(0, Math.min(600, Number(e.target.value))) })}
              />
            </Field>
            <Field label="Passing percentage" htmlFor="passing" hint="Students at or above this percentage pass.">
              <Input
                id="passing"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={data.passingPercentage}
                onChange={(e) => patch({ passingPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              />
            </Field>
          </div>
        </Card>
      )}

      {/* Questions */}
      {tab === "questions" && (
        <div className="space-y-4">
          {data.questions.length === 0 && (
            <Card className="p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-900">No questions yet</h2>
              <p className="mt-1 text-sm text-slate-600">Add your first question using the buttons below. Drag questions to reorder them.</p>
            </Card>
          )}
          {data.questions.map((q, index) => (
            <div
              key={q.id}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn("rounded-2xl transition-shadow", overIndex === index && dragIndex !== index && "ring-2 ring-indigo-400")}
            >
              <QuestionCard
                q={q}
                index={index}
                total={data.questions.length}
                onPatch={(p) => patchQuestion(q.id, p)}
                onTypeChange={(t) => changeType(q, t)}
                onDelete={() => removeQuestion(q.id)}
                onDuplicate={() => duplicateQuestion(q.id)}
                onMove={(dir) => move(index, index + dir)}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                dragging={dragIndex === index}
              />
            </div>
          ))}

          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Add question</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => addQuestion("multiple_choice")}>+ Multiple Choice</Button>
              <Button variant="secondary" onClick={() => addQuestion("true_false")}>+ True / False</Button>
              <Button variant="secondary" onClick={() => addQuestion("short_answer")}>+ Short Answer</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Settings */}
      {tab === "settings" && (
        <div className="space-y-6">
          <SettingsGroup title="Student identification" description="Decide what students must enter before starting.">
            <Toggle label="Allow anonymous submissions" description="Students can start without entering any details. Attempt limits cannot be enforced for anonymous students." checked={data.settings.allowAnonymous} onChange={(v) => patchSettings({ allowAnonymous: v })} />
            <Toggle label="Require student name" checked={data.settings.requireStudentName} disabled={data.settings.allowAnonymous} onChange={(v) => patchSettings({ requireStudentName: v })} />
            <Toggle label="Require student ID / roll number" checked={data.settings.requireStudentId} disabled={data.settings.allowAnonymous} onChange={(v) => patchSettings({ requireStudentId: v })} />
          </SettingsGroup>

          <SettingsGroup title="Attempts" description="How many times the same student (matched by name and ID) may submit.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Attempt policy" htmlFor="attemptPolicy">
                <Select
                  id="attemptPolicy"
                  value={data.settings.maxAttempts === 1 ? "one" : data.settings.maxAttempts === 0 ? "unlimited" : "multiple"}
                  onChange={(e) => patchSettings({ maxAttempts: e.target.value === "one" ? 1 : e.target.value === "unlimited" ? 0 : Math.max(2, data.settings.maxAttempts || 2) })}
                >
                  <option value="one">One attempt per student</option>
                  <option value="multiple">Multiple attempts (set maximum)</option>
                  <option value="unlimited">Unlimited attempts</option>
                </Select>
              </Field>
              {data.settings.maxAttempts > 1 && (
                <Field label="Maximum attempts" htmlFor="maxAttempts">
                  <Input id="maxAttempts" type="number" min={2} max={100} inputMode="numeric" value={data.settings.maxAttempts} onChange={(e) => patchSettings({ maxAttempts: Math.max(2, Math.min(100, Number(e.target.value) || 2)) })} />
                </Field>
              )}
            </div>
          </SettingsGroup>

          <SettingsGroup title="Timing" description={data.timeLimitMinutes ? `Time limit: ${data.timeLimitMinutes} minutes (change it in Details).` : "No time limit. Set one in the Details tab."}>
            <Toggle label="Automatically submit when time expires" description="If off, the quiz locks when time is up and the student must press Submit." checked={data.settings.autoSubmitOnExpiry} onChange={(v) => patchSettings({ autoSubmitOnExpiry: v })} />
          </SettingsGroup>

          <SettingsGroup title="Question settings">
            <Toggle label="Randomize question order" checked={data.settings.randomizeQuestions} onChange={(v) => patchSettings({ randomizeQuestions: v })} />
            <Toggle label="Randomize answer choices" description="Applies to multiple choice questions." checked={data.settings.randomizeOptions} onChange={(v) => patchSettings({ randomizeOptions: v })} />
            <Toggle label="Show one question at a time" description="If off, all questions appear on a single scrolling page." checked={data.settings.oneQuestionPerPage} onChange={(v) => patchSettings({ oneQuestionPerPage: v })} />
            <Toggle label="Allow previous / next navigation" description="If off, students cannot go back to earlier questions." checked={data.settings.allowNavigation} disabled={!data.settings.oneQuestionPerPage} onChange={(v) => patchSettings({ allowNavigation: v })} />
          </SettingsGroup>

          <SettingsGroup title="Result settings" description="What students see after submitting.">
            <Toggle label="Show score immediately" checked={data.settings.showScoreImmediately} onChange={(v) => patchSettings({ showScoreImmediately: v })} />
            <Toggle label="Show correct answers" description="Includes the student's answer and the correct answer for each question." checked={data.settings.showCorrectAnswers} disabled={!data.settings.showScoreImmediately} onChange={(v) => patchSettings({ showCorrectAnswers: v })} />
            <Toggle label="Show explanations" checked={data.settings.showExplanations} disabled={!data.settings.showScoreImmediately || !data.settings.showCorrectAnswers} onChange={(v) => patchSettings({ showExplanations: v })} />
            <Toggle label="Hide results until I release them" description="Students only see a confirmation. You can release results from the Results page." checked={!data.settings.resultsReleased} onChange={(v) => patchSettings({ resultsReleased: !v })} />
          </SettingsGroup>

          <SettingsGroup title="Access" description="Optionally restrict who can start the quiz and when.">
            <Field label="Access code (optional)" htmlFor="accessCode" hint="Students must enter this code to start.">
              <Input id="accessCode" value={data.settings.accessCode ?? ""} onChange={(e) => patchSettings({ accessCode: e.target.value || null })} maxLength={50} placeholder="e.g. ROOM12" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens at (optional)" htmlFor="startsAt">
                <Input id="startsAt" type="datetime-local" value={toDateTimeLocal(data.settings.startsAt)} onChange={(e) => patchSettings({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </Field>
              <Field label="Closes at (optional)" htmlFor="endsAt">
                <Input id="endsAt" type="datetime-local" value={toDateTimeLocal(data.settings.endsAt)} onChange={(e) => patchSettings({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">Publishing and closing the quiz is controlled with the Publish / Close buttons.</p>
          </SettingsGroup>
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{data.questions.length}</span> questions · <span className="font-semibold text-slate-900">{totalMarks}</span> marks
            <span className="hidden sm:inline"> · {saveLabel}</span>
          </p>
          <div className="flex items-center gap-2">
            {tab === "questions" && (
              <Button variant="secondary" size="sm" onClick={() => addQuestion("multiple_choice")}>+ Add question</Button>
            )}
            {status === "published" ? (
              <Link href={`/quizzes/${quizId}/share`} className={buttonClass("primary", "sm")}>Share</Link>
            ) : (
              <Button variant="success" size="sm" onClick={() => void publish()} disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}

interface QuestionCardProps {
  q: EditorQuestion;
  index: number;
  total: number;
  dragging: boolean;
  onPatch: (p: Partial<EditorQuestion>) => void;
  onTypeChange: (t: QType) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function QuestionCard({ q, index, total, dragging, onPatch, onTypeChange, onDelete, onDuplicate, onMove, onDragStart, onDragEnd }: QuestionCardProps) {
  const setOption = (id: string, p: Partial<EditorQuestion["options"][number]>) =>
    onPatch({ options: q.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  const setCorrect = (id: string) => onPatch({ options: q.options.map((o) => ({ ...o, isCorrect: o.id === id })) });
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <Card className={cn("p-4 sm:p-5", dragging && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label={`Drag to reorder question ${index + 1}`}
          title="Drag to reorder"
          className="flex h-9 w-7 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
        <span className="text-sm font-bold text-slate-900">Question {index + 1}</span>
        <label className="sr-only" htmlFor={`type-${q.id}`}>Question type</label>
        <Select id={`type-${q.id}`} value={q.type} onChange={(e) => onTypeChange(e.target.value as QType)} className="h-9 w-auto py-1 text-sm">
          <option value="multiple_choice">{questionTypeLabel("multiple_choice")}</option>
          <option value="true_false">{questionTypeLabel("true_false")}</option>
          <option value="short_answer">{questionTypeLabel("short_answer")}</option>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          Marks
          <Input type="number" min={1} max={1000} inputMode="numeric" value={q.marks} onChange={(e) => onPatch({ marks: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })} className="h-9 w-20 py-1 text-sm" aria-label={`Marks for question ${index + 1}`} />
        </label>
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
          <button type="button" className={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move question down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
          </button>
          <button type="button" className={iconBtn} onClick={onDuplicate} aria-label="Duplicate question" title="Duplicate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </button>
          <button type="button" className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600")} onClick={onDelete} aria-label="Delete question" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`text-${q.id}`} className="sr-only">Question text</label>
        <Textarea id={`text-${q.id}`} value={q.text} onChange={(e) => onPatch({ text: e.target.value })} placeholder="Type your question here…" className="min-h-[72px] text-base" maxLength={5000} />
      </div>

      {q.type === "multiple_choice" && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Answer options — select the correct one</legend>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <div key={o.id} className={cn("flex items-center gap-2 rounded-xl border p-2", o.isCorrect ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200")}>
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={o.isCorrect}
                  onChange={() => setCorrect(o.id)}
                  aria-label={`Mark option ${i + 1} as correct`}
                  className="h-5 w-5 shrink-0 accent-emerald-600"
                />
                <Input value={o.text} onChange={(e) => setOption(o.id, { text: e.target.value })} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1} text`} className="h-10 py-1" maxLength={1000} />
                {o.isCorrect && <span className="hidden shrink-0 text-xs font-semibold text-emerald-700 sm:inline">Correct</span>}
                <button
                  type="button"
                  onClick={() => onPatch({ options: q.options.filter((x) => x.id !== o.id).map((x, j, arr) => ({ ...x, isCorrect: arr.some((y) => y.isCorrect) ? x.isCorrect : j === 0 })) })}
                  disabled={q.options.length <= 2}
                  aria-label={`Remove option ${i + 1}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-30"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            ))}
          </div>
          {q.options.length < 8 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onPatch({ options: [...q.options, { id: uuid(), text: "", isCorrect: false }] })}>
              + Add option
            </Button>
          )}
        </fieldset>
      )}

      {q.type === "true_false" && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Correct answer</legend>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((o) => (
              <label key={o.id} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold", o.isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                <input type="radio" name={`correct-${q.id}`} checked={o.isCorrect} onChange={() => setCorrect(o.id)} className="h-4 w-4 accent-emerald-600" />
                {o.text}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {q.type === "short_answer" && (
        <div className="mt-4">
          <Field label="Expected answer" htmlFor={`expected-${q.id}`} hint="Case and punctuation are ignored. Separate multiple accepted answers with | (e.g. H2O | water)." required>
            <Input id={`expected-${q.id}`} value={q.expectedAnswer} onChange={(e) => onPatch({ expectedAnswer: e.target.value })} maxLength={1000} placeholder="Type the correct answer" />
          </Field>
        </div>
      )}

      <div className="mt-4">
        <Field label="Explanation (optional)" htmlFor={`exp-${q.id}`} hint="Shown to students with their results if enabled in settings.">
          <Textarea id={`exp-${q.id}`} value={q.explanation} onChange={(e) => onPatch({ explanation: e.target.value })} className="min-h-[56px] text-sm" maxLength={5000} placeholder="Why is this the correct answer?" />
        </Field>
      </div>
    </Card>
  );
}
