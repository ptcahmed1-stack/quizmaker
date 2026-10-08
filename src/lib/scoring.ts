import { normalizeAnswer } from "@/lib/format";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface ScorableOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  explanation: string;
  expectedAnswer: string;
  options: ScorableOption[];
}

export interface AnswerInput {
  optionId?: string;
  text?: string;
}

export interface QuestionResult {
  questionId: string;
  type: QuestionType;
  text: string;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  answered: boolean;
  selectedOptionId: string | null;
  answerText: string | null;
  /** Human readable version of what the student answered. */
  yourAnswer: string;
  /** Human readable correct answer. */
  correctAnswer: string;
  explanation: string;
}

export interface ScoreSummary {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  results: QuestionResult[];
}

/** Accepts several expected answers separated by "|" (e.g. "H2O | water"). */
export function expectedAnswerList(expected: string): string[] {
  return expected
    .split("|")
    .map((s) => normalizeAnswer(s))
    .filter(Boolean);
}

export function correctAnswerText(q: ScorableQuestion): string {
  if (q.type === "short_answer") {
    return q.expectedAnswer
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" / ");
  }
  return q.options.find((o) => o.isCorrect)?.text ?? "";
}

export function scoreQuestion(q: ScorableQuestion, answer: AnswerInput | undefined): QuestionResult {
  let isCorrect = false;
  let answered = false;
  let selectedOptionId: string | null = null;
  let answerText: string | null = null;
  let yourAnswer = "";

  if (q.type === "short_answer") {
    const text = (answer?.text ?? "").trim();
    if (text) {
      answered = true;
      answerText = text;
      yourAnswer = text;
      isCorrect = expectedAnswerList(q.expectedAnswer).includes(normalizeAnswer(text));
    }
  } else {
    const optionId = answer?.optionId;
    const option = optionId ? q.options.find((o) => o.id === optionId) : undefined;
    if (option) {
      answered = true;
      selectedOptionId = option.id;
      yourAnswer = option.text;
      isCorrect = option.isCorrect;
    }
  }

  return {
    questionId: q.id,
    type: q.type,
    text: q.text,
    marks: q.marks,
    marksAwarded: isCorrect ? q.marks : 0,
    isCorrect,
    answered,
    selectedOptionId,
    answerText,
    yourAnswer,
    correctAnswer: correctAnswerText(q),
    explanation: q.explanation,
  };
}

export function scoreQuiz(
  questions: ScorableQuestion[],
  answers: Record<string, AnswerInput>,
  passingPercentage: number,
): ScoreSummary {
  const results = questions.map((q) => scoreQuestion(q, answers[q.id]));
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const score = results.reduce((sum, r) => sum + r.marksAwarded, 0);
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 1000) / 10 : 0;
  return {
    score,
    totalMarks,
    percentage,
    passed: percentage >= passingPercentage,
    correctCount: results.filter((r) => r.isCorrect).length,
    incorrectCount: results.filter((r) => r.answered && !r.isCorrect).length,
    unansweredCount: results.filter((r) => !r.answered).length,
    results,
  };
}
