"use client";
import Link from "next/link";
import { useState } from "react";

export function LogoutButton(){
  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    window.location.href="/auth/login";
  }
  return <button onClick={logout} className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Log out</button>
}

export function MobileMenu({user}:any){
  const [open,setOpen]=useState(false);
  return (
    <div className="relative">
      <button onClick={()=>setOpen(!open)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">☰</button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-30">
          <Link href="/dashboard" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Dashboard</Link>
          <Link href="/dashboard/quizzes" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">My Quizzes</Link>
          <Link href="/dashboard/create" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Create Quiz</Link>
          <Link href="/dashboard/import" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Import Excel</Link>
          <Link href="/dashboard/students" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Students</Link>
          <Link href="/dashboard/results" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Results</Link>
          <Link href="/dashboard/settings" onClick={()=>setOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Settings</Link>
          <div className="border-t my-2"/>
          <div className="px-3 py-2 text-sm"><div className="font-medium">{user.name}</div><div className="text-xs text-slate-500 truncate">{user.email}</div></div>
          <button onClick={async()=>{ await fetch("/api/auth/logout",{method:"POST"}); window.location.href="/auth/login"; }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Log out</button>
        </div>
      )}
    </div>
  )
}
