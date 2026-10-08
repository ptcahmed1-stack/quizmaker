import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(200),
  school: z.string().trim().max(200).optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});

// ---------------------------------------------------------------------------
// Quiz editor payload (autosave). Lenient: drafts may be incomplete.
// ---------------------------------------------------------------------------
export const questionTypeSchema = z.enum(["multiple_choice", "true_false", "short_answer"]);

export const editorOptionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(1000).default(""),
  isCorrect: z.boolean().default(false),
});

export const editorQuestionSchema = z.object({
  id: z.string().uuid(),
  type: questionTypeSchema,
  text: z.string().max(5000).default(""),
  marks: z.coerce.number().int().min(0).max(1000).default(1),
  explanation: z.string().max(5000).default(""),
  expectedAnswer: z.string().max(1000).default(""),
  options: z.array(editorOptionSchema).max(10).default([]),
});

export const editorSettingsSchema = z.object({
  requireStudentName: z.boolean(),
  requireStudentId: z.boolean(),
  allowAnonymous: z.boolean(),
  maxAttempts: z.coerce.number().int().min(0).max(100),
  autoSubmitOnExpiry: z.boolean(),
  randomizeQuestions: z.boolean(),
  randomizeOptions: z.boolean(),
  oneQuestionPerPage: z.boolean(),
  allowNavigation: z.boolean(),
  showScoreImmediately: z.boolean(),
  showCorrectAnswers: z.boolean(),
  showExplanations: z.boolean(),
  resultsReleased: z.boolean(),
  accessCode: z.string().trim().max(50).nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});

export const quizPayloadSchema = z.object({
  title: z.string().max(200).default(""),
  description: z.string().max(5000).default(""),
  subject: z.string().max(100).default(""),
  gradeLevel: z.string().max(100).default(""),
  instructions: z.string().max(5000).default(""),
  timeLimitMinutes: z.coerce.number().int().min(0).max(600).nullable(),
  passingPercentage: z.coerce.number().int().min(0).max(100).default(50),
  settings: editorSettingsSchema,
  questions: z.array(editorQuestionSchema).max(200),
});

export type QuizPayload = z.infer<typeof quizPayloadSchema>;
export type EditorQuestion = z.infer<typeof editorQuestionSchema>;
export type EditorOption = z.infer<typeof editorOptionSchema>;
export type EditorSettings = z.infer<typeof editorSettingsSchema>;

// ---------------------------------------------------------------------------
// Strict validation used before publishing.
// ---------------------------------------------------------------------------
export function validateForPublish(payload: {
  title: string;
  timeLimitMinutes: number | null;
  passingPercentage: number;
  questions: Array<{
    type: string;
    text: string;
    marks: number;
    expectedAnswer: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
}): string[] {
  const errors: string[] = [];
  if (!payload.title.trim()) errors.push("Quiz title is required.");
  if (payload.questions.length === 0) errors.push("Add at least one question before publishing.");
  if (payload.timeLimitMinutes !== null && (payload.timeLimitMinutes < 0 || payload.timeLimitMinutes > 600)) {
    errors.push("Time limit must be between 1 and 600 minutes (or none).");
  }
  if (payload.passingPercentage < 0 || payload.passingPercentage > 100) {
    errors.push("Passing percentage must be between 0 and 100.");
  }
  payload.questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.text.trim()) errors.push(`Question ${n}: question text is required.`);
    if (!Number.isInteger(q.marks) || q.marks < 1) errors.push(`Question ${n}: marks must be at least 1.`);
    if (q.type === "multiple_choice") {
      const filled = q.options.filter((o) => o.text.trim());
      if (filled.length < 2) errors.push(`Question ${n}: provide at least two answer options.`);
      const correct = q.options.filter((o) => o.isCorrect && o.text.trim());
      if (correct.length !== 1) errors.push(`Question ${n}: select exactly one correct answer.`);
    } else if (q.type === "true_false") {
      if (q.options.filter((o) => o.isCorrect).length !== 1) {
        errors.push(`Question ${n}: choose whether True or False is correct.`);
      }
    } else if (q.type === "short_answer") {
      if (!q.expectedAnswer.trim()) errors.push(`Question ${n}: expected answer is required.`);
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Student API payloads
// ---------------------------------------------------------------------------
export const startAttemptSchema = z.object({
  studentName: z.string().trim().max(120).default(""),
  studentId: z.string().trim().max(60).default(""),
  accessCode: z.string().trim().max(50).default(""),
});

export const answerSchema = z.object({
  optionId: z.string().uuid().optional(),
  text: z.string().max(2000).optional(),
});

export const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  token: z.string().min(10).max(200),
  answers: z.record(z.string().uuid(), answerSchema).default({}),
});

export type StudentAnswerInput = z.infer<typeof answerSchema>;
export type StudentAnswersMap = Record<string, StudentAnswerInput>;
