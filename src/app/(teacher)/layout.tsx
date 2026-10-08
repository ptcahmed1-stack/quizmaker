import Link from "next/link";
import type { ReactNode } from "react";
import { icons, teacherNavItems } from "@/components/nav-items";
import { AppNav } from "@/components/teacher/nav";
import { getPlatformSettings } from "@/lib/admin";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const teacher = await requireTeacher();
  const settings = await getPlatformSettings();
  const isAdmin = teacher.role === "admin";
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav
        user={{ name: teacher.name, email: teacher.email, subtitle: teacher.isDemo ? "Demo account" : isAdmin ? "Administrator" : teacher.email }}
        items={teacherNavItems}
        brandHref="/dashboard"
        footerLinks={isAdmin ? [{ href: "/admin", label: "Admin panel", icon: icons.shield }] : []}
      />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {settings.announcementEnabled && settings.announcement && (
            <div role="status" className="mb-6 flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden><path d="M3 11l18-5v12L3 13v-2zM11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
              <p><span className="font-semibold">Announcement:</span> {settings.announcement}</p>
            </div>
          )}
          {settings.maintenanceMode && (
            <div role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <span className="font-semibold">Maintenance mode is on.</span> Students cannot start new quiz attempts right now; attempts already in progress can still be submitted.
              {isAdmin && (
                <>
                  {" "}
                  <Link href="/admin/settings" className="font-semibold underline">Manage in platform settings</Link>.
                </>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
