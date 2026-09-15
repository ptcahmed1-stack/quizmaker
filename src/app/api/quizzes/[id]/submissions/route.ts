import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id = ? AND teacher_id = ?").get(id, user.id) as any;
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawSubs = await db.prepare("SELECT * FROM submissions WHERE quiz_id = ? ORDER BY submitted_at DESC").all(id) as any[];
  const submissions = rawSubs.map((s: any)=>({
    ...s,
    answers: JSON.parse(s.answers_json),
    passed: !!s.passed
  }));

  const rawQs = await db.prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index").all(id) as any[];
  const questions = rawQs.map((q:any)=>({
    ...q,
    options: JSON.parse(q.options_json||"[]")
  }));

  const analytics = questions.map((q:any)=>{
    let correct = 0;
    const dist: Record<string, number> = {};
    for(const s of submissions){
      const ans = s.answers.find((a:any)=> a.questionId===q.id);
      const given = ans?.answer ?? "";
      if (given !== undefined && given !== null) {
        dist[String(given)] = (dist[String(given)]||0)+1;
      }
      const isCorrect = isAnswerCorrect(q, given);
      if (isCorrect) correct++;
    }
    const total = submissions.length || 0;
    return {
      questionId: q.id,
      text: q.text,
      correct,
      incorrect: total - correct,
      correctRate: total ? Math.round((correct/total)*100) : 0,
      distribution: dist,
      marks: q.marks,
      correctAnswer: q.correct_answer,
      type: q.type,
      options: q.options
    };
  });

  const total = submissions.length;
  const avgScore = total ? Math.round(submissions.reduce((a:number,c:any)=>a+c.score,0)/total) : 0;
  const avgPercentage = total ? Math.round(submissions.reduce((a:number,c:any)=>a+c.percentage,0)/total) : 0;
  const highest = total ? Math.max(...submissions.map((s:any)=>s.percentage)) : 0;
  const lowest = total ? Math.min(...submissions.map((s:any)=>s.percentage)) : 0;
  const passedCount = submissions.filter((s:any)=>s.passed).length;
  const passRate = total ? Math.round((passedCount/total)*100) : 0;

  return NextResponse.json({
    quiz,
    submissions,
    questions,
    analytics,
    stats: { total, avgScore, avgPercentage, highest, lowest, passRate, passedCount }
  });
}

function isAnswerCorrect(q:any, given:any){
  if (given===undefined || given===null || String(given).trim()==="") return false;
  const correct = String(q.correct_answer).trim();
  const ans = String(given).trim();
  if (q.type === "short_answer") {
    return ans.toLowerCase() === correct.toLowerCase();
  }
  return ans.toLowerCase() === correct.toLowerCase();
}
