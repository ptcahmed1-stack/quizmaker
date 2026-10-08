import type { ReactNode } from "react";
import { adminNavItems, icons } from "@/components/nav-items";
import { AppNav } from "@/components/teacher/nav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav
        user={{ name: admin.name, email: admin.email, subtitle: "Administrator" }}
        items={adminNavItems}
        brandHref="/admin"
        brandBadge="Admin"
        accent="slate"
        footerLinks={[{ href: "/dashboard", label: "Teacher dashboard", icon: icons.home }]}
      />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
