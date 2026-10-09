import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkButton, Logo, buttonClass } from "@/components/ui";
import { getPlatformSettings } from "@/lib/admin";
import { getCurrentTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function goToQuiz(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code) redirect(`/quiz/${code}`);
  redirect("/");
}

const features = [
  { title: "Build quizzes in minutes", body: "Multiple choice, true/false and short answer questions with marks, explanations and drag-and-drop ordering.", icon: "M12 4v16m8-8H4" },
  { title: "Share with a link or QR code", body: "Publish to get a unique link. Students open it on any phone — no app, no account.", icon: "M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1" },
  { title: "Secure, server-side scoring", body: "Answers are never sent to the browser. Every submission is validated, scored and saved on the server.", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { title: "Results & analytics", body: "See every attempt, per-question difficulty, pass rates and export everything to CSV.", icon: "M3 3v18h18M7 14l4-4 4 4 5-6" },
];

export default async function HomePage() {
  const [teacher, platform] = await Promise.all([getCurrentTeacher(), getPlatformSettings()]);
  const signupsOpen = platform.allowSignups;

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Main">
          {teacher ? (
            <LinkButton href="/dashboard">Go to dashboard</LinkButton>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "md")}>Log in</Link>
              {signupsOpen && <LinkButton href="/signup">Sign up free</LinkButton>}
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-10 lg:grid-cols-2 lg:items-center lg:pt-16">
        <div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            For teachers · Free to use
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Create quizzes. Share a link. <span className="text-indigo-600">See results instantly.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            QuizMaker lets you build interactive quizzes, publish them with one click and share a link or QR code.
            Students take the quiz on their phones — no app to install, no account to create.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={teacher ? "/quizzes/new" : signupsOpen ? "/signup" : "/login"} size="lg">{teacher || signupsOpen ? "Create your first quiz" : "Teacher login"}</LinkButton>
            {(teacher || signupsOpen) && <LinkButton href="/login" variant="outline" size="lg">Teacher login</LinkButton>}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Want to explore first? Use the demo account on the <Link href="/login" className="font-medium text-indigo-600 underline">login page</Link>.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">Students: have a quiz code?</h2>
          <p className="mt-1 text-sm text-slate-600">Enter the code your teacher shared to open the quiz.</p>
          <form action={goToQuiz} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="code" className="sr-only">Quiz code</label>
            <input
              id="code"
              name="code"
              required
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. ABC123XY"
              className="h-13 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-lg font-semibold uppercase tracking-widest text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button type="submit" className={buttonClass("primary", "lg")}>Open quiz</button>
          </form>
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How it works</p>
            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              {["Teacher creates a quiz and publishes it", "QuizMaker generates a unique link and QR code", "Students open the link on their phone and enter their name", "Answers are scored on the server and saved", "Teacher reviews results, analytics and exports CSV"].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={f.icon} /></svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row">
        <Logo className="text-base" />
        <p>Built for classrooms. Works on any phone, tablet or laptop.</p>
      </footer>
    </main>
  );
}
