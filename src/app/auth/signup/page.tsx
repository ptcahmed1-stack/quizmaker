"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

export default function SignupPage(){
  const router = useRouter();
  const [form,setForm]=useState({name:"", email:"", password:"", adminCode:""});
  const [showCode,setShowCode]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/signup",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form)});
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
          <h1 className="text-2xl font-bold">Create teacher account</h1>
          <p className="text-sm text-slate-600 mt-1">Free for teachers. Students never need an account.</p>
          {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{error}</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div><Label>Full name</Label><Input placeholder="Ayesha Khan" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
            <div><Label>Email</Label><Input type="email" placeholder="teacher@school.edu.pk" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></div>
            <div><Label>Password</Label><Input type="password" placeholder="At least 6 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
            <div>
              <Label>Admin Signup Code <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input type={showCode?"text":"password"} placeholder="Ask admin for code" value={form.adminCode} onChange={e=>setForm({...form,adminCode:e.target.value})} required />
                <button type="button" onClick={()=>setShowCode(!showCode)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{showCode?"Hide":"Show"}</button>
              </div>
              <div className="text-xs text-slate-500 mt-1">You control this code. Default is <b>Momin2025</b>. Only people with this code can create teacher accounts.</div>
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">{loading?"Creating...":"Create account"}</Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">Log in</Link></div>
          <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
            Demo teacher: <b>demo@quizmaker.com / demo123</b> (auto-created on first build if not exists)
          </div>
        </Card>
      </div>
    </div>
  );
}
