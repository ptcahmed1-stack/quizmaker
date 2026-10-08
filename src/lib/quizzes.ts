import "server-only";
import { and, asc, avg, count, desc, eq, inArray, max, min, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  options,
  questions,
  quizSettings,
  quizzes,
  studentAnswers,
  submissions,
  type Option,
  type Question,
  type Quiz,
  type QuizSettings,
  type Submission,
} from "@/db/schema";
import { correctAnswerText } from "@/lib/scoring";
import { generatePublicCode, normalizeAnswer } from "@/lib/utils";
import { validateForPublish, type QuizPayload } from "@/lib/validation";

export type FullQuestion = Question & { options: Option[] };
export type FullQuiz = Quiz & { settings: QuizSettings; questions: FullQuestion[] };

export function defaultSettings(quizId: string): QuizSettings {
  return {
    quizId,
    requireStudentName: true,
    requireStudentId: false,
    allowAnonymous: false,
    maxAttempts: 1,
    autoSubmitOnExpiry: true,
    randomizeQuestions: false,
    randomizeOptions: false,
    oneQuestionPerPage: true,
    allowNavigation: true,
    showScoreImmediately: true,
    showCorrectAnswers: true,
    showExplanations: true,
    resultsReleased: true,
    accessCode: null,
    startsAt: null,
    endsAt: null,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
async function loadFullQuiz(where: SQL): Promise<FullQuiz | null> {
  const quiz = await db.query.quizzes.findFirst({
    where,
    with: {
      settings: true,
      questions: {
        orderBy: [asc(questions.position)],
        with: { options: { orderBy: [asc(options.position)] } },
      },
    },
  });
  if (!quiz) return null;
  return { ...quiz, settings: quiz.settings ?? defaultSettings(quiz.id) };
}

/** Loads a quiz only if it belongs to the given teacher. */
export function getQuizForTeacher(quizId: string, teacherId: string): Promise<FullQuiz | null> {
  return loadFullQuiz(and(eq(quizzes.id, quizId), eq(quizzes.teacherId, teacherId)) as SQL);
}

/** Loads any quiz — for platform administrators only. */
export function getQuizForAdmin(quizId: string): Promise<FullQuiz | null> {
  return loadFullQuiz(eq(quizzes.id, quizId));
}

export interface QuizListItem extends Quiz {
  questionCount: number;
  totalMarks: number;
  attempts: number;
  averagePercentage: number | null;
  lastSubmissionAt: Date | null;
}

export async function listQuizzesForTeacher(teacherId: string): Promise<QuizListItem[]> {
  const rows = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.teacherId, teacherId))
    .orderBy(desc(quizzes.updatedAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [qStats, sStats] = await Promise.all([
    db
      .select({ quizId: questions.quizId, cnt: count(), marks: sum(questions.marks) })
      .from(questions)
      .where(inArray(questions.quizId, ids))
      .groupBy(questions.quizId),
    db
      .select({
        quizId: submissions.quizId,
        attempts: count(),
        avgPct: avg(submissions.percentage),
        last: max(submissions.submittedAt),
      })
      .from(submissions)
      .where(and(inArray(submissions.quizId, ids), eq(submissions.status, "submitted")))
      .groupBy(submissions.quizId),
  ]);

  const qMap = new Map(qStats.map((s) => [s.quizId, s]));
  const sMap = new Map(sStats.map((s) => [s.quizId, s]));

  return rows.map((quiz) => {
    const q = qMap.get(quiz.id);
    const s = sMap.get(quiz.id);
    return {
      ...quiz,
      questionCount: q?.cnt ?? 0,
      totalMarks: Number(q?.marks ?? 0),
      attempts: s?.attempts ?? 0,
      averagePercentage: s?.avgPct !== null && s?.avgPct !== undefined ? Number(s.avgPct) : null,
      lastSubmissionAt: s?.last ?? null,
    };
  });
}

export interface DashboardStats {
  totalQuizzes: number;
  published: number;
  drafts: number;
  closed: number;
  totalAttempts: number;
  averagePercentage: number | null;
}

export async function getDashboardStats(teacherId: string): Promise<DashboardStats> {
  const [statusRows, attemptRows] = await Promise.all([
    db
      .select({ status: quizzes.status, cnt: count() })
      .from(quizzes)
      .where(eq(quizzes.teacherId, teacherId))
      .groupBy(quizzes.status),
    db
      .select({ attempts: count(), avgPct: avg(submissions.percentage) })
      .from(submissions)
      .innerJoin(quizzes, eq(submissions.quizId, quizzes.id))
      .where(and(eq(quizzes.teacherId, teacherId), eq(submissions.status, "submitted"))),
  ]);
  const byStatus = new Map(statusRows.map((r) => [r.status, r.cnt]));
  const published = byStatus.get("published") ?? 0;
  const drafts = byStatus.get("draft") ?? 0;
  const closed = byStatus.get("closed") ?? 0;
  return {
    totalQuizzes: published + drafts + closed,
    published,
    drafts,
    closed,
    totalAttempts: attemptRows[0]?.attempts ?? 0,
    averagePercentage: attemptRows[0]?.avgPct != null ? Number(attemptRows[0].avgPct) : null,
  };
}

// ---------------------------------------------------------------------------
// Results & analytics
// ---------------------------------------------------------------------------
export interface ResultsStats {
  attempts: number;
  averageScore: number | null;
  averagePercentage: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  passCount: number;
  passRate: number | null;
  totalMarks: number;
}

export interface QuestionAnalytics {
  questionId: string;
  position: number;
  text: string;
  type: Question["type"];
  marks: number;
  correctAnswer: string;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  correctRate: number | null;
  mostSelectedIncorrect: { text: string; count: number } | null;
}

export async function getQuizResults(quizId: string, teacherId: string) {
  const quiz = await getQuizForTeacher(quizId, teacherId);
  if (!quiz) return null;
  return computeQuizResults(quiz);
}

/** Admin variant: results for any quiz on the platform. */
export async function getQuizResultsAdmin(quizId: string) {
  const quiz = await getQuizForAdmin(quizId);
  if (!quiz) return null;
  return computeQuizResults(quiz);
}

export type QuizResultsData = NonNullable<Awaited<ReturnType<typeof computeQuizResults>>>;

async function computeQuizResults(quiz: FullQuiz) {
  const quizId = quiz.id;
  const rows = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.quizId, quizId), eq(submissions.status, "submitted")))
    .orderBy(desc(submissions.submittedAt));

  const [agg] = await db
    .select({
      attempts: count(),
      avgScore: avg(submissions.score),
      avgPct: avg(submissions.percentage),
      maxScore: max(submissions.score),
      minScore: min(submissions.score),
      maxPct: max(submissions.percentage),
      minPct: min(submissions.percentage),
      passCount: sql<number>`count(*) filter (where ${submissions.passed})`.mapWith(Number),
    })
    .from(submissions)
    .where(and(eq(submissions.quizId, quizId), eq(submissions.status, "submitted")));

  const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
  const attempts = agg?.attempts ?? 0;
  const stats: ResultsStats = {
    attempts,
    averageScore: agg?.avgScore != null ? Number(agg.avgScore) : null,
    averagePercentage: agg?.avgPct != null ? Number(agg.avgPct) : null,
    highestScore: agg?.maxScore ?? null,
    lowestScore: agg?.minScore ?? null,
    highestPercentage: agg?.maxPct ?? null,
    lowestPercentage: agg?.minPct ?? null,
    passCount: agg?.passCount ?? 0,
    passRate: attempts > 0 ? ((agg?.passCount ?? 0) / attempts) * 100 : null,
    totalMarks,
  };

  const analytics = await getQuestionAnalytics(quiz, attempts);
  return { quiz, submissions: rows, stats, analytics };
}

