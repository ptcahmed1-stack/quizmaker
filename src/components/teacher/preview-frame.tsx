"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

export function PreviewFrame({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Preview device">
        {(["mobile", "desktop"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={device === d}
            onClick={() => setDevice(d)}
            className={cn("rounded-lg px-4 py-2 text-sm font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", device === d ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600")}
          >
            {d === "mobile" ? "📱 Mobile" : "🖥️ Desktop"}
          </button>
        ))}
      </div>
      <div className={cn("mx-auto overflow-hidden rounded-[2rem] border bg-slate-50", device === "mobile" ? "w-full max-w-[400px] border-[10px] border-slate-900 shadow-2xl" : "w-full border-slate-200 shadow-sm")}>
        <div className={cn("relative overflow-y-auto", device === "mobile" ? "h-[760px]" : "min-h-[720px]")}>{children}</div>
      </div>
    </div>
  );
}
