import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";

export default function Home(){
  return (
    <div className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">Q</div>
            <span className="text-xl font-bold tracking-tight">QuizMaker</span>
            <span className="hidden sm:inline ml-2 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-200">for Teachers</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">Log in</Link>
            <Link href="/auth/signup"><Button>Start for free</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge variant="info" className="mb-4">✦ Trusted by teachers — No app required for students</Badge>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Create a quiz.<br/>
              Share a link.<br/>
              <span className="text-indigo-600">Get results instantly.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Teacher creates quiz → publishes → gets a unique link & QR code → students open on their phone (no login) → results saved securely. Built for real classrooms.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/auth/signup"><Button size="lg" className="w-full sm:w-auto">Create your first quiz — free</Button></Link>
              <Link href="/auth/login" className="w-full sm:w-auto"><Button variant="secondary" size="lg" className="w-full">I already have an account</Button></Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full"/> Live in seconds</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-indigo-500 rounded-full"/> Mobile-first for students</span>
              <span className="hidden sm:flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-500 rounded-full"/> Secure scoring</span>
            </div>
          </div>

          {/* Mock preview card */}
          <Card className="p-6 lg:p-8 shadow-xl border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">🎓</div>
                <div>
                  <div className="font-semibold">Science — Chapter 1 Quiz</div>
                  <div className="text-xs text-slate-500">20 Questions • 20 minutes • Published</div>
                </div>
              </div>
              <Badge variant="published">Published</Badge>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs font-medium text-slate-500 mb-1">STUDENT LINK</div>
                <div className="font-mono text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="truncate">quizmaker.app/quiz/ABC123</span>
                  <span className="ml-2 text-xs bg-slate-900 text-white px-2 py-1 rounded-lg">Copy</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-lg font-bold">248</div><div className="text-xs text-slate-500">Attempts</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-lg font-bold">84%</div><div className="text-xs text-slate-500">Avg Score</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-lg font-bold">4.2s</div><div className="text-xs text-slate-500">To share</div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <div className="flex-1 h-24 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-900 rounded-lg grid grid-cols-4 gap-0.5 p-1">
                    {Array.from({length:16}).map((_,i)=><div key={i} className={`${Math.random()>0.5?'bg-white':''} rounded-sm`} />)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">QR Code</div>
                </div>
                <div className="flex-1 bg-indigo-600 text-white rounded-xl p-4 flex flex-col justify-center">
                  <div className="text-sm font-semibold">How students join</div>
                  <div className="text-xs opacity-90 mt-1 leading-relaxed">Open link → enter name → start quiz. No app. No signup. Works on any phone.</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <b>Demo:</b> Try a published quiz code <span className="font-mono bg-white px-1.5 py-0.5 rounded border">DEMO01</span> — if demo data exists.
            </div>
          </Card>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-center">The complete workflow — tested end-to-end</h2>
          <div className="mt-8 grid sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {[
              ["1", "Teacher signs up"],
              ["2", "Creates quiz & questions"],
              ["3", "Publishes & gets link/QR"],
              ["4", "Shares via WhatsApp / Classroom"],
              ["5", "Student takes quiz on phone"],
              ["6", "Teacher views analytics & exports CSV"],
            ].map(([n,t])=> (
              <Card key={n} className="p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto font-bold text-sm">{n}</div>
                <div className="mt-3 font-medium leading-tight">{t}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="text-lg font-semibold">Powerful question builder</div>
            <p className="text-sm text-slate-600 mt-2">Multiple choice, True/False, Short answer. Marks, explanations, drag to reorder, duplicate, autosave.</p>
          </Card>
          <Card className="p-6">
            <div className="text-lg font-semibold">Secure by design</div>
            <p className="text-sm text-slate-600 mt-2">Correct answers never exposed to students. Scoring done server-side. Teacher data isolated.</p>
          </Card>
          <Card className="p-6">
            <div className="text-lg font-semibold">Results that matter</div>
            <p className="text-sm text-slate-600 mt-2">Per-question analytics, pass rates, time taken, CSV export, print — ready for parent meetings.</p>
          </Card>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/auth/signup"><Button size="lg">Create a quiz now</Button></Link>
          <span className="text-sm text-slate-500">Free • No credit card • Takes 2 minutes</span>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} QuizMaker — Built for teachers in Pakistan & everywhere.</span>
          <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Server scoring • QR sharing • Mobile-first</span>
        </div>
      </footer>
    </div>
  );
}