async function getQuestionAnalytics(quiz: FullQuiz, attempts: number): Promise<QuestionAnalytics[]> {
  if (quiz.questions.length === 0) return [];
  const answers = attempts
    ? await db
        .select({
          questionId: studentAnswers.questionId,
          selectedOptionId: studentAnswers.selectedOptionId,
          answerText: studentAnswers.answerText,
          isCorrect: studentAnswers.isCorrect,
        })
        .from(studentAnswers)
        .innerJoin(submissions, eq(studentAnswers.submissionId, submissions.id))
        .where(and(eq(submissions.quizId, quiz.id), eq(submissions.status, "submitted")))
    : [];

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }

  return quiz.questions.map((q, index) => {
    const list = byQuestion.get(q.id) ?? [];
    const answered = list.filter((a) => a.selectedOptionId || (a.answerText && a.answerText.trim()));
    const correct = list.filter((a) => a.isCorrect).length;
    const incorrectList = answered.filter((a) => !a.isCorrect);
    const counts = new Map<string, { text: string; count: number }>();
    for (const a of incorrectList) {
      let key: string;
      let text: string;
      if (q.type === "short_answer") {
        key = normalizeAnswer(a.answerText ?? "");
        text = (a.answerText ?? "").trim();
      } else {
        key = a.selectedOptionId ?? "";
        text = q.options.find((o) => o.id === a.selectedOptionId)?.text ?? "(removed option)";
      }
      if (!key) continue;
      const entry = counts.get(key) ?? { text, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    const mostSelectedIncorrect =
      [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
    return {
      questionId: q.id,
      position: index + 1,
      text: q.text,
      type: q.type,
      marks: q.marks,
      correctAnswer: correctAnswerText(q),
      answered: answered.length,
      correct,
      incorrect: incorrectList.length,
      unanswered: Math.max(0, attempts - answered.length),
      correctRate: attempts > 0 ? (correct / attempts) * 100 : null,
      mostSelectedIncorrect,
    };
  });
}

export interface SubmissionDetailAnswer {
  questionId: string;
  position: number;
  type: Question["type"];
  text: string;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  answered: boolean;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export async function getSubmissionDetail(quizId: string, submissionId: string, teacherId: string) {
  const quiz = await getQuizForTeacher(quizId, teacherId);
  if (!quiz) return null;
  const submission = await db.query.submissions.findFirst({
    where: and(eq(submissions.id, submissionId), eq(submissions.quizId, quizId)),
    with: { answers: true },
  });
  if (!submission) return null;
  const answerMap = new Map(submission.answers.map((a) => [a.questionId, a]));
  const answers: SubmissionDetailAnswer[] = quiz.questions.map((q, i) => {
    const a = answerMap.get(q.id);
    const selected = a?.selectedOptionId ? q.options.find((o) => o.id === a.selectedOptionId) : undefined;
    const yourAnswer = q.type === "short_answer" ? (a?.answerText ?? "").trim() : (selected?.text ?? "");
    return {
      questionId: q.id,
      position: i + 1,
      type: q.type,
      text: q.text,
      marks: q.marks,
      marksAwarded: a?.marksAwarded ?? 0,
      isCorrect: a?.isCorrect ?? false,
      answered: Boolean(yourAnswer),
      yourAnswer,
      correctAnswer: correctAnswerText(q),
      explanation: q.explanation,
    };
  });
  return { quiz, submission: submission as Submission, answers };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export async function createQuiz(
  teacherId: string,
  input: { title: string; subject?: string; gradeLevel?: string; description?: string },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [quiz] = await tx
      .insert(quizzes)
      .values({
        teacherId,
        title: input.title.trim() || "Untitled Quiz",
        subject: input.subject?.trim() ?? "",
        gradeLevel: input.gradeLevel?.trim() ?? "",
        description: input.description?.trim() ?? "",
      })
      .returning({ id: quizzes.id });
    await tx.insert(quizSettings).values(defaultSettings(quiz.id));
    return quiz.id;
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveQuizPayload(quizId: string, teacherId: string, payload: QuizPayload) {
  const owned = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.teacherId, teacherId)))
    .limit(1);
  if (owned.length === 0) throw new Error("Quiz not found");

  const questionIds = payload.questions.map((q) => q.id);
  const optionIds = payload.questions.flatMap((q) => q.options.map((o) => o.id));

  // Guard against IDs that belong to other quizzes (prevents cross-tenant writes).
  if (questionIds.length) {
    const foreign = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(inArray(questions.id, questionIds), sql`${questions.quizId} <> ${quizId}`));
    if (foreign.length) throw new Error("Invalid question reference");
  }
  if (optionIds.length) {
    const foreign = await db
      .select({ id: options.id })
      .from(options)
      .innerJoin(questions, eq(options.questionId, questions.id))
      .where(and(inArray(options.id, optionIds), sql`${questions.quizId} <> ${quizId}`));
    if (foreign.length) throw new Error("Invalid option reference");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(quizzes)
      .set({
        title: payload.title.trim() || "Untitled Quiz",
        description: payload.description,
        subject: payload.subject,
        gradeLevel: payload.gradeLevel,
        instructions: payload.instructions,
        timeLimitMinutes: payload.timeLimitMinutes && payload.timeLimitMinutes > 0 ? payload.timeLimitMinutes : null,
        passingPercentage: payload.passingPercentage,
        updatedAt: now,
      })
      .where(eq(quizzes.id, quizId));

    const s = payload.settings;
    const settingsRow = {
      requireStudentName: s.requireStudentName,
      requireStudentId: s.requireStudentId,
      allowAnonymous: s.allowAnonymous,
      maxAttempts: s.maxAttempts,
      autoSubmitOnExpiry: s.autoSubmitOnExpiry,
      randomizeQuestions: s.randomizeQuestions,
      randomizeOptions: s.randomizeOptions,
      oneQuestionPerPage: s.oneQuestionPerPage,
      allowNavigation: s.allowNavigation,
      showScoreImmediately: s.showScoreImmediately,
      showCorrectAnswers: s.showCorrectAnswers,
      showExplanations: s.showExplanations,
      resultsReleased: s.resultsReleased,
      accessCode: s.accessCode?.trim() ? s.accessCode.trim() : null,
      startsAt: parseDate(s.startsAt),
      endsAt: parseDate(s.endsAt),
    };
    await tx
      .insert(quizSettings)
      .values({ quizId, ...settingsRow })
      .onConflictDoUpdate({ target: quizSettings.quizId, set: settingsRow });

    const existing = await tx.select({ id: questions.id }).from(questions).where(eq(questions.quizId, quizId));
    const keep = new Set(questionIds);
    const toDelete = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (toDelete.length) await tx.delete(questions).where(inArray(questions.id, toDelete));

    for (const [i, q] of payload.questions.entries()) {
      const qRow = {
        type: q.type,
        text: q.text,
        marks: q.marks,
        explanation: q.explanation,
        expectedAnswer: q.expectedAnswer,
        position: i,
      };
      await tx
        .insert(questions)
        .values({ id: q.id, quizId, ...qRow })
        .onConflictDoUpdate({ target: questions.id, set: qRow });

      const existingOpts = await tx.select({ id: options.id }).from(options).where(eq(options.questionId, q.id));
      const keepOpts = new Set(q.options.map((o) => o.id));
      const delOpts = existingOpts.filter((o) => !keepOpts.has(o.id)).map((o) => o.id);
      if (delOpts.length) await tx.delete(options).where(inArray(options.id, delOpts));
      for (const [j, o] of q.options.entries()) {
        const oRow = { text: o.text, isCorrect: o.isCorrect, position: j };
        await tx
          .insert(options)
          .values({ id: o.id, questionId: q.id, ...oRow })
          .onConflictDoUpdate({ target: options.id, set: oRow });
      }
    }
  });
  return { updatedAt: now };
}

