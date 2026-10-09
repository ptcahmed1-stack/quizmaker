import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  options,
  questions,
  quizzes,
  studentAnswers,
  submissions,
  type Quiz,
  type QuizSettings,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { getPlatformSettings } from "@/lib/admin";
import { defaultSettings } from "@/lib/quizzes";
import { scoreQuiz, type ScorableQuestion, type ScoreSummary } from "@/lib/scoring";
import type {
  PublicQuizInfo,
  QuizAvailability,
  StartAttemptResult,
  StudentAnswers,
  StudentQuestion,
  SubmitAttemptResult,
} from "@/lib/student-types";
import { generateToken, normalizeCode, sha256, shuffle } from "@/lib/utils";

/** Grace period (seconds) added to the time limit to absorb network latency. */
const TIME_GRACE_SECONDS = 45;

type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

interface AvailabilityContext {
  maintenance: boolean;
  teacherSuspended: boolean;
}

function availabilityOf(quiz: Quiz, settings: QuizSettings, ctx: AvailabilityContext, now = new Date()): QuizAvailability {
  if (ctx.teacherSuspended) return "unavailable";
  if (quiz.status !== "published") return "closed";
  if (ctx.maintenance) return "maintenance";
  if (settings.startsAt && now < settings.startsAt) return "not_started";
  if (settings.endsAt && now > settings.endsAt) return "ended";
  return "open";
}

async function loadQuizByCode(rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const quiz = await db.query.quizzes.findFirst({
    where: eq(quizzes.publicCode, code),
    with: {
      settings: true,
      teacher: { columns: { name: true, status: true } },
      questions: {
        orderBy: [asc(questions.position)],
        with: { options: { orderBy: [asc(options.position)] } },
      },
    },
  });
  if (!quiz || quiz.status === "draft") return null;
  return { ...quiz, settings: quiz.settings ?? defaultSettings(quiz.id) };
}

type LoadedQuiz = NonNullable<Awaited<ReturnType<typeof loadQuizByCode>>>;

async function contextFor(quiz: LoadedQuiz): Promise<AvailabilityContext> {
  const platform = await getPlatformSettings();
  return { maintenance: platform.maintenanceMode, teacherSuspended: quiz.teacher?.status === "suspended" };
}

export async function getPublicQuiz(code: string): Promise<PublicQuizInfo | null> {
  const quiz = await loadQuizByCode(code);
  if (!quiz) return null;
  return toPublicInfo(quiz, await contextFor(quiz));
}

function toPublicInfo(quiz: LoadedQuiz, ctx: AvailabilityContext): PublicQuizInfo {
  const s = quiz.settings;
  return {
    id: quiz.id,
    code: quiz.publicCode ?? "",
    title: quiz.title,
    description: quiz.description,
    instructions: quiz.instructions,
    subject: quiz.subject,
    gradeLevel: quiz.gradeLevel,
    teacherName: quiz.teacher?.name ?? "",
    questionCount: quiz.questions.length,
    totalMarks: quiz.questions.reduce((sum, q) => sum + q.marks, 0),
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    availability: availabilityOf(quiz, s, ctx),
    startsAt: s.startsAt ? s.startsAt.toISOString() : null,
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    requireStudentName: s.requireStudentName && !s.allowAnonymous,
    requireStudentId: s.requireStudentId && !s.allowAnonymous,
    allowAnonymous: s.allowAnonymous,
    requiresAccessCode: Boolean(s.accessCode),
    maxAttempts: s.maxAttempts,
    oneQuestionPerPage: s.oneQuestionPerPage,
    allowNavigation: s.allowNavigation,
    autoSubmitOnExpiry: s.autoSubmitOnExpiry,
    showScoreImmediately: s.showScoreImmediately,
    resultsReleased: s.resultsReleased,
  };
}

function toStudentQuestions(quiz: LoadedQuiz): StudentQuestion[] {
  const list = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    options: (quiz.settings.randomizeOptions && q.type === "multiple_choice" ? shuffle(q.options) : q.options).map(
      (o) => ({ id: o.id, text: o.text }),
    ),
  }));
  return quiz.settings.randomizeQuestions ? shuffle(list) : list;
}

async function countSubmittedAttempts(quizId: string, name: string, studentId: string): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.quizId, quizId),
        eq(submissions.status, "submitted"),
        sql`lower(${submissions.studentName}) = lower(${name})`,
        sql`lower(${submissions.studentIdentifier}) = lower(${studentId})`,
      ),
    );
  return row?.cnt ?? 0;
}

