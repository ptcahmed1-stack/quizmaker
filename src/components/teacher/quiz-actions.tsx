"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { closeQuizAction, deleteQuizAction, duplicateQuizAction, publishFromFormAction, reopenQuizAction } from "@/app/(teacher)/actions";
import { useOrigin } from "@/components/client-bits";
import { cn } from "@/lib/format";

interface Props {
  quiz: { id: string; title: string; status: string; publicCode: string | null };
  originFallback: string;
}

const itemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:bg-slate-100";

export function QuizActionsMenu({ quiz, originFallback }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const origin = useOrigin(originFallback);
  const studentUrl = quiz.publicCode ? `${origin}/quiz/${quiz.publicCode}` : null;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyLink() {
    if (!studentUrl) return;
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      window.prompt("Copy this link:", studentUrl);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${quiz.title}`}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Link role="menuitem" href={`/quizzes/${quiz.id}/edit`} className={itemClass}>Edit</Link>
          <Link role="menuitem" href={`/quizzes/${quiz.id}/preview`} className={itemClass}>Preview</Link>
          <Link role="menuitem" href={`/quizzes/${quiz.id}/results`} className={itemClass}>Results</Link>
          {studentUrl && quiz.status === "published" && (
            <>
              <button role="menuitem" type="button" onClick={copyLink} className={itemClass}>
                {copied ? "Copied!" : "Copy Student Link"}
              </button>
              <Link role="menuitem" href={`/quizzes/${quiz.id}/share`} className={itemClass}>QR Code &amp; Share</Link>
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          {quiz.status === "draft" && (
            <form action={publishFromFormAction}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <button role="menuitem" type="submit" className={cn(itemClass, "font-medium text-emerald-700")}>Publish</button>
            </form>
          )}
          {quiz.status === "published" && (
            <form action={closeQuizAction}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <button role="menuitem" type="submit" className={cn(itemClass, "text-amber-700")}>Close quiz</button>
            </form>
          )}
          {quiz.status === "closed" && (
            <form action={reopenQuizAction}>
              <input type="hidden" name="quizId" value={quiz.id} />
              <button role="menuitem" type="submit" className={cn(itemClass, "font-medium text-emerald-700")}>Reopen quiz</button>
            </form>
          )}
          <form action={duplicateQuizAction}>
            <input type="hidden" name="quizId" value={quiz.id} />
            <button role="menuitem" type="submit" className={itemClass}>Duplicate</button>
          </form>
          <form
            action={deleteQuizAction}
            onSubmit={(e) => {
              if (!window.confirm(`Delete "${quiz.title}"? All questions and student submissions will be permanently removed.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="quizId" value={quiz.id} />
            <button role="menuitem" type="submit" className={cn(itemClass, "text-rose-600 hover:bg-rose-50")}>Delete</button>
          </form>
        </div>
      )}
    </div>
  );
}
