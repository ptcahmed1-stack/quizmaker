"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";

export default function QuizzesPage(){
  const [quizzes,setQuizzes]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("all");

  async function load(){
    setLoading(true);
    const res = await fetch("/api/quizzes");
    const data = await res.json();
    if (res.ok) setQuizzes(data.quizzes);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const filtered = quizzes.filter(q=> filter==="all" ? true : q.status===filter);

  async function duplicate(id:string){
    const res = await fetch(`/api/quizzes/${id}/duplicate`,{method:"POST"});
    if (res.ok) load();
  }
  async function del(id:string){
    if (!confirm("Delete this quiz and all its submissions? This cannot be undone.")) return;
    await fetch(`/api/quizzes/${id}`,{method:"DELETE"});
    load();
  }
  async function toggleStatus(q:any){
    const newStatus = q.status==="closed" ? "published" : "closed";
    await fetch(`/api/quizzes/${q.id}/close`,{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({status: newStatus})});
    load();
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading quizzes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Quizzes</h1>
          <p className="text-sm text-slate-600">Manage, publish, share and analyze your quizzes.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/import"><Button variant="secondary" size="lg">📊 Import Excel</Button></Link>
          <Link href="/dashboard/create"><Button size="lg">＋ Create Quiz</Button></Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all","published","draft","closed"].map(f=> (
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${filter===f?"bg-slate-900 text-white border-slate-900":"bg-white border-slate-200 text-slate-600"}`}>{f[0].toUpperCase()+f.slice(1)}</button>
        ))}
      </div>

      {filtered.length===0 ? (
        <Card className="p-10 text-center">
          <div className="text-5xl">📚</div>
          <h3 className="mt-3 font-semibold">No {filter!=="all"?filter:""} quizzes</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first quiz to get started.</p>
          <Link href="/dashboard/create" className="inline-block mt-4"><Button>Create Quiz</Button></Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((q:any)=>(
            <Card key={q.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/dashboard/quizzes/${q.id}/edit`} className="font-semibold hover:text-indigo-600 hover:underline truncate">{q.title}</Link>
                    <Badge variant={q.status}>{q.status}</Badge>
                    {q.code && <span className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">/{q.code}</span>}
                  </div>
                  {q.description && <div className="text-sm text-slate-600 mt-1 line-clamp-2">{q.description}</div>}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                    {q.subject && <span>{q.subject}</span>}
                    {q.grade && <span>• {q.grade}</span>}
                    <span>• {q.questionCount} questions</span>
                    <span>• {q.attempts} attempts</span>
                    {q.avgPercentage !== null && <span>• Avg {q.avgPercentage}%</span>}
                    <span>• {new Date(q.updated_at).toLocaleDateString()}</span>
                  </div>
                  {q.code && q.status==="published" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">Student link:</span>
                      <code className="text-xs bg-slate-900 text-white px-2 py-1 rounded-lg truncate max-w-[220px]">{typeof window!=="undefined"? window.location.origin: ""}/quiz/{q.code}</code>
                      <CopyBtn code={q.code} />
                      <a href={`/quiz/${q.code}`} target="_blank" className="text-xs text-indigo-600 hover:underline">Open</a>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 lg:flex-col lg:w-44">
                  <Link href={`/dashboard/quizzes/${q.id}/edit`} className="flex-1 lg:w-full inline-flex items-center justify-center h-8 px-3 rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-50">Edit</Link>
                  <Link href={`/quiz/${q.code||""}`} target="_blank" className={`flex-1 lg:w-full inline-flex items-center justify-center h-8 px-3 rounded-xl text-sm ${q.status==="published"?"bg-slate-900 text-white hover:bg-black":"bg-slate-100 text-slate-400 pointer-events-none"}`}>Preview</Link>
                  <Link href={`/dashboard/quizzes/${q.id}/results`} className="flex-1 lg:w-full inline-flex items-center justify-center h-8 px-3 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700">Results</Link>
                  <div className="w-full flex gap-1.5">
                    <button onClick={()=>duplicate(q.id)} className="flex-1 h-8 px-2 rounded-xl bg-white border border-slate-200 text-xs hover:bg-slate-50">Duplicate</button>
                    <button onClick={()=>del(q.id)} className="flex-1 h-8 px-2 rounded-xl bg-white border border-red-200 text-xs text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                  {q.status==="published" && <button onClick={()=>toggleStatus(q)} className="w-full h-8 px-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 hover:bg-amber-100">Close quiz</button>}
                  {q.status==="closed" && <button onClick={()=>toggleStatus(q)} className="w-full h-8 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 hover:bg-emerald-100">Reopen</button>}
                  {q.status==="draft" && <Link href={`/dashboard/quizzes/${q.id}/edit`} className="w-full h-8 px-3 rounded-xl bg-emerald-600 text-white text-xs inline-flex items-center justify-center hover:bg-emerald-700">Publish →</Link>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyBtn({code}:any){
  const [copied,setCopied]=useState(false);
  return <button onClick={async()=>{
    const url = `${window.location.origin}/quiz/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(()=>setCopied(false),1500);
  }} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50">{copied?"Copied!":"Copy"}</button>
}
