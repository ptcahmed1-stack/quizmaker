"use client";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Badge } from "@/components/ui";

export default function StudentsPage(){
  const [students,setStudents]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({student_id:"", name:"", password:"", class_name:""});
  const [csvText,setCsvText]=useState("");
  const [msg,setMsg]=useState("");
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);
    const res=await fetch("/api/institute-students");
    const data=await res.json();
    if(res.ok) setStudents(data.students||[]);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function addSingle(e:any){
    e.preventDefault();
    setError(""); setMsg("");
    if(!form.student_id.trim() || !form.name.trim() || !form.password.trim()){
      setError("ID, Name and Password are required"); return;
    }
    const res=await fetch("/api/institute-students",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form)});
    const data=await res.json();
    if(!res.ok){ setError(data.error||"Failed"); return; }
    setMsg(`Added ${data.added} student(s)`);
    setForm({student_id:"", name:"", password:"", class_name:""});
    load();
  }

  async function handleCsvUpload(){
    setError(""); setMsg("");
    if(!csvText.trim()){ setError("Paste CSV first"); return; }
    // Parse CSV: expect header or not? Support: student_id,name,password,class
    // Allow: id,name,password or id,name,password,class
    const lines=csvText.trim().split(/\r?\n/);
    let start=0;
    const first=lines[0].toLowerCase();
    if(first.includes("student") || first.includes("name") || first.includes("password")) start=1;
    const list:any[]=[];
    for(let i=start;i<lines.length;i++){
      const line=lines[i].trim();
      if(!line) continue;
      // simple CSV split, handling quotes
      const parts=line.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
      if(parts.length<3){
        setError(`Line ${i+1} needs at least 3 columns: ID, Name, Password`);
        return;
      }
      const [sid, name, password, cls]=parts;
      if(!sid || !name || !password) continue;
      list.push({student_id:sid, name, password, class_name: cls||""});
    }
    if(list.length===0){ setError("No valid rows found"); return; }
    const res=await fetch("/api/institute-students",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({students:list})});
    const data=await res.json();
    if(!res.ok){ setError(data.error); return; }
    setMsg(`CSV: Added/Updated ${data.added}, Skipped ${data.skipped}. ${data.errors?.join(" | ")||""}`);
    setCsvText("");
    load();
  }

  function downloadTemplate(){
    const csv="student_id,name,password,class\n101,Ahmed Ali,ahmed123,Class 8A\n102,Fatima Khan,fatima123,Class 8A\n103,Bilal Ahmed,bilal123,Class 8B";
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="institute-students-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function del(id:string){
    if(!confirm("Delete this student? Their past submissions will remain.")) return;
    await fetch(`/api/institute-students/${id}`,{method:"DELETE"});
    load();
  }
  async function delAll(){
    if(!confirm("Delete ALL institute students? This cannot be undone.")) return;
    await fetch("/api/institute-students?bulk=all",{method:"DELETE"});
    load();
  }

  function exportCsv(){
    if(students.length===0) return;
    const headers="student_id,name,class\n";
    const rows=students.map(s=> `"${s.student_id}","${s.name}","${s.class_name||""}"`).join("\n");
    const blob=new Blob([headers+rows],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="institute-students.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if(loading) return <div className="p-8 text-center text-slate-500">Loading students...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Institute Students</h1>
          <p className="text-sm text-slate-600">Add your institute students with ID + Password. Use per-quiz setting to choose: <b>Open</b> (anyone), <b>Institute only</b>, or <b>Both</b>.</p>
        </div>
        <Badge variant="info">{students.length} students</Badge>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-sm">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Add Single Student</h3>
          <form onSubmit={addSingle} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Student ID *</Label><Input value={form.student_id} onChange={e=>setForm({...form, student_id:e.target.value})} placeholder="e.g., 101 or ROLL08" /></div>
              <div><Label>Class</Label><Input value={form.class_name} onChange={e=>setForm({...form, class_name:e.target.value})} placeholder="e.g., 8A" /></div>
            </div>
            <div><Label>Name *</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Full name" /></div>
            <div><Label>Password *</Label><Input value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="Set password (teacher sets)" /></div>
            <Button type="submit" className="w-full">Add / Update Student</Button>
            <div className="text-xs text-slate-500">If ID already exists, it will update name/password.</div>
          </form>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Bulk Upload via CSV</h3>
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <b>CSV format:</b> <code>student_id,name,password,class</code> — one student per line.<br/>
            Example:<br/>
            <code>101,Ahmed Ali,ahmed123,Class 8A</code><br/>
            <code>102,Fatima Khan,fatima123,Class 8A</code><br/>
            Header row is optional.
          </div>
          <div><Label>Paste CSV here</Label><textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={6} placeholder="student_id,name,password,class&#10;101,Ahmed Ali,ahmed123,8A&#10;102,Fatima Khan,fatima123,8A" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono" /></div>
          <div className="flex gap-2">
            <Button onClick={handleCsvUpload} className="flex-1">Upload CSV</Button>
            <Button variant="secondary" onClick={downloadTemplate}>Download Template</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv} className="flex-1" disabled={students.length===0}>Export Current List (CSV)</Button>
            <Button variant="secondary" onClick={delAll} disabled={students.length===0} className="text-red-600">Delete All</Button>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Students ({students.length})</h3>
          <span className="text-xs text-slate-500">Teacher sets password • Students use ID + Password to take institute-only quizzes</span>
        </div>
        {students.length===0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">👥</div>
            <div className="font-medium mt-2">No institute students yet</div>
            <div className="text-sm text-slate-500 mt-1">Add single students or upload CSV. For open quizzes, outside students can still join with just name.</div>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="text-left px-4 py-3">Student ID</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Class</th><th className="text-left px-4 py-3">Added</th><th className="text-left px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s:any)=>(
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium">{s.student_id}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{s.class_name||"—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><button onClick={()=>del(s.id)} className="text-xs text-red-600 hover:underline">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-indigo-50 border-indigo-200">
        <div className="font-medium text-sm text-indigo-900">How per-quiz access works:</div>
        <ul className="text-xs text-indigo-800 mt-2 list-disc pl-5 space-y-1">
          <li><b>Open:</b> Anyone with link can take quiz with just name (no password) — for outside students.</li>
          <li><b>Institute only:</b> Student must enter <b>ID + Password</b> (from this list). Outside guests are blocked.</li>
          <li><b>Both:</b> Shows two tabs — <b>Institute Login</b> (ID+password, verified) and <b>Guest</b> (just name) — so same quiz works for both groups.</li>
        </ul>
        <div className="text-xs text-indigo-700 mt-2">Set this per quiz at <b>Create/Edit → Settings → Student Access</b>.</div>
      </Card>
    </div>
  );
}
