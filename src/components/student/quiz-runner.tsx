"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatClock, formatDateTime, formatDuration } from "@/lib/format";
import { scoreQuiz, type ScorableQuestion } from "@/lib/scoring";
import type {
  PublicQuizInfo,
  StartAttemptResult,
  StudentAnswers,
  StudentQuestion,
  SubmitAttemptResult,
} from "@/lib/student-types";

type Phase = "landing" | "quiz" | "submitting" | "result";

interface StoredAttempt {
  attemptId: string;
  token: string;
  attemptNumber: number;
  questions: StudentQuestion[];
  answers: StudentAnswers;
  deadline: number | null;
  startedAt: number;
  studentName: string;
  studentId: string;
  currentIndex: number;
}

interface StoredResult {
  attemptId: string;
  token: string;
  submittedAt: string;
  studentName: string;
}

interface Props {
  quiz: PublicQuizInfo;
  mode: "live" | "preview";
  previewQuestions?: ScorableQuestion[];
  previewResultSettings?: { showCorrectAnswers: boolean; showExplanations: boolean };
}

const attemptKey = (code: string) => `qm:attempt:${code}`;
const resultKey = (code: string) => `qm:result:${code}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}
function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; network?: boolean }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) return { ok: false, error: json.error ?? "Something went wrong. Please try again." };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again.", network: true };
  }
}

export function QuizRunner({ quiz, mode, previewQuestions, previewResultSettings }: Props) {
  const isPreview = mode === "preview";
  const [phase, setPhase] = useState<Phase>("landing");
  const [attempt, setAttempt] = useState<StoredAttempt | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [timeUp, setTimeUp] = useState(false);
  const [starting, setStarting] = useState(false);
  const submittingRef = useRef(false);
  const autoSubmitted = useRef(false);

  // -------------------------------------------------------------------
  // Hydration: restore an in-progress attempt or a previous result.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isPreview) {
      const saved = readJson<StoredAttempt>(attemptKey(quiz.code));
      if (saved && saved.attemptId && saved.token && Array.isArray(saved.questions)) {
        setAttempt(saved);
      }
      setStoredResult(readJson<StoredResult>(resultKey(quiz.code)));
    }
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [quiz.code, isPreview]);

  // Persist attempt on every change.
  useEffect(() => {
    if (!isPreview && attempt && phase !== "result") writeJson(attemptKey(quiz.code), attempt);
  }, [attempt, phase, quiz.code, isPreview]);

  // Warn before leaving an unfinished quiz.
  useEffect(() => {
    if (phase !== "quiz" && phase !== "submitting") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Timer tick.
  useEffect(() => {
    if (phase !== "quiz" || !attempt?.deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase, attempt?.deadline]);

  const remaining = attempt?.deadline ? Math.max(0, Math.floor((attempt.deadline - now) / 1000)) : null;

  // -------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------
  async function start(form: { studentName: string; studentId: string; accessCode: string }) {
    setError(null);
    if (!quiz.allowAnonymous) {
      if (quiz.requireStudentName && !form.studentName.trim()) return setError("Please enter your name.");
      if (quiz.requireStudentId && !form.studentId.trim()) return setError("Please enter your student ID / roll number.");
    }
    if (quiz.requiresAccessCode && !form.accessCode.trim()) return setError("Please enter the access code.");
    setStarting(true);

    let data: StartAttemptResult;
    if (isPreview) {
      data = {
        attemptId: "preview",
        token: "preview",
        attemptNumber: 1,
        questions: (previewQuestions ?? []).map((q) => ({ id: q.id, type: q.type, text: q.text, marks: q.marks, options: q.options.map((o) => ({ id: o.id, text: o.text })) })),
        remainingSeconds: quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null,
        startedAt: new Date().toISOString(),
      };
    } else {
      const res = await postJson<StartAttemptResult>(`/api/quiz/${quiz.code}/start`, form);
      setStarting(false);
      if (!res.ok) return setError(res.error);
      data = res.data;
    }
    setStarting(false);
    autoSubmitted.current = false;
    setTimeUp(false);
    setNow(Date.now());
    setAttempt({
      attemptId: data.attemptId,
      token: data.token,
      attemptNumber: data.attemptNumber,
      questions: data.questions,
      answers: {},
      deadline: data.remainingSeconds !== null ? Date.now() + data.remainingSeconds * 1000 : null,
      startedAt: Date.now(),
      studentName: form.studentName.trim(),
      studentId: form.studentId.trim(),
      currentIndex: 0,
    });
    setPhase("quiz");
    window.scrollTo({ top: 0 });
  }

  function resume() {
    if (!attempt) return;
    setNow(Date.now());
    setPhase("quiz");
  }

  // -------------------------------------------------------------------
  // Submit (server-side scoring)
  // -------------------------------------------------------------------
  const submit = useCallback(async () => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    setConfirmOpen(false);
    setError(null);
    setPhase("submitting");

    if (isPreview) {
      const summary = scoreQuiz(previewQuestions ?? [], attempt.answers, quiz.passingPercentage);
      const s = previewResultSettings ?? { showCorrectAnswers: true, showExplanations: true };
      const hidden = !quiz.resultsReleased || !quiz.showScoreImmediately;
      const positions = new Map((previewQuestions ?? []).map((q, i) => [q.id, i + 1]));
      setResult({
        submissionId: "preview",
        submittedAt: new Date().toISOString(),
        timeTakenSeconds: Math.round((Date.now() - attempt.startedAt) / 1000),
        isLate: false,
        resultsHidden: hidden,
        hiddenReason: hidden ? (!quiz.resultsReleased ? "not_released" : "score_hidden") : null,
        score: hidden ? null : summary.score,
        totalMarks: summary.totalMarks,
        percentage: hidden ? null : summary.percentage,
        passed: hidden ? null : summary.passed,
        passingPercentage: quiz.passingPercentage,
        correctCount: hidden ? null : summary.correctCount,
        incorrectCount: hidden ? null : summary.incorrectCount,
        unansweredCount: hidden ? null : summary.unansweredCount,
        totalQuestions: summary.results.length,
        details:
          hidden || !s.showCorrectAnswers
            ? null
            : summary.results.map((r) => ({
                questionId: r.questionId,
                position: positions.get(r.questionId) ?? 0,
                type: r.type,
                text: r.text,
                marks: r.marks,
                marksAwarded: r.marksAwarded,
                isCorrect: r.isCorrect,
                answered: r.answered,
                yourAnswer: r.yourAnswer,
                correctAnswer: r.correctAnswer,
                explanation: s.showExplanations && r.explanation ? r.explanation : null,
              })),
      });
      submittingRef.current = false;
      setPhase("result");
      window.scrollTo({ top: 0 });
      return;
    }

    // Retry a few times on network failures so answers are never silently lost.
    let lastError = "";
    for (let i = 0; i < 3; i++) {
      const res = await postJson<SubmitAttemptResult>(`/api/quiz/${quiz.code}/submit`, {
        attemptId: attempt.attemptId,
        token: attempt.token,
        answers: attempt.answers,
      });
      if (res.ok) {
        writeJson(resultKey(quiz.code), { attemptId: attempt.attemptId, token: attempt.token, submittedAt: res.data.submittedAt, studentName: attempt.studentName } satisfies StoredResult);
        removeKey(attemptKey(quiz.code));
        setStoredResult(null);
        setResult(res.data);
        submittingRef.current = false;
        setPhase("result");
        window.scrollTo({ top: 0 });
        return;
      }
      lastError = res.error;
      if (!res.network) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    submittingRef.current = false;
    setError(lastError);
    setPhase("quiz");
  }, [attempt, isPreview, previewQuestions, previewResultSettings, quiz]);

  // Auto-submit / lock when the timer expires.
  useEffect(() => {
    if (phase !== "quiz" || remaining === null || remaining > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    setTimeUp(true);
    if (quiz.autoSubmitOnExpiry) void submit();
  }, [remaining, phase, quiz.autoSubmitOnExpiry, submit]);

  // View a previous result (e.g. after the teacher releases results).
  async function viewStoredResult() {
    if (!storedResult) return;
    setError(null);
    setPhase("submitting");
    const res = await postJson<SubmitAttemptResult>(`/api/quiz/${quiz.code}/submit`, { attemptId: storedResult.attemptId, token: storedResult.token, answers: {} });
    if (res.ok) {
      setResult(res.data);
      setPhase("result");
    } else {
      setError(res.error);
      setPhase("landing");
    }
  }

  // -------------------------------------------------------------------
  // Answer helpers
  // -------------------------------------------------------------------
  const setAnswer = (questionId: string, value: { optionId?: string; text?: string }) =>
    setAttempt((a) => (a ? { ...a, answers: { ...a.answers, [questionId]: value } } : a));
  const setIndex = (i: number) => setAttempt((a) => (a ? { ...a, currentIndex: Math.max(0, Math.min(a.questions.length - 1, i)) } : a));

  const answeredCount = useMemo(() => {
    if (!attempt) return 0;
    return attempt.questions.filter((q) => {
      const a = attempt.answers[q.id];
      return a && (a.optionId || (a.text && a.text.trim()));
    }).length;
  }, [attempt]);

  function requestSubmit() {
    if (!attempt) return;
    if (answeredCount < attempt.questions.length) setConfirmOpen(true);
    else void submit();
  }

  // -------------------------------------------------------------------
  // Render (the landing screen is server-rendered; saved attempts are
  // restored from local storage right after hydration)
  // -------------------------------------------------------------------
  const offlineBanner = !online && (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden><path d="M1 1l22 22M16.7 16.7A6 6 0 0 1 6 12M9.3 7.3A6 6 0 0 1 18 12M12 20h.01" /></svg>
      <div>
        <p className="font-semibold">You are offline</p>
        <p>Your answers are saved on this device. Reconnect to the internet to submit — we will retry automatically.</p>
      </div>
    </div>
  );

  if (phase === "landing") {
    return (
      <Landing
        quiz={quiz}
        isPreview={isPreview}
        error={error}
        starting={starting}
        offlineBanner={offlineBanner}
        online={online}
        savedAttempt={attempt && attempt.questions.length ? attempt : null}
        storedResult={storedResult}
        loadedAt={now}
        onResume={resume}
        onDiscard={() => {
          removeKey(attemptKey(quiz.code));
          setAttempt(null);
        }}
        onViewResult={viewStoredResult}
        onStart={start}
      />
    );
  }

  if (phase === "result" && result) {
    return <ResultView quiz={quiz} result={result} isPreview={isPreview} studentName={attempt?.studentName ?? storedResult?.studentName ?? ""} onRestart={() => {
      setResult(null);
      setAttempt(null);
      setPhase("landing");
    }} />;
  }

  if (!attempt) return null;
  const questions = attempt.questions;
  const idx = attempt.currentIndex;
  const q = questions[idx];
  const total = questions.length;
  const isLast = idx === total - 1;
  const locked = timeUp && !quiz.autoSubmitOnExpiry;
  const submitting = phase === "submitting";
  const limitSeconds = (quiz.timeLimitMinutes ?? 0) * 60;
  const warnAt = Math.min(300, Math.round(limitSeconds * 0.25));
  const urgentAt = Math.min(60, Math.round(limitSeconds * 0.1));
  const timerTone =
    remaining !== null && remaining <= urgentAt
      ? "bg-rose-600 text-white"
      : remaining !== null && remaining <= warnAt
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-800";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:pt-6">
      {isPreview && <PreviewBanner />}
      {/* Top bar */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{quiz.title}</p>
            <p className="text-xs text-slate-500">
              {quiz.oneQuestionPerPage ? `Question ${idx + 1} of ${total}` : `${total} questions`} · {answeredCount} answered
            </p>
          </div>
          {remaining !== null && (
            <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-bold tabular-nums", timerTone)} role="timer" aria-live={remaining <= urgentAt ? "assertive" : "off"} aria-label={`Time remaining ${formatClock(remaining)}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {formatClock(remaining)}
            </div>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} aria-label="Questions answered">
          <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${(answeredCount / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      {offlineBanner}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">Submission failed</p>
          <p>{error}</p>
          <button type="button" onClick={() => void submit()} className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">Try again</button>
        </div>
      )}
      {remaining !== null && remaining <= urgentAt && remaining > 0 && (
        <p className="mb-3 text-center text-sm font-semibold text-rose-700">Time is almost up — {remaining} {remaining === 1 ? "second" : "seconds"} left!</p>
      )}
      {locked && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Time is up.</p>
          <p>You can no longer change answers. Please submit now.</p>
        </div>
      )}

      {/* Questions */}
      {quiz.oneQuestionPerPage ? (
        <QuestionView key={q.id} q={q} index={idx} answer={attempt.answers[q.id]} onAnswer={(v) => setAnswer(q.id, v)} disabled={locked || submitting} />
      ) : (
        <div className="space-y-4">
          {questions.map((qq, i) => (
            <QuestionView key={qq.id} q={qq} index={i} answer={attempt.answers[qq.id]} onAnswer={(v) => setAnswer(qq.id, v)} disabled={locked || submitting} />
          ))}
        </div>
      )}

      {/* Question navigator */}
      {quiz.oneQuestionPerPage && quiz.allowNavigation && total > 1 && (
        <nav className="mt-5" aria-label="Jump to question">
          <ol className="flex flex-wrap gap-1.5">
            {questions.map((qq, i) => {
              const a = attempt.answers[qq.id];
              const done = Boolean(a && (a.optionId || (a.text && a.text.trim())));
              return (
                <li key={qq.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === idx ? "step" : undefined}
                    aria-label={`Question ${i + 1}${done ? ", answered" : ", not answered"}`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      i === idx ? "bg-indigo-600 text-white ring-indigo-600" : done ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-white text-slate-500 ring-slate-300",
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {quiz.oneQuestionPerPage ? (
            <>
              {quiz.allowNavigation && (
                <button type="button" onClick={() => setIndex(idx - 1)} disabled={idx === 0 || submitting} className="h-12 flex-1 rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700 disabled:opacity-40">
                  Previous
                </button>
              )}
              {isLast || locked ? (
                <button type="button" onClick={requestSubmit} disabled={submitting} className="h-12 flex-[2] rounded-xl bg-emerald-600 text-base font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
                  {submitting ? "Submitting…" : "Submit Quiz"}
                </button>
              ) : (
                <button type="button" onClick={() => setIndex(idx + 1)} disabled={submitting} className="h-12 flex-[2] rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm hover:bg-indigo-700">
                  Next
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={requestSubmit} disabled={submitting} className="h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? "Submitting…" : `Submit Quiz (${answeredCount}/${total} answered)`}
            </button>
          )}
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="confirm-title" className="text-lg font-bold text-slate-900">Submit quiz?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You still have <strong>{total - answeredCount}</strong> unanswered {total - answeredCount === 1 ? "question" : "questions"}. Are you sure you want to submit?
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700" autoFocus>
                Keep answering
              </button>
              <button type="button" onClick={() => void submit()} className="h-11 flex-1 rounded-xl bg-emerald-600 font-bold text-white">
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function PreviewBanner() {
  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-xs font-semibold text-indigo-800">
      Preview mode — nothing you do here is saved or counted.
    </div>
  );
}

function QuestionView({
  q,
  index,
  answer,
  onAnswer,
  disabled,
}: {
  q: StudentQuestion;
  index: number;
  answer: { optionId?: string; text?: string } | undefined;
  onAnswer: (v: { optionId?: string; text?: string }) => void;
  disabled: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`q-${q.id}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Question {index + 1}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
      </div>
      <h2 id={`q-${q.id}`} className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-snug text-slate-900 sm:text-xl">{q.text}</h2>

      {q.type === "short_answer" ? (
        <div className="mt-4">
          <label htmlFor={`a-${q.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">Your answer</label>
          <input
            id={`a-${q.id}`}
            type="text"
            value={answer?.text ?? ""}
            onChange={(e) => onAnswer({ text: e.target.value })}
            disabled={disabled}
            autoComplete="off"
            className="block h-13 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50"
            placeholder="Type your answer"
          />
        </div>
      ) : (
        <fieldset className="mt-4" disabled={disabled}>
          <legend className="sr-only">Choose one answer</legend>
          <div className={cn("grid gap-2.5", q.type === "true_false" && "sm:grid-cols-2")}>
            {q.options.map((o, i) => {
              const selected = answer?.optionId === o.id;
              return (
                <label key={o.id} className="block cursor-pointer">
                  <input type="radio" name={`q-${q.id}`} value={o.id} checked={selected} onChange={() => onAnswer({ optionId: o.id })} className="peer sr-only" />
                  <span
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-base transition-colors",
                      "peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2",
                      selected ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                      disabled && "opacity-60",
                    )}
                  >
                    <span aria-hidden className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold", selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-500")}>
                      {selected ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        String.fromCharCode(65 + i)
                      )}
                    </span>
                    <span className="whitespace-pre-wrap">{o.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}

function Landing({
  quiz,
  isPreview,
  error,
  starting,
  offlineBanner,
  online,
  savedAttempt,
  storedResult,
  loadedAt,
  onResume,
  onDiscard,
  onViewResult,
  onStart,
}: {
  quiz: PublicQuizInfo;
  isPreview: boolean;
  error: string | null;
  starting: boolean;
  offlineBanner: React.ReactNode;
  online: boolean;
  savedAttempt: StoredAttempt | null;
  storedResult: StoredResult | null;
  loadedAt: number;
  onResume: () => void;
  onDiscard: () => void;
  onViewResult: () => void;
  onStart: (f: { studentName: string; studentId: string; accessCode: string }) => void;
}) {
  const [studentName, setStudentName] = useState(savedAttempt?.studentName ?? "");
  const [studentId, setStudentId] = useState(savedAttempt?.studentId ?? "");
  const [accessCode, setAccessCode] = useState("");
  const open = quiz.availability === "open";
  const savedExpired = savedAttempt?.deadline ? savedAttempt.deadline < loadedAt : false;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
      {isPreview && <PreviewBanner />}
      {offlineBanner}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          {[quiz.subject, quiz.gradeLevel].filter(Boolean).join(" · ") || "Quiz"}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{quiz.title}</h1>
        {quiz.teacherName && <p className="mt-1 text-sm text-slate-500">by {quiz.teacherName}</p>}
        {quiz.description && <p className="mt-3 text-sm text-slate-700 sm:text-base">{quiz.description}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Questions</dt>
            <dd className="text-lg font-bold text-slate-900">{quiz.questionCount}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Time limit</dt>
            <dd className="text-lg font-bold text-slate-900">{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "None"}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Total marks</dt>
            <dd className="text-lg font-bold text-slate-900">{quiz.totalMarks}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Attempts allowed</dt>
            <dd className="text-lg font-bold text-slate-900">{quiz.maxAttempts === 0 ? "Unlimited" : quiz.maxAttempts}</dd>
          </div>
        </dl>

        {quiz.instructions && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{quiz.instructions}</p>
          </div>
        )}

        {!open ? (
          <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-lg font-bold text-slate-900">
              {quiz.availability === "closed"
                ? "This quiz is currently closed."
                : quiz.availability === "not_started"
                  ? "This quiz has not opened yet."
                  : quiz.availability === "ended"
                    ? "This quiz has ended."
                    : quiz.availability === "maintenance"
                      ? "QuizMaker is briefly down for maintenance."
                      : "This quiz is currently unavailable."}
            </p>
            <p className="mt-1 text-sm text-slate-600" suppressHydrationWarning>
              {quiz.availability === "not_started" && quiz.startsAt
                ? `It opens on ${formatDateTime(quiz.startsAt)}.`
                : quiz.availability === "ended" && quiz.endsAt
                  ? `It closed on ${formatDateTime(quiz.endsAt)}.`
                  : quiz.availability === "maintenance"
                    ? "Please try again in a few minutes — the quiz will be back shortly."
                    : "Please check with your teacher."}
            </p>
          </div>
        ) : savedAttempt ? (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="font-bold text-indigo-900">You have an unfinished attempt{savedAttempt.studentName ? ` as ${savedAttempt.studentName}` : ""}.</p>
            <p className="mt-1 text-sm text-indigo-800">
              {savedExpired ? "Its time limit has run out — resume to submit the answers you saved." : "Your answers were saved on this device. Continue where you left off."}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onResume} className="h-12 flex-1 rounded-xl bg-indigo-600 text-base font-bold text-white hover:bg-indigo-700">Resume quiz</button>
              <button type="button" onClick={onDiscard} className="h-12 flex-1 rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700">Start over</button>
            </div>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onStart({ studentName, studentId, accessCode });
            }}
            noValidate
          >
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</div>}
            {storedResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p>You submitted this quiz on {formatDateTime(storedResult.submittedAt)}.</p>
                <button type="button" onClick={onViewResult} className="mt-1 font-semibold underline">View my result</button>
              </div>
            )}
            {(
              <div>
                <label htmlFor="studentName" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Student name {quiz.requireStudentName && <span className="text-rose-600" aria-hidden>*</span>}
                  {quiz.allowAnonymous && <span className="ml-1 font-normal text-slate-500">(optional)</span>}
                </label>
                <input id="studentName" value={studentName} onChange={(e) => setStudentName(e.target.value)} autoComplete="name" required={quiz.requireStudentName} maxLength={120} className="block h-13 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Your full name" />
              </div>
            )}
            {(quiz.requireStudentId || !quiz.allowAnonymous) && (
              <div>
                <label htmlFor="studentId" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Student ID / Roll number {quiz.requireStudentId ? <span className="text-rose-600" aria-hidden>*</span> : <span className="ml-1 font-normal text-slate-500">(optional)</span>}
                </label>
                <input id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)} autoComplete="off" required={quiz.requireStudentId} maxLength={60} className="block h-13 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="e.g. 23" />
              </div>
            )}
            {quiz.requiresAccessCode && (
              <div>
                <label htmlFor="accessCode" className="mb-1.5 block text-sm font-semibold text-slate-800">Access code <span className="text-rose-600" aria-hidden>*</span></label>
                <input id="accessCode" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" autoCapitalize="characters" required maxLength={50} className="block h-13 w-full rounded-xl border border-slate-300 px-4 text-base uppercase tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Enter the code from your teacher" />
              </div>
            )}
            <button type="submit" disabled={starting || (!online && !isPreview)} className="h-14 w-full rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {starting ? "Starting…" : "Start Quiz"}
            </button>
            {quiz.timeLimitMinutes && <p className="text-center text-xs text-slate-500">The {quiz.timeLimitMinutes}-minute timer starts as soon as you press Start.</p>}
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Powered by QuizMaker</p>
    </div>
  );
}

function ResultView({ quiz, result, isPreview, studentName, onRestart }: { quiz: PublicQuizInfo; result: SubmitAttemptResult; isPreview: boolean; studentName: string; onRestart: () => void }) {
  const pct = result.percentage ?? 0;
  const ring = result.passed ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
      {isPreview && <PreviewBanner />}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Quiz complete</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{quiz.title}</h1>
        {studentName && <p className="mt-1 text-sm text-slate-500">{studentName}</p>}

        {result.resultsHidden ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="mt-3 text-lg font-bold text-emerald-900">Your answers have been submitted.</p>
            <p className="mt-1 text-sm text-emerald-800">
              {result.hiddenReason === "not_released" ? "Your teacher will release the results later. You can come back to this link to check." : "Your teacher will share your score with you."}
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-6 flex h-40 w-40 items-center justify-center rounded-full border-8 border-slate-100">
              <div>
                <p className={cn("text-4xl font-extrabold tabular-nums", ring)}>{result.score} / {result.totalMarks}</p>
                <p className="text-lg font-semibold text-slate-600">{pct}%</p>
              </div>
            </div>
            <p className={cn("mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ring-1 ring-inset", result.passed ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200")}>
              {result.passed ? "✓ PASSED" : "✗ NOT PASSED"} <span className="font-medium opacity-70">(pass mark {result.passingPercentage}%)</span>
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs text-emerald-700">Correct</dt><dd className="text-xl font-bold text-emerald-800">{result.correctCount}</dd></div>
              <div className="rounded-xl bg-rose-50 p-3"><dt className="text-xs text-rose-700">Incorrect</dt><dd className="text-xl font-bold text-rose-800">{result.incorrectCount}</dd></div>
              <div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">Total</dt><dd className="text-xl font-bold text-slate-800">{result.totalQuestions}</dd></div>
            </dl>
          </>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Time taken: {formatDuration(result.timeTakenSeconds)} · Submitted {formatDateTime(result.submittedAt)}
          {result.isLate && <span className="ml-1 font-semibold text-amber-700">· Submitted after the time limit</span>}
        </p>
      </div>

      {result.details && (
        <section className="mt-6 space-y-3" aria-label="Question review">
          <h2 className="px-1 text-lg font-bold text-slate-900">Review your answers</h2>
          {result.details.map((d) => (
            <article key={d.questionId} className={cn("rounded-2xl border bg-white p-4 shadow-sm", d.isCorrect ? "border-emerald-200" : "border-rose-200")}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {d.position}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", d.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                  {d.isCorrect ? "✓ Correct" : d.answered ? "✗ Incorrect" : "— Not answered"} · {d.marksAwarded}/{d.marks}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap font-semibold text-slate-900">{d.text}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">Your answer</dt><dd className={cn("font-medium", d.isCorrect ? "text-emerald-800" : "text-rose-800")}>{d.yourAnswer || "—"}</dd></div>
                {!d.isCorrect && d.correctAnswer && <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">Correct answer</dt><dd className="font-medium text-emerald-800">{d.correctAnswer}</dd></div>}
              </dl>
              {d.explanation && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Explanation: </span>{d.explanation}</p>
              )}
            </article>
          ))}
        </section>
      )}

      <div className="mt-6 text-center">
        {isPreview ? (
          <button type="button" onClick={onRestart} className="h-12 rounded-xl border border-slate-300 bg-white px-6 font-semibold text-slate-700">Restart preview</button>
        ) : (
          <p className="text-sm text-slate-500">You can close this page now.</p>
        )}
      </div>
    </div>
  );
}
