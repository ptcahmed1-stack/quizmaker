import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Badge, Card } from "@/components/ui";
import { cn } from "@/lib/format";

/** Renders ?ok= / ?error= flash messages produced by server actions. */
export function FlashMessages({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className="mb-6 space-y-3">
      {ok && <Alert tone="success">{ok}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? <Badge tone="indigo">Admin</Badge> : <Badge tone="slate">Teacher</Badge>;
}

export function AccountStatusBadge({ status }: { status: string }) {
  return status === "suspended" ? (
    <Badge tone="rose">
      <span aria-hidden className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
      Suspended
    </Badge>
  ) : (
    <Badge tone="green">
      <span aria-hidden className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </Badge>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass = (disabled: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium",
      disabled ? "pointer-events-none border-slate-200 text-slate-400" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    );
  return (
    <nav className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600 sm:flex-row" aria-label="Pagination">
      <p>
        Showing <span className="font-semibold text-slate-900">{from}–{to}</span> of <span className="font-semibold text-slate-900">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link href={href(page - 1)} aria-disabled={page <= 1} className={linkClass(page <= 1)}>← Previous</Link>
        <span className="px-2">Page {page} of {totalPages}</span>
        <Link href={href(page + 1)} aria-disabled={page >= totalPages} className={linkClass(page >= totalPages)}>Next →</Link>
      </div>
    </nav>
  );
}

export function BarChart({ title, points, color = "bg-indigo-500", total }: { title: string; points: { label: string; value: number }[]; color?: string; total: number }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-sm text-slate-500">{total} total</span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
        {points.map((p) => (
          <div key={p.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${p.label}: ${p.value}`}>
            <div className={cn("w-full rounded-t-md transition-[height]", p.value === 0 ? "bg-slate-200" : color)} style={{ height: `${Math.max(p.value === 0 ? 3 : 8, (p.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </Card>
  );
}

export function MiniStat({ label, value, hint, tone = "slate" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "slate" | "indigo" | "green" | "amber" | "rose" }) {
  const tones = {
    slate: "text-slate-900",
    indigo: "text-indigo-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight", tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function SectionCard({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function ActionLabel({ action }: { action: string }) {
  const tone = action.includes("delete") || action.includes("suspend")
    ? "rose"
    : action.includes("create") || action.includes("activate") || action.includes("promote") || action.includes("reopen")
      ? "green"
      : action.startsWith("settings") || action.startsWith("maintenance")
        ? "amber"
        : "slate";
  return <Badge tone={tone}>{action}</Badge>;
}
