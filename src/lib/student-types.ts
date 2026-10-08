import type { QuestionType } from "@/lib/scoring";

export type QuizAvailability = "open" | "closed" | "not_started" | "ended" | "maintenance" | "unavailable";

/** Public quiz information that is safe to expose to students (no answers). */
export interface PublicQuizInfo {
  id: string;
  code: string;
  title: string;
  description: string;
  instructions: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  questionCount: number;
  totalMarks: number;
  timeLimitMinutes: number | null;
  passingPercentage: number;
  availability: QuizAvailability;
  startsAt: string | null;
  endsAt: string | null;
  requireStudentName: boolean;
  requireStudentId: boolean;
  allowAnonymous: boolean;
  requiresAccessCode: boolean;
  maxAttempts: number;
  oneQuestionPerPage: boolean;
  allowNavigation: boolean;
  autoSubmitOnExpiry: boolean;
  showScoreImmediately: boolean;
  resultsReleased: boolean;
}

/** A question as delivered to the student — never includes the correct answer. */
export interface StudentQuestion {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options: { id: string; text: string }[];
}

export interface StartAttemptResult {
  attemptId: string;
  token: string;
  attemptNumber: number;
  questions: StudentQuestion[];
  /** Seconds remaining (null when there is no time limit). */
  remainingSeconds: number | null;
  startedAt: string;
}

export interface ResultDetail {
  questionId: string;
  position: number;
  type: QuestionType;
  text: string;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  answered: boolean;
  yourAnswer: string;
  correctAnswer: string | null;
  explanation: string | null;
}

export interface SubmitAttemptResult {
  submissionId: string;
  submittedAt: string;
  timeTakenSeconds: number;
  isLate: boolean;
  /** When true, only a confirmation is shown (score hidden by teacher settings). */
  resultsHidden: boolean;
  hiddenReason: "not_released" | "score_hidden" | null;
  score: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  passingPercentage: number;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  totalQuestions: number;
  details: ResultDetail[] | null;
}

export type StudentAnswers = Record<string, { optionId?: string; text?: string }>;
