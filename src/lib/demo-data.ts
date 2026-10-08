import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { options, questions, quizSettings, quizzes, teachers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { defaultSettings } from "@/lib/quizzes";
import { recordDemoSubmission } from "@/lib/student";
import type { StudentAnswers } from "@/lib/student-types";
import { generatePublicCode } from "@/lib/utils";

export const DEMO_EMAIL = "demo@quizmaker.app";
export const DEMO_PASSWORD = "demo1234";

type Spec =
  | { type: "mc"; text: string; options: string[]; correct: number; marks?: number; explanation?: string }
  | { type: "tf"; text: string; correct: boolean; marks?: number; explanation?: string }
  | { type: "sa"; text: string; expected: string; marks?: number; explanation?: string };

interface QuizSpec {
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  instructions: string;
  timeLimitMinutes: number | null;
  passingPercentage: number;
  status: "draft" | "published";
  questions: Spec[];
  students: number;
}

const DEMO_QUIZZES: QuizSpec[] = [
  {
    title: "[Demo] General Science – Chapter 1",
    subject: "Science",
    gradeLevel: "Grade 7",
    description: "Demo quiz covering matter, energy and living things from Chapter 1.",
    instructions: "Answer all questions carefully. You have 15 minutes. Each question has exactly one correct answer.",
    timeLimitMinutes: 15,
    passingPercentage: 50,
    status: "published",
    students: 12,
    questions: [
      { type: "mc", text: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correct: 1, explanation: "Mars appears red because of iron oxide (rust) on its surface." },
      { type: "mc", text: "What gas do plants absorb from the air for photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correct: 2, explanation: "Plants take in carbon dioxide and release oxygen." },
      { type: "tf", text: "Water boils at 100 °C at sea level.", correct: true, explanation: "At standard atmospheric pressure water boils at 100 °C." },
      { type: "mc", text: "Which of these is a unit of force?", options: ["Joule", "Watt", "Newton", "Pascal"], correct: 2, marks: 2, explanation: "Force is measured in newtons (N)." },
      { type: "sa", text: "What is the chemical symbol for water?", expected: "H2O", explanation: "Two hydrogen atoms bonded to one oxygen atom." },
      { type: "mc", text: "Which part of the cell is known as the powerhouse?", options: ["Nucleus", "Mitochondria", "Ribosome", "Cell wall"], correct: 1, explanation: "Mitochondria release energy through respiration." },
      { type: "tf", text: "Sound can travel through a vacuum.", correct: false, explanation: "Sound needs a medium (solid, liquid or gas) to travel." },
      { type: "sa", text: "Name the process by which liquid water turns into vapour.", expected: "evaporation | evaporating", explanation: "Evaporation happens at the surface of a liquid below its boiling point." },
    ],
  },
  {
    title: "[Demo] Mathematics Basics",
    subject: "Mathematics",
    gradeLevel: "Grade 6",
    description: "Demo quiz on arithmetic, fractions and simple geometry.",
    instructions: "Show your working on paper if needed. Calculators are not allowed.",
    timeLimitMinutes: 10,
    passingPercentage: 60,
    status: "published",
    students: 8,
    questions: [
      { type: "mc", text: "What is 12 × 8?", options: ["86", "96", "108", "112"], correct: 1 },
      { type: "mc", text: "Which fraction is equal to 0.75?", options: ["1/2", "2/3", "3/4", "4/5"], correct: 2, explanation: "0.75 = 75/100 = 3/4." },
      { type: "sa", text: "What is the value of 7 squared?", expected: "49" },
      { type: "tf", text: "A triangle has interior angles that add up to 180°.", correct: true },
      { type: "mc", text: "What is the perimeter of a square with sides of 6 cm?", options: ["12 cm", "18 cm", "24 cm", "36 cm"], correct: 2, marks: 2, explanation: "Perimeter = 4 × 6 = 24 cm." },
      { type: "sa", text: "What is 15% of 200?", expected: "30", marks: 2, explanation: "10% is 20, 5% is 10, so 15% is 30." },
    ],
  },
  {
    title: "[Demo] English Grammar",
    subject: "English",
    gradeLevel: "Grade 8",
    description: "Demo draft quiz on parts of speech, tenses and punctuation.",
    instructions: "Choose the best answer for each question.",
    timeLimitMinutes: null,
    passingPercentage: 50,
    status: "draft",
    students: 0,
    questions: [
      { type: "mc", text: "Which word is a noun in the sentence: 'The quick fox jumped over the fence'?", options: ["quick", "jumped", "fence", "over"], correct: 2 },
      { type: "mc", text: "Choose the correct past tense of 'go'.", options: ["goed", "gone", "went", "going"], correct: 2 },
      { type: "tf", text: "An adverb usually describes a verb.", correct: true },
      { type: "sa", text: "What punctuation mark ends a question?", expected: "question mark | ?" },
      { type: "mc", text: "Which sentence is written correctly?", options: ["their going home.", "They're going home.", "There going home.", "Theyre going home."], correct: 1 },
      { type: "tf", text: "'Quickly' is an adjective.", correct: false, explanation: "'Quickly' is an adverb; 'quick' is the adjective." },
    ],
  },
];

const STUDENT_NAMES = [
  "Ayesha Khan", "Bilal Ahmed", "Chloe Martin", "Daniel Osei", "Emma Wilson", "Farhan Ali",
  "Grace Lee", "Hassan Raza", "Isabella Rossi", "Jamal Carter", "Kavya Nair", "Liam O'Brien",
];

/** Small deterministic PRNG so demo data looks the same on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generatePublicCode(8);
    const clash = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.publicCode, code)).limit(1);
    if (!clash.length) return code;
  }
  throw new Error("Could not generate unique code");
}

export async function createDemoQuizzes(teacherId: string): Promise<number> {
  const existing = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isDemo, true)))
    .limit(1);
  if (existing.length) return 0;

  let created = 0;
  for (const [qi, spec] of DEMO_QUIZZES.entries()) {
    const code = spec.status === "published" ? await uniqueCode() : null;
    const createdAt = new Date(Date.now() - (14 - qi * 4) * 24 * 60 * 60 * 1000);
    const [quiz] = await db
      .insert(quizzes)
      .values({
        teacherId,
        title: spec.title,
        subject: spec.subject,
        gradeLevel: spec.gradeLevel,
        description: spec.description,
        instructions: spec.instructions,
        timeLimitMinutes: spec.timeLimitMinutes,
        passingPercentage: spec.passingPercentage,
        status: spec.status,
        publicCode: code,
        publishedAt: code ? createdAt : null,
        isDemo: true,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: quizzes.id });
    await db.insert(quizSettings).values({ ...defaultSettings(quiz.id), maxAttempts: spec.status === "published" ? 2 : 1 });

    const inserted: { id: string; type: Spec["type"]; optionIds: string[]; correctIdx: number; expected: string }[] = [];
    for (const [i, q] of spec.questions.entries()) {
      const type = q.type === "mc" ? "multiple_choice" : q.type === "tf" ? "true_false" : "short_answer";
      const [row] = await db
        .insert(questions)
        .values({
          quizId: quiz.id,
          type,
          text: q.text,
          marks: q.marks ?? 1,
          explanation: q.explanation ?? "",
          expectedAnswer: q.type === "sa" ? q.expected : "",
          position: i,
        })
        .returning({ id: questions.id });
      const optionTexts = q.type === "mc" ? q.options : q.type === "tf" ? ["True", "False"] : [];
      const correctIdx = q.type === "mc" ? q.correct : q.type === "tf" ? (q.correct ? 0 : 1) : -1;
      let optionIds: string[] = [];
      if (optionTexts.length) {
        const rows = await db
          .insert(options)
          .values(optionTexts.map((text, j) => ({ questionId: row.id, text, isCorrect: j === correctIdx, position: j })))
          .returning({ id: options.id });
        optionIds = rows.map((r) => r.id);
      }
      inserted.push({ id: row.id, type: q.type, optionIds, correctIdx, expected: q.type === "sa" ? q.expected : "" });
    }
    created++;

    // Demo submissions
    const random = rng(1000 + qi);
    for (let sIdx = 0; sIdx < spec.students; sIdx++) {
      const name = STUDENT_NAMES[sIdx % STUDENT_NAMES.length];
      const skill = 0.45 + random() * 0.5;
      const answers: StudentAnswers = {};
      for (const q of inserted) {
        const r = random();
        if (r > skill + 0.4) continue; // left blank
        const correct = r < skill;
        if (q.type === "sa") {
          const first = q.expected.split("|")[0].trim();
          answers[q.id] = { text: correct ? first : ["water", "42", "not sure", "H2", "condensation"][Math.floor(random() * 5)] };
        } else {
          const wrong = q.optionIds.filter((_, j) => j !== q.correctIdx);
          const pick = correct ? q.optionIds[q.correctIdx] : wrong[Math.floor(random() * wrong.length)];
          answers[q.id] = { optionId: pick };
        }
      }
      const startedAt = new Date(createdAt.getTime() + (sIdx + 1) * 3 * 60 * 60 * 1000);
      const timeTaken = Math.floor(180 + random() * ((spec.timeLimitMinutes ?? 10) * 60 - 200));
      await recordDemoSubmission(quiz.id, { name, studentId: `S${(101 + sIdx).toString()}` }, answers, startedAt, timeTaken);
    }
  }
  return created;
}

/** Removes and re-creates the demo teacher's demo quizzes (admin maintenance tool). */
export async function resetDemoData(): Promise<{ teacherId: string; created: number }> {
  const [existing] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, DEMO_EMAIL)).limit(1);
  const teacherId = existing?.id ?? (await ensureDemoTeacher());
  await db.delete(quizzes).where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isDemo, true)));
  const created = await createDemoQuizzes(teacherId);
  return { teacherId, created };
}

/** Creates (once) the shared demo teacher account with demo quizzes. Returns the teacher id. */
export async function ensureDemoTeacher(): Promise<string> {
  const existing = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, DEMO_EMAIL)).limit(1);
  let id = existing[0]?.id;
  if (!id) {
    const [row] = await db
      .insert(teachers)
      .values({
        name: "Demo Teacher",
        email: DEMO_EMAIL,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        school: "QuizMaker Demo School",
        isDemo: true,
      })
      .returning({ id: teachers.id });
    id = row.id;
  }
  await createDemoQuizzes(id);
  return id;
}
