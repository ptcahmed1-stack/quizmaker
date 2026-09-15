import { getCurrentUser } from "@/lib/auth";
import getDb from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import InstituteNameEditor from "@/components/InstituteNameEditor";

export default async function SettingsPage(){
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const rowQ = await db.prepare("SELECT COUNT(*) as c FROM quizzes WHERE teacher_id=?").get(user.id) as any;
  const rowS = await db.prepare("SELECT COUNT(*) as c FROM submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE teacher_id=?)").get(user.id) as any;
  const quizzes = rowQ?.c ?? 0;
  const subs = rowS?.c ?? 0;
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile & Settings</h1>
      <InstituteNameEditor initialName={user.name} initialInstitute={user.institute_name || "Momin Academy"} />

      <Card className="p-6">
        <h2 className="font-semibold">Teacher Profile</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div><span className="text-slate-500">Name:</span> <b>{user.name}</b></div>
          <div><span className="text-slate-500">Email:</span> <b>{user.email}</b></div>
          <div><span className="text-slate-500">Institute:</span> <b className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] tracking-wider font-semibold px-2 py-0.5 rounded-full">🏫 {user.institute_name || "Momin Academy"}</b></div>
          <div><span className="text-slate-500">Member since:</span> {new Date(user.created_at).toLocaleDateString()}</div>
          <div className="flex gap-2 mt-2">
            <Badge>{quizzes} quizzes</Badge>
            <Badge variant="info">{subs} submissions collected</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-slate-600 mt-2">Your password is securely hashed with bcrypt. Sessions are managed via httpOnly cookies with JWT (7-day expiry). Teacher data is isolated per account — you can only access your own quizzes and submissions.</p>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Password reset is not enabled in this demo. To reset, please contact support or create a new account. In production, integrate with email provider (Resend, SendGrid) and add /api/auth/reset route.
        </div>
      </Card>

      <Card className="p-6 border-indigo-200 bg-indigo-50/50">
        <h2 className="font-semibold">🔑 Admin Signup Control <span className="text-xs bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">You are admin</span></h2>
        <p className="text-sm text-slate-600 mt-2">You control who can create teacher accounts. Signup now needs your <b>Admin Signup Code</b>.</p>
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-3 text-sm">
          <div><span className="text-slate-500">Current code:</span> <code className="bg-slate-900 text-white px-2 py-1 rounded-lg ml-1">{process.env.ADMIN_SIGNUP_CODE || "Momin2025"}</code> <span className="text-xs text-slate-500">(default is Momin2025)</span></div>
          <div className="text-xs text-slate-500 mt-1">Share this code only with trusted teachers you want to allow. Without this code, no one can sign up — even if they have the link.</div>
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <b>To change the code (no code change needed):</b><br/>
          Railway → Your Project → Your Service → <b>Variables</b> → <b>+ New Variable</b> → Name: <code>ADMIN_SIGNUP_CODE</code> → Value: <code>YourNewCode123</code> → <b>Add</b> → Railway auto-redeploys in 1 min. New code takes effect immediately. Same for Vercel → Settings → Environment Variables.
        </div>
        <div className="text-xs text-slate-500 mt-2">• To <b>disable signups completely</b>: set a long random code and never share it. <br/>• To <b>allow anyone</b>: set code to something easy like <code>1234</code> and share it publicly.</div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Deployment & Data</h2>
        <ul className="text-sm text-slate-600 mt-2 list-disc pl-5 space-y-1">
          <li>Database: SQLite at <code className="bg-slate-100 px-1 rounded">data.db</code> (WAL mode). Works on Railway/Replit. For Vercel, set Turso env vars.</li>
          <li>Env vars: <code>JWT_SECRET</code> (required in prod), <code>TURSO_DATABASE_URL</code> + <code>TURSO_AUTH_TOKEN</code> for Vercel, <code>DATABASE_PATH</code> optional, <code>ADMIN_SIGNUP_CODE</code> for signup gate (default Momin2025).</li>
          <li>QR codes are generated client-side using the real public quiz URL (<code>/quiz/[code]</code>).</li>
        </ul>
      </Card>

      <div className="flex gap-2">
        <Link href="/dashboard" className="inline-flex h-10 px-4 items-center justify-center rounded-xl bg-slate-900 text-white text-sm">Back to Dashboard</Link>
        <LogoutButton />
      </div>
    </div>
  );
}
