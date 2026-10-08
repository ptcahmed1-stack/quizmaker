import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn, statusLabel } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    variantClasses[variant],
    sizeClasses[size],
    extra,
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "blue";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "published" ? "green" : status === "closed" ? "amber" : "slate";
  return (
    <Badge tone={tone}>
      <span aria-hidden className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", status === "published" ? "bg-emerald-500" : status === "closed" ? "bg-amber-500" : "bg-slate-400")} />
      {statusLabel(status)}
    </Badge>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{icon}</div>}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M9 12h6M9 16h6M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-slate-500">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "error"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 sm:text-sm";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-[88px]", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children, required }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50", disabled && "opacity-60")}>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", light ? "text-white" : "text-slate-900", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </span>
      QuizMaker
    </span>
  );
}