export async function publishQuiz(
  quizId: string,
  teacherId: string,
): Promise<{ ok: true; code: string } | { ok: false; errors: string[] }> {
  const quiz = await getQuizForTeacher(quizId, teacherId);
  if (!quiz) return { ok: false, errors: ["Quiz not found."] };
  const errors = validateForPublish(quiz);
  if (errors.length) return { ok: false, errors };

  let code = quiz.publicCode;
  if (!code) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generatePublicCode(8);
      const clash = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.publicCode, candidate)).limit(1);
      if (clash.length === 0) {
        code = candidate;
        break;
      }
    }
    if (!code) return { ok: false, errors: ["Could not generate a unique quiz code. Please try again."] };
  }
  await db
    .update(quizzes)
    .set({ status: "published", publicCode: code, publishedAt: quiz.publishedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));
  return { ok: true, code };
}

export async function setQuizStatus(quizId: string, teacherId: string, status: "closed" | "published" | "draft") {
  await db
    .update(quizzes)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(quizzes.id, quizId), eq(quizzes.teacherId, teacherId)));
}

export async function setResultsReleased(quizId: string, teacherId: string, released: boolean) {
  const quiz = await getQuizForTeacher(quizId, teacherId);
  if (!quiz) return;
  await db
    .insert(quizSettings)
    .values({ ...quiz.settings, quizId, resultsReleased: released })
    .onConflictDoUpdate({ target: quizSettings.quizId, set: { resultsReleased: released } });
}