function availabilityMessage(a: QuizAvailability): string {
  switch (a) {
    case "closed":
      return "This quiz is currently closed.";
    case "not_started":
      return "This quiz has not opened yet.";
    case "ended":
      return "This quiz has ended and no longer accepts submissions.";
    case "maintenance":
      return "QuizMaker is briefly down for maintenance. Please try again in a few minutes.";
    case "unavailable":
      return "This quiz is currently unavailable. Please check with your teacher.";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Start attempt
// ---------------------------------------------------------------------------
export async function startAttempt(
  code: string,
  input: { studentName: string; studentId: string; accessCode: string },
): Promise<ServiceResult<StartAttemptResult>> {
  const quiz = await loadQuizByCode(code);
  if (!quiz) return { ok: false, error: "Quiz not found.", status: 404 };
  const availability = availabilityOf(quiz, quiz.settings, await contextFor(quiz));
  if (availability !== "open") return { ok: false, error: availabilityMessage(availability), status: availability === "maintenance" ? 503 : 403 };
  if (quiz.questions.length === 0) return { ok: false, error: "This quiz has no questions yet.", status: 400 };

  const s = quiz.settings;
  const studentName = input.studentName.trim();
  const studentId = input.studentId.trim();

  if (s.accessCode && input.accessCode.trim().toLowerCase() !== s.accessCode.trim().toLowerCase()) {
    return { ok: false, error: "Incorrect access code. Please check with your teacher.", status: 403 };
  }
  if (!s.allowAnonymous) {
    if (s.requireStudentName && !studentName) return { ok: false, error: "Please enter your name.", status: 400 };
    if (s.requireStudentId && !studentId) return { ok: false, error: "Please enter your student ID / roll number.", status: 400 };
  }

  let attemptNumber = 1;
  if (studentName || studentId) {
    const previous = await countSubmittedAttempts(quiz.id, studentName, studentId);
    attemptNumber = previous + 1;
    if (s.maxAttempts > 0 && previous >= s.maxAttempts) {
      return {
        ok: false,
        error:
          s.maxAttempts === 1
            ? "You have already submitted this quiz. Only one attempt is allowed."
            : `You have used all ${s.maxAttempts} allowed attempts for this quiz.`,
        status: 403,
      };
    }
  }

  const token = generateToken(32);
  const startedAt = new Date();
  const [row] = await db
    .insert(submissions)
    .values({
      quizId: quiz.id,
      studentName,
      studentIdentifier: studentId,
      attemptNumber,
      status: "in_progress",
      attemptTokenHash: sha256(token),
      startedAt,
      totalMarks: quiz.questions.reduce((sum, q) => sum + q.marks, 0),
    })
    .returning({ id: submissions.id });

  return {
    ok: true,
    data: {
      attemptId: row.id,
      token,
      attemptNumber,
      questions: toStudentQuestions(quiz),
      remainingSeconds: quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null,
      startedAt: startedAt.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Submit attempt (server-side scoring)
// ---------------------------------------------------------------------------
export async function submitAttempt(
  code: string,
  input: { attemptId: string; token: string; answers: StudentAnswers },
): Promise<ServiceResult<SubmitAttemptResult>> {
  const quiz = await loadQuizByCode(code);
  if (!quiz) return { ok: false, error: "Quiz not found.", status: 404 };

  const submission = await db.query.submissions.findFirst({
    where: and(eq(submissions.id, input.attemptId), eq(submissions.quizId, quiz.id)),
  });
  if (!submission || submission.attemptTokenHash !== sha256(input.token)) {
    return { ok: false, error: "This attempt could not be verified. Please restart the quiz.", status: 403 };
  }

  const scorable: ScorableQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    explanation: q.explanation,
    expectedAnswer: q.expectedAnswer,
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));

  // Idempotent: a retried submission (e.g. after a network drop) returns the stored result.
  if (submission.status === "submitted") {
    const stored = await db.select().from(studentAnswers).where(eq(studentAnswers.submissionId, submission.id));
    const answers: StudentAnswers = {};
    for (const a of stored) {
      answers[a.questionId] = a.selectedOptionId ? { optionId: a.selectedOptionId } : { text: a.answerText ?? undefined };
    }
    const summary = scoreQuiz(scorable, answers, quiz.passingPercentage);
    return {
      ok: true,
      data: buildResult(quiz, {
        ...summary,
        score: submission.score,
        totalMarks: submission.totalMarks,
        percentage: submission.percentage,
        passed: submission.passed,
      }, submission.id, submission.submittedAt ?? new Date(), submission.timeTakenSeconds ?? 0, submission.isLate),
    };
  }

  // Students who already started may still submit during maintenance or after the end time.
  const availability = availabilityOf(quiz, quiz.settings, await contextFor(quiz));
  if (availability === "closed" || availability === "unavailable") {
    return { ok: false, error: availabilityMessage(availability), status: 403 };
  }

  const now = new Date();
  const timeTakenSeconds = Math.max(0, Math.round((now.getTime() - submission.startedAt.getTime()) / 1000));
  const isLate = quiz.timeLimitMinutes
    ? timeTakenSeconds > quiz.timeLimitMinutes * 60 + TIME_GRACE_SECONDS
    : false;

  // Only accept answers for questions that belong to this quiz.
  const validIds = new Set(scorable.map((q) => q.id));
  const answers: StudentAnswers = {};
  for (const [qid, a] of Object.entries(input.answers)) {
    if (validIds.has(qid)) answers[qid] = a;
  }

  const summary = scoreQuiz(scorable, answers, quiz.passingPercentage);

  let recorded = true;
  await db.transaction(async (tx) => {
    // Re-check inside the transaction to prevent double submission races.
    const [fresh] = await tx
      .update(submissions)
      .set({
        status: "submitted",
        submittedAt: now,
        timeTakenSeconds,
        score: summary.score,
        totalMarks: summary.totalMarks,
        percentage: summary.percentage,
        passed: summary.passed,
        isLate,
      })
      .where(and(eq(submissions.id, submission.id), eq(submissions.status, "in_progress")))
      .returning({ id: submissions.id });
    if (!fresh) throw new Error("ALREADY_SUBMITTED");
    if (summary.results.length) {
      await tx.insert(studentAnswers).values(
        summary.results.map((r) => ({
          submissionId: submission.id,
          questionId: r.questionId,
          selectedOptionId: r.selectedOptionId,
          answerText: r.answerText,
          isCorrect: r.isCorrect,
          marksAwarded: r.marksAwarded,
        })),
      );
    }
  }).catch(async (err: unknown) => {
    if (err instanceof Error && err.message === "ALREADY_SUBMITTED") {
      recorded = false;
      return;
    }
    throw err;
  });

  if (recorded) {
    await logActivity(
      { id: quiz.teacherId, name: quiz.teacher?.name ?? "" },
      "student.submitted",
      { quizId: quiz.id, label: quiz.title },
      {
        student: submission.studentName || "Anonymous",
        studentId: submission.studentIdentifier || undefined,
        score: `${summary.score}/${summary.totalMarks}`,
        percentage: summary.percentage,
        passed: summary.passed,
      },
    );
  }

  return { ok: true, data: buildResult(quiz, summary, submission.id, now, timeTakenSeconds, isLate) };
}

function buildResult(
  quiz: LoadedQuiz,
  summary: ScoreSummary,
  submissionId: string,
  submittedAt: Date,
  timeTakenSeconds: number,
  isLate: boolean,
): SubmitAttemptResult {
  const s = quiz.settings;
  const base = {
    submissionId,
    submittedAt: submittedAt.toISOString(),
    timeTakenSeconds,
    isLate,
    totalMarks: summary.totalMarks,
    passingPercentage: quiz.passingPercentage,
    totalQuestions: quiz.questions.length,
  };
  if (!s.resultsReleased || !s.showScoreImmediately) {
    return {
      ...base,
      resultsHidden: true,
      hiddenReason: !s.resultsReleased ? "not_released" : "score_hidden",
      score: null,
      percentage: null,
      passed: null,
      correctCount: null,
      incorrectCount: null,
      unansweredCount: null,
      details: null,
    };
  }
  const positions = new Map(quiz.questions.map((q, i) => [q.id, i + 1]));
  return {
    ...base,
    resultsHidden: false,
    hiddenReason: null,
    score: summary.score,
    percentage: summary.percentage,
    passed: summary.passed,
    correctCount: summary.correctCount,
    incorrectCount: summary.incorrectCount,
    unansweredCount: summary.unansweredCount,
    details: s.showCorrectAnswers
      ? summary.results.map((r) => ({
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
        }))
      : null,
  };
}

/** Used by demo data generation: records a completed submission directly. */
export async function recordDemoSubmission(
  quizId: string,
  student: { name: string; studentId: string },
  answers: StudentAnswers,
  startedAt: Date,
  timeTakenSeconds: number,
) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(quizzes.id, quizId),
    with: { questions: { orderBy: [asc(questions.position)], with: { options: true } } },
  });
  if (!quiz) return;
  const scorable: ScorableQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    explanation: q.explanation,
    expectedAnswer: q.expectedAnswer,
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));
  const summary = scoreQuiz(scorable, answers, quiz.passingPercentage);
  const submittedAt = new Date(startedAt.getTime() + timeTakenSeconds * 1000);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(submissions)
      .values({
        quizId,
        studentName: student.name,
        studentIdentifier: student.studentId,
        attemptNumber: 1,
        status: "submitted",
        attemptTokenHash: sha256(generateToken(16)),
        startedAt,
        submittedAt,
        timeTakenSeconds,
        score: summary.score,
        totalMarks: summary.totalMarks,
        percentage: summary.percentage,
        passed: summary.passed,
        isLate: false,
        createdAt: startedAt,
      })
      .returning({ id: submissions.id });
    await tx.insert(studentAnswers).values(
      summary.results.map((r) => ({
        submissionId: row.id,
        questionId: r.questionId,
        selectedOptionId: r.selectedOptionId,
        answerText: r.answerText,
        isCorrect: r.isCorrect,
        marksAwarded: r.marksAwarded,
      })),
    );
  });
}

