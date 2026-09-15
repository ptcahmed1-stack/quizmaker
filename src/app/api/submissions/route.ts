import { NextRequest, NextResponse } from "next/server";
import getDb, { generateId } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quizCode, quizId, student_name, student_id, student_password, answers, time_taken, startedAt } = body;
    if (!student_name || !student_name.trim()) {
      return NextResponse.json({ error: "Student name required" }, { status: 400 });
    }
    const db = await getDb();
    let quiz: any;
    if (quizCode) {
      quiz = await db.prepare("SELECT * FROM quizzes WHERE code = ?").get(String(quizCode).toUpperCase());
    } else if (quizId) {
      quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ?").get(quizId);
    }
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    if (quiz.status !== "published") {
      return NextResponse.json({ error: "Quiz is not open for submissions" }, { status: 403 });
    }
    const settings = quiz.settings_json ? JSON.parse(quiz.settings_json) : {};
    const authMode = settings.studentAuthMode || "open"; // open | institute | both

    // Institute verification
    if (authMode === "institute" || (authMode === "both" && student_password)) {
      if (!student_id?.trim() || !student_password?.trim()) {
        return NextResponse.json({ error: "Institute ID and password required for this quiz" }, { status: 401 });
      }
      const inst = await db.prepare("SELECT * FROM institute_students WHERE teacher_id=? AND student_id=?").get(quiz.teacher_id, String(student_id).trim()) as any;
      if (!inst) return NextResponse.json({ error: "Invalid institute ID" }, { status: 401 });
      const bcrypt = require("bcryptjs");
      const ok = await bcrypt.compare(String(student_password), inst.password_hash);
      if (!ok) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
      // Use institute name if not provided? Keep submitted name but verify
    } else if (authMode === "institute" && !student_password) {
      return NextResponse.json({ error: "This quiz is for institute students only — ID and password required" }, { status: 401 });
    }

    // Validate required student ID for open mode (if setting requires)
    if (settings.requireStudentId && !student_id?.trim()) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    }
    if (settings.allowAnonymous === false && settings.requireName !== false) {
      // already handled name required
    }

    // Check timing window
    if (settings.startAt && new Date() < new Date(settings.startAt)) {
      return NextResponse.json({ error: "Quiz not started" }, { status: 403 });
    }
    if (settings.endAt && new Date() > new Date(settings.endAt)) {
      return NextResponse.json({ error: "Quiz ended" }, { status: 403 });
    }
    // Check access code
    if (settings.accessCode && body.accessCode !== settings.accessCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
    }

    // Validate attempt limits
    if (settings.attempts === "single" || settings.maxAttempts) {
      const existingCount = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id = ? AND student_name = ? AND (student_id = ? OR ? IS NULL OR ? = '')").get(quiz.id, student_name.trim(), student_id || null, student_id, student_id ) as any;
      // Also check by student_id if provided else by name only
      let count: number;
      if (student_id) {
        const row = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id = ? AND lower(student_name) = lower(?) AND lower(student_id) = lower(?)").get(quiz.id, student_name.trim(), student_id.trim()) as any;
        count = row.c;
      } else {
        const row = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id = ? AND lower(student_name) = lower(?) AND (student_id IS NULL OR student_id='')").get(quiz.id, student_name.trim()) as any;
        count = row.c;
      }
      const max = settings.maxAttempts ? Number(settings.maxAttempts) : (settings.attempts === "single" ? 1 : null);
      if (max && count >= max) {
        return NextResponse.json({ error: `Maximum attempts (${max}) reached` }, { status: 403 });
      }
    }

    const questions = await db.prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index").all(quiz.id) as any[];
    const totalMarks = questions.reduce((s, q)=> s + Number(q.marks||0), 0);

    // Validate time limit server-side: if startedAt provided, check elapsed
    if (quiz.time_limit && startedAt) {
      const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const allowedSec = Number(quiz.time_limit) * 60 + 10; // 10 sec grace
      // we don't strictly reject but record
      // if elapsedSec > allowedSec + 60 we could still accept but flag
    }

    // Score securely server-side
    let score = 0;
    const detailed: any[] = [];
    for (const q of questions) {
      const ansObj = (answers || []).find((a: any)=> a.questionId === q.id);
      const given = ansObj ? String(ansObj.answer ?? "").trim() : "";
      let isCorrect = false;
      const correct = String(q.correct_answer).trim();
      if (given) {
        if (q.type === "short_answer") {
          isCorrect = given.toLowerCase() === correct.toLowerCase();
        } else if (q.type === "true_false") {
          isCorrect = given.toLowerCase() === correct.toLowerCase();
        } else {
          // multiple_choice: compare option id or text case-insensitive
          // options stored as [{id,text}]
          let correctNorm = correct.toLowerCase();
          // if correct is an option id, given might be that id; also check text
          // try to find option matching correct id
          const opts = q.options_json ? JSON.parse(q.options_json) : [];
          const correctOpt = opts.find((o:any)=> o.id===q.correct_answer || o.text===q.correct_answer);
          // Normalize both to id if possible
          isCorrect = given.toLowerCase() === correctNorm;
          // Also allow matching by text if given is text
          if (!isCorrect && correctOpt) {
            isCorrect = given.toLowerCase() === String(correctOpt.text).toLowerCase().trim();
          }
        }
      }
      if (isCorrect) score += Number(q.marks||0);
      detailed.push({
        questionId: q.id,
        answer: given,
        isCorrect,
        marks: Number(q.marks||0),
        earned: isCorrect ? Number(q.marks||0) : 0
      });
    }

    const percentage = totalMarks ? Math.round((score/totalMarks)*100) : 0;
    const passed = percentage >= Number(quiz.passing_percentage || 50);

    // Determine attempt number
    let attemptNumber = 1;
    if (student_id) {
      const row = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id = ? AND lower(student_name)=lower(?) AND lower(student_id)=lower(?)").get(quiz.id, student_name.trim(), student_id.trim()) as any;
      attemptNumber = row.c + 1;
    } else {
      const row = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id = ? AND lower(student_name)=lower(?)").get(quiz.id, student_name.trim()) as any;
      attemptNumber = row.c + 1;
    }

    const id = generateId();
    const now = new Date().toISOString();
    // Store answers with detail but answers_json is student's raw answers
    await db.prepare(`
      INSERT INTO submissions (id, quiz_id, student_name, student_id, answers_json, score, total_marks, percentage, passed, time_taken, attempt_number, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, quiz.id, student_name.trim(), student_id ? student_id.trim() : null,
      JSON.stringify(answers || []),
      score, totalMarks, percentage, passed ? 1 : 0, time_taken ? Number(time_taken) : null, attemptNumber, now
    );

    // Prepare response with result settings considerations
    const showScore = settings.showScoreImmediately !== false;
    const showCorrect = settings.showCorrectAnswers === true;
    const showExplanations = settings.showExplanations === true;

    // Build question results if allowed
    let questionResults = null;
    if (showCorrect || showExplanations) {
      questionResults = questions.map((q:any)=>{
        const det = detailed.find(d=> d.questionId===q.id);
        const opts = q.options_json ? JSON.parse(q.options_json) : [];
        return {
          questionId: q.id,
          text: q.text,
          type: q.type,
          options: opts,
          correctAnswer: showCorrect ? q.correct_answer : undefined,
          explanation: showExplanations ? q.explanation : undefined,
          studentAnswer: det?.answer || "",
          isCorrect: det?.isCorrect || false,
          marks: q.marks,
          earned: det?.earned || 0
        };
      });
    }

    return NextResponse.json({
      submission: {
        id,
        quizId: quiz.id,
        student_name: student_name.trim(),
        student_id: student_id || null,
        score: showScore ? score : undefined,
        totalMarks,
        percentage: showScore ? percentage : undefined,
        passed: showScore ? passed : undefined,
        time_taken,
        attemptNumber,
        submitted_at: now,
        answers: answers || []
      },
      result: {
        score: showScore ? score : null,
        totalMarks,
        percentage: showScore ? percentage : null,
        passed: showScore ? passed : null,
        showScore,
        showCorrect,
        showExplanations,
        questionResults,
        message: settings.hideUntilReleased ? "Results will be available after teacher releases them." : undefined
      },
      settings
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Teacher can fetch? Require auth? For now return 401 if not auth - but we have separate endpoint for teacher submissions
  return NextResponse.json({ error: "Use /api/quizzes/[id]/submissions" }, { status: 400 });
}
