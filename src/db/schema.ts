import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const quizStatusEnum = pgEnum("quiz_status", ["draft", "published", "closed"]);
export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "true_false",
  "short_answer",
]);
export const submissionStatusEnum = pgEnum("submission_status", ["in_progress", "submitted"]);
export const teacherRoleEnum = pgEnum("teacher_role", ["teacher", "admin"]);
export const teacherStatusEnum = pgEnum("teacher_status", ["active", "suspended"]);

// ---------------------------------------------------------------------------
// Teachers & auth
// ---------------------------------------------------------------------------
export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    school: text("school"),
    role: teacherRoleEnum("role").notNull().default("teacher"),
    status: teacherStatusEnum("status").notNull().default("active"),
    isDemo: boolean("is_demo").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teachers_email_idx").on(t.email),
    index("teachers_role_idx").on(t.role),
    index("teachers_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Platform administration
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => teachers.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull().default(""),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    details: jsonb("details").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_target_idx").on(t.targetId),
  ],
);

/** Single-row table (id = 1) holding platform-wide settings. */
export const platformSettings = pgTable("platform_settings", {
  id: integer("id").primaryKey(),
  allowSignups: boolean("allow_signups").notNull().default(true),
  announcementEnabled: boolean("announcement_enabled").notNull().default(false),
  announcement: text("announcement").notNull().default(""),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  supportEmail: text("support_email").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid("updated_by_id").references(() => teachers.id, { onDelete: "set null" }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_teacher_idx").on(t.teacherId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_reset_token_hash_idx").on(t.tokenHash)],
);

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    subject: text("subject").notNull().default(""),
    gradeLevel: text("grade_level").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    status: quizStatusEnum("status").notNull().default("draft"),
    publicCode: text("public_code"),
    timeLimitMinutes: integer("time_limit_minutes"),
    passingPercentage: integer("passing_percentage").notNull().default(50),
    isDemo: boolean("is_demo").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quizzes_teacher_idx").on(t.teacherId),
    uniqueIndex("quizzes_public_code_idx").on(t.publicCode),
  ],
);

export const quizSettings = pgTable("quiz_settings", {
  quizId: uuid("quiz_id")
    .primaryKey()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  // Student identification
  requireStudentName: boolean("require_student_name").notNull().default(true),
  requireStudentId: boolean("require_student_id").notNull().default(false),
  allowAnonymous: boolean("allow_anonymous").notNull().default(false),
  // Attempts (0 = unlimited)
  maxAttempts: integer("max_attempts").notNull().default(1),
  // Timing
  autoSubmitOnExpiry: boolean("auto_submit_on_expiry").notNull().default(true),
  // Question behaviour
  randomizeQuestions: boolean("randomize_questions").notNull().default(false),
  randomizeOptions: boolean("randomize_options").notNull().default(false),
  oneQuestionPerPage: boolean("one_question_per_page").notNull().default(true),
  allowNavigation: boolean("allow_navigation").notNull().default(true),
  // Results
  showScoreImmediately: boolean("show_score_immediately").notNull().default(true),
  showCorrectAnswers: boolean("show_correct_answers").notNull().default(true),
  showExplanations: boolean("show_explanations").notNull().default(true),
  resultsReleased: boolean("results_released").notNull().default(true),
  // Access
  accessCode: text("access_code"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
});

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    type: questionTypeEnum("type").notNull().default("multiple_choice"),
    text: text("text").notNull().default(""),
    marks: integer("marks").notNull().default(1),
    explanation: text("explanation").notNull().default(""),
    expectedAnswer: text("expected_answer").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId)],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("options_question_idx").on(t.questionId)],
);

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull().default(""),
    studentIdentifier: text("student_identifier").notNull().default(""),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: submissionStatusEnum("status").notNull().default("in_progress"),
    attemptTokenHash: text("attempt_token_hash").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    timeTakenSeconds: integer("time_taken_seconds"),
    score: integer("score").notNull().default(0),
    totalMarks: integer("total_marks").notNull().default(0),
    percentage: real("percentage").notNull().default(0),
    passed: boolean("passed").notNull().default(false),
    isLate: boolean("is_late").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("submissions_quiz_idx").on(t.quizId),
    index("submissions_quiz_student_idx").on(t.quizId, t.studentName, t.studentIdentifier),
    index("submissions_quiz_status_idx").on(t.quizId, t.status),
  ],
);

export const studentAnswers = pgTable(
  "student_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id").references(() => options.id, {
      onDelete: "set null",
    }),
    answerText: text("answer_text"),
    isCorrect: boolean("is_correct").notNull().default(false),
    marksAwarded: integer("marks_awarded").notNull().default(0),
  },
  (t) => [
    index("student_answers_submission_idx").on(t.submissionId),
    index("student_answers_question_idx").on(t.questionId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const teachersRelations = relations(teachers, ({ many }) => ({
  quizzes: many(quizzes),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  teacher: one(teachers, { fields: [sessions.teacherId], references: [teachers.id] }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  teacher: one(teachers, { fields: [quizzes.teacherId], references: [teachers.id] }),
  settings: one(quizSettings, { fields: [quizzes.id], references: [quizSettings.quizId] }),
  questions: many(questions),
  submissions: many(submissions),
}));

export const quizSettingsRelations = relations(quizSettings, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizSettings.quizId], references: [quizzes.id] }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] }),
  options: many(options),
  answers: many(studentAnswers),
}));

export const optionsRelations = relations(options, ({ one }) => ({
  question: one(questions, { fields: [options.questionId], references: [questions.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [submissions.quizId], references: [quizzes.id] }),
  answers: many(studentAnswers),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  submission: one(submissions, {
    fields: [studentAnswers.submissionId],
    references: [submissions.id],
  }),
  question: one(questions, { fields: [studentAnswers.questionId], references: [questions.id] }),
  selectedOption: one(options, {
    fields: [studentAnswers.selectedOptionId],
    references: [options.id],
  }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Teacher = typeof teachers.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizSettings = typeof quizSettings.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type StudentAnswer = typeof studentAnswers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type QuizStatus = Quiz["status"];
export type QuestionType = Question["type"];
export type TeacherRole = Teacher["role"];
export type TeacherStatus = Teacher["status"];