export async function deleteQuiz(quizId: string, teacherId: string) {
  await db.delete(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.teacherId, teacherId)));
}

export async function duplicateQuiz(quizId: string, teacherId: string): Promise<string | null> {
  const source = await getQuizForTeacher(quizId, teacherId);
  if (!source) return null;
  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(quizzes)
      .values({
        teacherId,
        title: `${source.title} - Version 2`,
        description: source.description,
        subject: source.subject,
        gradeLevel: source.gradeLevel,
        instructions: source.instructions,
        status: "draft",
        publicCode: null,
        timeLimitMinutes: source.timeLimitMinutes,
        passingPercentage: source.passingPercentage,
        isDemo: source.isDemo,
      })
      .returning({ id: quizzes.id });
    const { quizId: _ignored, ...settingsRest } = source.settings;
    void _ignored;
    await tx.insert(quizSettings).values({ ...settingsRest, quizId: copy.id });
    for (const q of source.questions) {
      const [nq] = await tx
        .insert(questions)
        .values({
          quizId: copy.id,
          type: q.type,
          text: q.text,
          marks: q.marks,
          explanation: q.explanation,
          expectedAnswer: q.expectedAnswer,
          position: q.position,
        })
        .returning({ id: questions.id });
      if (q.options.length) {
        await tx.insert(options).values(
          q.options.map((o) => ({ questionId: nq.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
        );
      }
    }
    return copy.id;
  });
}

/** Converts a DB quiz into the editor payload shape. */
export function toEditorPayload(quiz: FullQuiz): QuizPayload {
  const s = quiz.settings;
  return {
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    gradeLevel: quiz.gradeLevel,
    instructions: quiz.instructions,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingPercentage: quiz.passingPercentage,
    settings: {
      requireStudentName: s.requireStudentName,
      requireStudentId: s.requireStudentId,
      allowAnonymous: s.allowAnonymous,
      maxAttempts: s.maxAttempts,
      autoSubmitOnExpiry: s.autoSubmitOnExpiry,
      randomizeQuestions: s.randomizeQuestions,
      randomizeOptions: s.randomizeOptions,
      oneQuestionPerPage: s.oneQuestionPerPage,
      allowNavigation: s.allowNavigation,
      showScoreImmediately: s.showScoreImmediately,
      showCorrectAnswers: s.showCorrectAnswers,
      showExplanations: s.showExplanations,
      resultsReleased: s.resultsReleased,
      accessCode: s.accessCode,
      startsAt: s.startsAt ? s.startsAt.toISOString() : null,
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    },
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      marks: q.marks,
      explanation: q.explanation,
      expectedAnswer: q.expectedAnswer,
      options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    })),
  };
}
