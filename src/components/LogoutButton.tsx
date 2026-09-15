"use client";
export default function LogoutButton(){
  return (
    <button
      onClick={async()=>{ await fetch("/api/auth/logout",{method:"POST"}); window.location.href="/auth/login"; }}
      className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm"
    >
      Log out
    </button>
  );
}
