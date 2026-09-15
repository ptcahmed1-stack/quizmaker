import QuizEditor from "@/components/QuizEditor";
import Link from "next/link";

export default function CreatePage(){
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/import" className="inline-flex h-10 px-4 items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">📊 Import from Excel — Save time</Link>
        <span className="text-xs text-slate-500 self-center">Have many questions in Excel? Import instead — Momin Academy badge auto-shown.</span>
      </div>
      <QuizEditor mode="create" />
    </div>
  );
}
