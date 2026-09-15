import getDb from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";

export default async function SubmissionDetail({ params }: { params: Promise<{id:string, submissionId:string}> }){
  const {id, submissionId} = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const db = await getDb();
  const quiz = await db.prepare("SELECT * FROM quizzes WHERE id=? AND teacher_id=?").get(id, user.id) as any;
  if (!quiz) return notFound();
  const sub = await db.prepare("SELECT * FROM submissions WHERE id=? AND quiz_id=?").get(submissionId, id) as any;
  if (!sub) return notFound();
  const questions = await db.prepare("SELECT * FROM questions WHERE quiz_id=? ORDER BY order_index").all(id) as any[];
  const answers = JSON.parse(sub.answers_json);

  // map
  const detailed = questions.map((q:any, idx:number)=>{
    const ansObj = answers.find((a:any)=> a.questionId===q.id);
    const given = ansObj?.answer ?? "";
    const opts = q.options_json? JSON.parse(q.options_json): [];
    let isCorrect = false;
    const correct = String(q.correct_answer).trim();
    if (given){
      if (q.type==="short_answer") isCorrect = String(given).trim().toLowerCase()===correct.toLowerCase();
      else isCorrect = String(given).trim().toLowerCase()===correct.toLowerCase() || opts.find((o:any)=> o.id===correct && String(o.text).toLowerCase()===String(given).toLowerCase());
    }
    return { q, opts, given, isCorrect, correct, idx };
  });

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/quizzes/${id}/results`} className="text-sm text-slate-500 hover:underline">← Back to results</Link>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{sub.student_name}</h1>
            <div className="text-sm text-slate-600">{sub.student_id? `ID: ${sub.student_id} • `:""}{quiz.title}</div>
            <div className="text-xs text-slate-500 mt-1">Submitted {new Date(sub.submitted_at).toLocaleString()} • Attempt #{sub.attempt_number}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold">{sub.score} / {sub.total_marks}</div>
            <div className="text-lg font-bold text-indigo-600">{sub.percentage}%</div>
            <Badge variant={sub.passed?"success":"danger"} className="mt-1">{sub.passed?"PASSED":"FAILED"}</Badge>
            {sub.time_taken && <div className="text-xs text-slate-500 mt-1">Time: {Math.floor(sub.time_taken/60)}m {sub.time_taken%60}s</div>}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {detailed.map(({q, opts, given, isCorrect, correct, idx})=>(
          <Card key={q.id} className={`p-5 border-l-4 ${isCorrect?"border-l-emerald-500":"border-l-red-500"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">Q{idx+1}. {q.text} <span className="text-xs text-slate-500">({q.marks} marks)</span></div>
              <Badge variant={isCorrect?"success":"danger"}>{isCorrect?"Correct":"Incorrect"}</Badge>
            </div>

            {q.type==="multiple_choice" && (
              <div className="mt-3 space-y-1.5">
                {opts.map((o:any)=> {
                  const isSelected = given===o.id || given===o.text;
                  const isCorrectOpt = o.id===correct || o.text===correct;
                  return (
                    <div key={o.id} className={`h-10 rounded-xl border flex items-center px-3 text-sm justify-between ${isCorrectOpt?"bg-emerald-50 border-emerald-300 text-emerald-800 font-medium": isSelected?"bg-red-50 border-red-300 text-red-800":"bg-white border-slate-200"}`}>
                      <span className="flex items-center gap-2"><span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${isCorrectOpt?"bg-emerald-500 text-white border-emerald-500": isSelected?"bg-red-500 text-white border-red-500":"bg-white"}`}>{isCorrectOpt?"✓":isSelected?"✕":""}</span>{o.text}</span>
                      {isSelected && <span className="text-xs">{isCorrectOpt?"Your answer ✓":"Your answer"}</span>}
                      {isCorrectOpt && !isSelected && <span className="text-xs">Correct answer</span>}
                    </div>
                  );
                })}
                {!given && <div className="text-xs text-slate-500">No answer given</div>}
              </div>
            )}

            {q.type==="true_false" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["true","false"].map(v=>{
                  const isSel = String(given).toLowerCase()===v;
                  const isCorr = correct.toLowerCase()===v;
                  return (
                    <div key={v} className={`h-11 rounded-xl border flex items-center justify-center text-sm capitalize font-medium ${isCorr?"bg-emerald-50 border-emerald-300 text-emerald-800": isSel?"bg-red-50 border-red-300 text-red-800":"bg-white border-slate-200"}`}>
                      {v} {isCorr?"✓":""} {isSel && !isCorr? " (your answer)":""} {isSel && isCorr? " (your answer)":""}
                    </div>
                  );
                })}
              </div>
            )}

            {q.type==="short_answer" && (
              <div className="mt-3 space-y-2">
                <div className={`rounded-xl border p-3 text-sm ${isCorrect?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`}>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Student answer</div>
                  <div className="font-medium mt-1">{given || <span className="text-slate-400">No answer</span>}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Correct answer</div>
                  <div className="font-medium mt-1">{correct}</div>
                </div>
              </div>
            )}

            {q.explanation && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <span className="font-semibold">Explanation:</span> {q.explanation}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
