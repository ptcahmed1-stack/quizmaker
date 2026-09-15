"use client";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

export default function InstituteNameEditor({ initialName, initialInstitute }: { initialName: string, initialInstitute: string }){
  const [name,setName]=useState(initialName);
  const [inst,setInst]=useState(initialInstitute||"Momin Academy");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");

  async function save(){
    setSaving(true); setMsg("");
    const res=await fetch("/api/settings/profile",{method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name, institute_name: inst})});
    const data=await res.json();
    if(!res.ok){ setMsg(data.error||"Failed"); setSaving(false); return; }
    setMsg("Saved ✓ — This name appears small at the top of every quiz for your students.");
    setSaving(false);
    // reload to show updated header
    setTimeout(()=> window.location.reload(), 800);
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Institute Branding</h2>
      <p className="text-sm text-slate-600 mt-1">This name appears <b>small but visible</b> at the top of every quiz your students take. Change it once, it updates everywhere.</p>
      <div className="mt-4 space-y-4">
        <div>
          <Label>Teacher Name</Label>
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <Label>Institute Name *</Label>
          <Input value={inst} onChange={e=>setInst(e.target.value)} placeholder="e.g., Momin Academy" />
          <div className="text-xs text-slate-500 mt-1">Shows as: <span className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] tracking-wider font-semibold px-2 py-0.5 rounded-full">🏫 {inst||"Momin Academy"}</span> — small badge on all quizzes</div>
        </div>
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-800">
          Preview on student quiz:<br/>
          <span className="inline-block mt-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] tracking-widest font-semibold text-slate-700">🏫 {inst||"Momin Academy"} • Quiz</span>
        </div>
        {msg && <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-emerald-700">{msg}</div>}
        <Button onClick={save} disabled={saving}>{saving?"Saving...":"Save Institute Name"}</Button>
      </div>
    </Card>
  );
}
