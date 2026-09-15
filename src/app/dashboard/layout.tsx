import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton, MobileMenu } from "@/components/DashboardClient";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">Q</div>
          <div>
            <div className="font-bold leading-none">QuizMaker</div>
            <div className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase leading-none mt-0.5">🏫 {user.institute_name || "Momin Academy"}</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/dashboard" label="Dashboard" icon="▦" />
          <NavLink href="/dashboard/quizzes" label="My Quizzes" icon="📝" />
          <NavLink href="/dashboard/create" label="Create Quiz" icon="＋" highlight />
          <NavLink href="/dashboard/import" label="Import Excel" icon="📊" />
          <NavLink href="/dashboard/students" label="Students" icon="👥" />
          <NavLink href="/dashboard/results" label="Results" icon="📊" />
          <NavLink href="/dashboard/settings" label="Profile / Settings" icon="⚙" />
          <div className="pt-4 mt-4 border-t border-slate-200">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teacher</div>
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-[11px] font-semibold tracking-wider text-indigo-600 truncate">🏫 {user.institute_name || "Momin Academy"}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
            <div className="mt-3">
              <LogoutButton />
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
          Students join via link/QR<br/>No app needed
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold"><div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">Q</div> <span>QuizMaker<span className="block text-[10px] leading-none tracking-widest text-slate-500 uppercase">🏫 {user.institute_name || "Momin Academy"}</span></span></Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/create" className="bg-indigo-600 text-white text-sm px-3 py-2 rounded-xl">+ New Quiz</Link>
            <MobileMenu user={user} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label, icon, highlight }: any){
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${highlight ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700" : "text-slate-700 hover:bg-slate-100"}`}>
      <span className="w-6 text-center">{icon}</span> {label}
    </Link>
  );
}


