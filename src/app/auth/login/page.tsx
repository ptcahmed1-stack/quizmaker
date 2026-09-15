"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

export default function LoginPage(){
  const router = useRouter();
  const [form,setForm]=useState({email:"", password:""});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form)});
    const data = await res.json();
    if (!res.ok){ setError(data.error||"Failed"); setLoading(false); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b bg-white flex items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-bold"><div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">Q</div> QuizMaker</Link>
      </header>
      <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-slate-600 mt-1">Log in to your teacher dashboard.</p>
          {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{error}</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div><Label>Email</Label><Input type="email" placeholder="teacher@school.edu.pk" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">{loading?"Signing in...":"Log in"}</Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-600">No account? <Link href="/auth/signup" className="text-indigo-600 font-medium hover:underline">Sign up</Link></div>
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
            Tip: after logging in, create a quiz → <b>Publish</b> → copy the student link or QR code and share on WhatsApp.
          </div>
        </Card>
      </div>
    </div>
  );
}
