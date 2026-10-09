"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/(auth)/actions";
import type { NavItem } from "@/components/nav-items";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/format";

interface AppNavProps {
  user: { name: string; email: string; subtitle?: string };
  items: NavItem[];
  brandHref: string;
  brandBadge?: string;
  /** Extra links rendered above the profile block (e.g. “Admin panel”). */
  footerLinks?: NavItem[];
  accent?: "indigo" | "slate";
  /** Where the profile block in the sidebar links to (profile & password page). */
  accountHref?: string;
}

function activeHref(pathname: string, items: NavItem[]): string | null {
  const matches = items.filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function NavLinks({ pathname, items, accent, onNavigate }: { pathname: string; items: NavItem[]; accent: "indigo" | "slate"; onNavigate?: () => void }) {
  const current = activeHref(pathname, items);
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = current === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                active ? (accent === "slate" ? "bg-slate-900 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm") : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <Icon d={item.icon} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        Log out
      </button>
    </form>
  );
}

export function AppNav({ user, items, brandHref, brandBadge, footerLinks = [], accent = "indigo", accountHref }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <Link href={brandHref} aria-label="Home" className="flex items-center gap-2">
      <Logo />
      {brandBadge && <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{brandBadge}</span>}
    </Link>
  );

  const footer = (onNavigate?: () => void) => (
    <div className="space-y-1 border-t border-slate-200 p-3">
      {footerLinks.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <Icon d={l.icon} />
          {l.label}
        </Link>
      ))}
      {accountHref ? (
        <Link
          href={accountHref}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700" aria-hidden>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
            <span className="block truncate text-xs text-slate-500">{user.subtitle ?? user.email}</span>
            <span className="block text-xs font-semibold text-indigo-700">Account &amp; password →</span>
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700" aria-hidden>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
            <span className="block truncate text-xs text-slate-500">{user.subtitle ?? user.email}</span>
          </span>
        </div>
      )}
      <LogoutButton />
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex" aria-label="Sidebar">
        <div className="flex h-16 items-center px-5">{brand}</div>
        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
          <NavLinks pathname={pathname} items={items} accent={accent} />
        </nav>
        {footer()}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden print:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
              <NavLinks pathname={pathname} items={items} accent={accent} onNavigate={() => setOpen(false)} />
            </nav>
            {footer(() => setOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
