"use client";

import { useEffect, useState, useSyncExternalStore, type FormHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonClass } from "@/components/ui";
import { cn } from "@/lib/format";

/** Submit button that shows a pending state while a server action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </Button>
  );
}

/** A form that asks for confirmation before submitting (used for destructive actions). */
export function ConfirmForm({ message, children, ...props }: { message: string; children: ReactNode } & FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function CopyButton({
  text,
  label = "Copy Link",
  copiedLabel = "Copied!",
  variant = "outline",
  size = "md",
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={copy} aria-live="polite">
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
          {copiedLabel}
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          {label}
        </>
      )}
    </Button>
  );
}

export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <Button type="button" variant="outline" className={cn("print:hidden", className)} onClick={() => window.print()}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
      {label}
    </Button>
  );
}

const noopSubscribe = () => () => {};

/** Returns the current origin on the client (falls back to the server-provided one during SSR). */
export function useOrigin(fallback: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin || fallback,
    () => fallback,
  );
}

/** True when the Web Share API is available (false during SSR). */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

export function ExternalLinkButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "md", className)}>
      {children}
    </a>
  );
}
