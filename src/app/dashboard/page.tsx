import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";

export default async function DashboardPage(){
  const user = await getCurrentUser();
  const db = await getDb();
  const quizzes = await db.prepare("SELECT * FROM quizzes WHERE teacher_id = ? ORDER BY updated_at DESC").all(user.id) as any[];
  const total = quizzes.length;
  const published = quizzes.filter(q=> q.status==="published").length;
  const drafts = quizzes.filter(q=> q.status==="draft").length;
  const totalAttempts = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE teacher_id = ?)").get(user.id) as any;
  const avgRow = await db.prepare("SELECT AVG(percentage) as avg FROM submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE teacher_id = ?)").get(user.id) as any;
  const avg = avgRow?.avg ? Math.round(avgRow.avg) : 0;

  // recent quizzes with stats
  const recent = await db.prepare(`
    SELECT q.*, 
      (SELECT COUNT(*) FROM questions WHERE quiz_id=q.id) as qCount,
      (SELECT COUNT(*) FROM submissions WHERE quiz_id=q.id) as attempts,
      (SELECT AVG(percentage) FROM submissions WHERE quiz_id=q.id) as avgPerc
    FROM quizzes q WHERE teacher_id=? ORDER BY updated_at DESC LIMIT 5
  `).all(user.id) as any[];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.name?.split(" ")[0]} 👋</h1>
        <p className="text-slate-600 text-sm mt-1">Here&apos;s what&apos;s happening with your quizzes today.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quizzes</div>
          <div className="text-3xl font-extrabold mt-2">{total}</div>
          <div className="text-xs text-slate-500 mt-1">{published} published • {drafts} drafts</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Published</div>
          <div className="text-3xl font-extrabold mt-2 text-emerald-600">{published}</div>
          <div className="text-xs text-slate-500 mt-1">Live links active</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attempts</div>
          <div className="text-3xl font-extrabold mt-2">{totalAttempts.c}</div>
          <div className="text-xs text-slate-500 mt-1">Student submissions</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</div>
          <div className="text-3xl font-extrabold mt-2 text-indigo-600">{avg}%</div>
          <div className="text-xs text-slate-500 mt-1">Across all quizzes</div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent Quizzes</h2>
        <Link href="/dashboard/quizzes" className="text-sm text-indigo-600 font-medium hover:underline">View all</Link>
      </div>

      {recent.length===0 ? (
        <Card className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-2xl">📝</div>
          <h3 className="mt-4 font-semibold">No quizzes yet</h3>
          <p className="text-sm text-slate-600 mt-1">Create your first quiz and share it with your students.</p>
          <Link href="/dashboard/create" className="inline-block mt-4"><Button>Create Quiz</Button></Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recent.map((q:any)=>(
            <Card key={q.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{q.title}</span>
                  <Badge variant={q.status}>{q.status}</Badge>
                  {q.subject && <span className="text-xs text-slate-500">• {q.subject}</span>}
                </div>
                <div className="text-sm text-slate-500 mt-1">{q.qCount} Questions {q.grade?`• ${q.grade}`:""} {q.code?`• Code: ${q.code}`:""}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {q.attempts} attempts {q.avgPerc?`• Avg ${Math.round(q.avgPerc)}%`:""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/dashboard/quizzes/${q.id}/edit`}><Button variant="secondary" size="sm">Edit</Button></Link>
                {q.status==="published" ? (
                  <>
                    <Link href={`/dashboard/quizzes/${q.id}/results`}><Button variant="secondary" size="sm">Results</Button></Link>
                    <ShareMini code={q.code} />
                  </>
                ) : (
                  <Link href={`/dashboard/quizzes/${q.id}/edit`}><Button size="sm">Publish</Button></Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Link href="/dashboard/create" className="block">
        <Card className="p-5 border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-white transition-colors flex items-center justify-center gap-2 text-slate-700 font-medium">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">＋</span> Create New Quiz
        </Card>
      </Link>
    </div>
  );
}

function ShareMini({code}:any){
  // client component not needed; we can use a small client island but keep simple link
  return <a href={`/quiz/${code}`} target="_blank" className="inline-flex h-8 px-3 items-center justify-center rounded-xl bg-slate-900 text-white text-sm">Open</a>
}
