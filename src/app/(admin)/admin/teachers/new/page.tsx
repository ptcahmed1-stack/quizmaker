import type { Metadata } from "next";
import Link from "next/link";
import { CreateTeacherForm } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Add teacher · Admin" };

export default async function NewTeacherPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={<Link href="/admin/teachers" className="hover:text-indigo-600">Teachers</Link>}
        title="Add a teacher account"
        description="Create an account on behalf of a teacher. Useful when public sign-ups are disabled."
      />
      <Card className="p-6">
        <CreateTeacherForm />
      </Card>
    </div>
  );
}
