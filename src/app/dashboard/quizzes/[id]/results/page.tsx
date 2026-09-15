"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";

export default function QuizResultsPage(){
  const params = useParams() as {id:string};
  const id = params.id;
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    fetch(`/api/quizzes/${id}/submissions`).then(r=>r.json()).then(d=>{ setData(d); setLoading(false); });
  },[id]);

  function exportCSV(){
    if (!data?.submissions?.length) return;
    const headers = ["Student Name","Student ID","Score","Total Marks","Percentage","Passed","Time Taken (s)","Attempt","Submitted At"];
    const rows = data.submissions.map((s:any)=>[
      `"${s.student_name.replace(/"/g,'""')}"`,
      `"${(s.student_id||"").replace(/"/g,'""')}"`,
      s.score, s.total_marks, s.percentage, s.passed? "Pass":"Fail", s.time_taken||"", s.attempt_number, new Date(s.submitted_at).toLocaleString()
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`results-${data.quiz.code||id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-10 text-center text-slate-500">Loading results...</div>;
  if (!data) return <div className="p-10 text-center">Not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/quizzes" className="text-sm text-slate-500 hover:underline">← Back to quizzes</Link>
          <h1 className="text-2xl font-bold mt-1">{data.quiz.title} — Results</h1>
          <div className="text-sm text-slate-600">{data.quiz.subject} {data.quiz.grade?`• ${data.quiz.grade}`:""} {data.quiz.code?`• /quiz/${data.quiz.code}`:""}</div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/quizzes/${id}/edit`}><Button variant="secondary">Edit Quiz</Button></Link>
          <Button variant="secondary" onClick={exportCSV} disabled={!data.submissions.length}>Export CSV</Button>
          <Button variant="secondary" onClick={()=>window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 text-center"><div className="text-2xl font-bold">{data.stats.total}</div><div className="text-xs text-slate-500">Attempts</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold">{data.stats.avgPercentage}%</div><div className="text-xs text-slate-500">Avg Score</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{data.stats.highest}%</div><div className="text-xs text-slate-500">Highest</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold text-red-600">{data.stats.lowest}%</div><div className="text-xs text-slate-500">Lowest</div></Card>
        <Card className="p-4 text-center"><div className="text-2xl font-bold">{data.stats.passRate}%</div><div className="text-xs text-slate-500">Pass rate ({data.stats.passedCount}/{data.stats.total})</div></Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Question Analytics</h3>
        {data.analytics.length===0 ? <div className="text-sm text-slate-500">No questions</div> : (
          <div className="space-y-4">
            {data.analytics.map((a:any, idx:number)=>(
              <div key={a.questionId} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm flex-1">Q{idx+1}. {a.text}</div>
                  <Badge variant={a.correctRate>=60?"success": a.correctRate>=40?"warning":"danger"}>{a.correctRate}% correct</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span className="text-emerald-700 font-medium">✓ {a.correct} correct</span>
                  <span className="text-red-600 font-medium">✗ {a.incorrect} incorrect</span>
                  <span>• {a.marks} marks • Correct: <b>{a.correctAnswer}</b></span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-indigo-600 transition-all" style={{width: `${a.correctRate}%`}} />
                </div>
                {Object.keys(a.distribution).length>0 && (
                  <div className="mt-2 text-xs text-slate-500">Distribution: {Object.entries(a.distribution).map(([k,v])=> `${k || "(blank)"}: ${v}`).join(" • ")}</div>
                )}
                {/* options breakdown */}
                {a.options?.length ? (
                  <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
                    {a.options.map((o:any)=> {
                      const count = a.distribution[o.id] || a.distribution[o.text] || 0;
                      const isCorrect = o.id===a.correctAnswer || o.text===a.correctAnswer;
                      return (
                        <div key={o.id} className={`text-xs px-2 py-1.5 rounded-lg border flex justify-between ${isCorrect?"bg-emerald-50 border-emerald-200 text-emerald-800":"bg-white border-slate-200"}`}>
                          <span>{o.text} {isCorrect?"✓":""}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                ): null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Student Submissions</h3>
          <span className="text-xs text-slate-500">{data.submissions.length} total</span>
        </div>
        {data.submissions.length===0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">📭</div>
            <div className="font-medium mt-2">No submissions yet</div>
            <div className="text-sm text-slate-500 mt-1">Share your quiz link with students to start collecting results.</div>
            {data.quiz.code && <div className="mt-4 inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl text-sm font-mono">/quiz/{data.quiz.code}</div>}
            {data.quiz.code && <div className="mt-3 flex gap-2 justify-center">
              <button onClick={async()=>{ await navigator.clipboard.writeText(`${window.location.origin}/quiz/${data.quiz.code}`); alert("Copied!"); }} className="text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-xl">Copy Link</button>
              <a href={`/quiz/${data.quiz.code}`} target="_blank" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-xl">Open Quiz</a>
            </div>}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-left px-4 py-3">Percentage</th>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.submissions.map((s:any)=>(
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.student_name}</div>
                      <div className="text-xs text-slate-500">{s.student_id || "—"}</div>
                    </td>
                    <td className="px-4 py-3">{s.score} / {s.total_marks}</td>
                    <td className="px-4 py-3 font-medium">{s.percentage}%</td>
                    <td className="px-4 py-3">{s.time_taken ? `${Math.floor(s.time_taken/60)}m ${s.time_taken%60}s` : "—"}</td>
                    <td className="px-4 py-3"><Badge variant={s.passed?"success":"danger"}>{s.passed?"Passed":"Failed"}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(s.submitted_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/quizzes/${id}/results/${s.id}`} className="text-indigo-600 hover:underline text-xs font-medium">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
