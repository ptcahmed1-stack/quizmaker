"use client";
import { useState, useEffect, useMemo } from "react";
import { Button, Card, Input, Textarea, Label, Badge } from "@/components/ui";
import Link from "next/link";

type Question = {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  text: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  marks: number;
  explanation: string;
};

type Settings = {
  requireName: boolean;
  requireStudentId: boolean;
  allowAnonymous: boolean;
  attempts: "single" | "multiple";
  maxAttempts: string | number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showOneAtATime: boolean;
  allowNavigation: boolean;
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  hideUntilReleased: boolean;
  accessCode: string;
  startAt: string;
  endAt: string;
  studentAuthMode: "open" | "institute" | "both";
};

const defaultSettings: Settings = {
  requireName: true,
  requireStudentId: false,
  allowAnonymous: false,
  attempts: "multiple",
  maxAttempts: "",
  randomizeQuestions: false,
  randomizeOptions: false,
  showOneAtATime: false,
  allowNavigation: true,
  showScoreImmediately: true,
  showCorrectAnswers: true,
  showExplanations: false,
  hideUntilReleased: false,
  accessCode: "",
  startAt: "",
  endAt: "",
  studentAuthMode: "open",
};

function uid(){ return Math.random().toString(36).slice(2,9); }

function defaultOptions(){
  return [{id:uid(), text:""},{id:uid(), text:""},{id:uid(), text:""},{id:uid(), text:""}]
}

export default function QuizEditor({ initial, mode }: { initial?: any, mode: "create"|"edit" }){
  const [title,setTitle]=useState(initial?.title||"");
  const [description,setDescription]=useState(initial?.description||"");
  const [subject,setSubject]=useState(initial?.subject||"");
  const [grade,setGrade]=useState(initial?.grade||"");
  const [instructions,setInstructions]=useState(initial?.instructions||"Answer all questions carefully.");
  const [timeLimit,setTimeLimit]=useState(initial?.time_limit?.toString()||"");
  const [passing,setPassing]=useState(initial?.passing_percentage?.toString()||"50");
  const [status,setStatus]=useState(initial?.status||"draft");
  const [settings,setSettings]=useState<Settings>(initial?.settings ? {...defaultSettings, ...initial.settings} : defaultSettings);
  const [questions,setQuestions]=useState<Question[]>(()=>{
    if (initial?.questions){
      return initial.questions.map((q:any)=>({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options || (q.type==="multiple_choice"? defaultOptions(): []),
        correct_answer: q.correct_answer || "",
        marks: Number(q.marks||1),
        explanation: q.explanation||""
      }));
    }
    return [];
  });
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [quizId,setQuizId]=useState(initial?.id||null);
  const [quizCode,setQuizCode]=useState(initial?.code||null);
  const [showSettings,setShowSettings]=useState(false);
  const [showPreview,setShowPreview]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [shareUrl,setShareUrl]=useState("");
  const [qrDataUrl,setQrDataUrl]=useState("");

  const totalMarks = useMemo(()=> questions.reduce((s,q)=> s+Number(q.marks||0),0),[questions]);

  // Autosave debounce
  useEffect(()=>{
    if (mode==="create" && !quizId) return;
    if (!quizId) return;
    const t = setTimeout(()=>{ handleSave(true); }, 1500);
    return ()=> clearTimeout(t);
    // eslint-disable-next-line
  },[title,description,subject,grade,instructions,timeLimit,passing,settings,questions]);

  async function handleSave(silent=false){
    if (!title.trim()){ if(!silent) alert("Title required"); return; }
    if (!silent) setSaving(true);
    const payload = {
      title, description, subject, grade, instructions,
      time_limit: timeLimit ? Number(timeLimit) : null,
      passing_percentage: passing ? Number(passing) : 50,
      status,
      settings,
      questions: questions.map((q,i)=>({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
        marks: q.marks,
        explanation: q.explanation,
        order_index: i
      }))
    };
    try{
      let res;
      if (!quizId){
        res = await fetch("/api/quizzes",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      } else {
        res = await fetch(`/api/quizzes/${quizId}`,{method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Failed to save");
      if (!quizId){
        setQuizId(data.quiz.id);
        // redirect to edit page? but we are in create page; update URL
        window.history.replaceState(null,"",`/dashboard/quizzes/${data.quiz.id}/edit`);
        setSaveMsg("Quiz created ✓");
      } else {
        setSaveMsg(silent?"Autosaved ✓":"Saved ✓");
      }
      if (data.quiz?.code) setQuizCode(data.quiz.code);
      setTimeout(()=>setSaveMsg(""),2000);
    } catch(e:any){
      if (!silent) alert(e.message);
    } finally { if (!silent) setSaving(false); }
  }

  async function handlePublish(){
    if (!quizId){
      await handleSave(false);
      // after save, need to fetch id
      return;
    }
    if (questions.length===0){ alert("Add at least one question before publishing"); return; }
    for (const q of questions){
      if (!q.text.trim()){ alert("All questions must have text"); return;}
      if (!q.correct_answer){ alert(`Question "${q.text.slice(0,30)}..." missing correct answer`); return;}
      if (q.type==="multiple_choice"){
        const filled = q.options.filter(o=> o.text.trim());
        if (filled.length<2){ alert("Multiple choice needs at least 2 options"); return;}
      }
    }
    // Save first with published status
    setStatus("published");
    // Wait a tick then save and publish
    const payload = {
      title, description, subject, grade, instructions,
      time_limit: timeLimit ? Number(timeLimit) : null,
      passing_percentage: passing ? Number(passing) : 50,
      status: "published",
      settings,
      questions: questions.map((q,i)=>({
        id: q.id, type: q.type, text: q.text, options: q.options, correct_answer: q.correct_answer, marks: q.marks, explanation: q.explanation, order_index: i
      }))
    };
    setSaving(true);
    const res = await fetch(`/api/quizzes/${quizId}`,{method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    const data = await res.json();
    if (!res.ok){ alert(data.error||"Publish failed"); setSaving(false); return; }
    // Now publish to generate code
    const pub = await fetch(`/api/quizzes/${quizId}/publish`,{method:"POST"});
    const pubData = await pub.json();
    if (!pub.ok){ alert(pubData.error); setSaving(false); return;}
    setQuizCode(pubData.code);
    const url = `${window.location.origin}/quiz/${pubData.code}`;
    setShareUrl(url);
    // Generate QR
    try{
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(url, { margin:1, width: 400 });
      setQrDataUrl(dataUrl);
    } catch{}
    setShowShare(true);
    setSaving(false);
  }

  function addQuestion(type: Question["type"]){
    const q: Question = {
      id: uid(),
      type,
      text: "",
      options: type==="multiple_choice" ? defaultOptions() : [],
      correct_answer: type==="true_false" ? "true" : "",
      marks: 1,
      explanation: ""
    };
    setQuestions([...questions, q]);
  }
  function updateQuestion(id:string, patch: Partial<Question>){
    setQuestions(questions.map(q=> q.id===id? {...q, ...patch}: q));
  }
  function deleteQuestion(id:string){
    if (!confirm("Delete this question?")) return;
    setQuestions(questions.filter(q=> q.id!==id));
  }
  function duplicateQuestion(id:string){
    const q = questions.find(x=> x.id===id);
    if (!q) return;
    const copy = {...q, id: uid(), text: q.text+" (Copy)"};
    const idx = questions.findIndex(x=> x.id===id);
    const next = [...questions];
    next.splice(idx+1,0,copy);
    setQuestions(next);
  }
  function moveQuestion(id:string, dir:number){
    const idx = questions.findIndex(q=> q.id===id);
    const newIdx = idx+dir;
    if (newIdx<0 || newIdx>=questions.length) return;
    const next = [...questions];
    const [item]= next.splice(idx,1);
    next.splice(newIdx,0,item);
    setQuestions(next);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{mode==="create"?"Create Quiz":"Edit Quiz"}</h1>
          <p className="text-sm text-slate-600">{questions.length} questions • {totalMarks} marks {saveMsg && <span className="ml-2 text-emerald-600 font-medium">{saveMsg}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={()=> setShowPreview(true)}>👁 Preview</Button>
          <Button variant="secondary" onClick={()=> setShowSettings(true)}>⚙ Settings</Button>
          <Button variant="secondary" onClick={()=> handleSave(false)} disabled={saving}>{saving?"Saving...":"Save Draft"}</Button>
          <Button onClick={handlePublish} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">🚀 Publish</Button>
        </div>
      </div>

      {/* Quiz Info */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Quiz Information</h2>
        <div><Label>Quiz Title *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g., General Science — Chapter 1" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g., Science" /></div>
          <div><Label>Grade / Class</Label><Input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="e.g., Class 8" /></div>
        </div>
        <div><Label>Description</Label><Textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description for students" /></div>
        <div><Label>Instructions for students</Label><Textarea rows={2} value={instructions} onChange={e=>setInstructions(e.target.value)} /></div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><Label>Time limit (minutes)</Label><Input type="number" min="0" value={timeLimit} onChange={e=>setTimeLimit(e.target.value)} placeholder="Leave blank for no limit" /></div>
          <div><Label>Passing %</Label><Input type="number" min="0" max="100" value={passing} onChange={e=>setPassing(e.target.value)} /></div>
          <div><Label>Status</Label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        {quizCode && <div className="pt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Student link:</span>
          <code className="bg-slate-900 text-white px-2 py-1 rounded-lg">{typeof window!=="undefined"? window.location.origin:""}/quiz/{quizCode}</code>
          <button onClick={()=>{
            const url=`${window.location.origin}/quiz/${quizCode}`;
            navigator.clipboard.writeText(url); alert("Copied!");
          }} className="text-indigo-600 text-xs border border-indigo-200 px-2 py-1 rounded-lg bg-indigo-50">Copy</button>
          <Link href={`/quiz/${quizCode}`} target="_blank" className="text-xs text-indigo-600 underline">Open</Link>
        </div>}
      </Card>

      {/* Questions */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Questions</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={()=>addQuestion("multiple_choice")}>+ Multiple Choice</Button>
          <Button size="sm" variant="secondary" onClick={()=>addQuestion("true_false")}>+ True/False</Button>
          <Button size="sm" variant="secondary" onClick={()=>addQuestion("short_answer")}>+ Short Answer</Button>
        </div>
      </div>

      {questions.length===0 ? (
        <Card className="p-10 text-center border-dashed border-2">
          <div className="text-4xl">❓</div>
          <div className="font-medium mt-2">No questions yet</div>
          <div className="text-sm text-slate-500 mt-1">Add your first question to get started.</div>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={()=>addQuestion("multiple_choice")}>Multiple Choice</Button>
            <Button variant="secondary" onClick={()=>addQuestion("true_false")}>True/False</Button>
            <Button variant="secondary" onClick={()=>addQuestion("short_answer")}>Short Answer</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx)=>(
            <Card key={q.id} className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">{idx+1}</span>
                  <select value={q.type} onChange={e=>updateQuestion(q.id,{type:e.target.value as any, correct_answer:"", options: e.target.value==="multiple_choice"? defaultOptions(): []})} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer</option>
                  </select>
                  <span className="text-xs text-slate-500">{q.marks} mark{q.marks!==1?"s":""}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={()=>moveQuestion(q.id,-1)} disabled={idx===0} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50">↑</button>
                  <button onClick={()=>moveQuestion(q.id,1)} disabled={idx===questions.length-1} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50">↓</button>
                  <button onClick={()=>duplicateQuestion(q.id)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" title="Duplicate">⧉</button>
                  <button onClick={()=>deleteQuestion(q.id)} className="w-7 h-7 rounded-lg border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50">✕</button>
                </div>
              </div>

              <div><Label>Question text *</Label><Textarea rows={2} value={q.text} onChange={e=>updateQuestion(q.id,{text:e.target.value})} placeholder="Enter your question" /></div>

              {q.type==="multiple_choice" && (
                <div className="mt-4 space-y-3">
                  <Label>Options (select correct)</Label>
                  {q.options.map((opt,i)=>(
                    <div key={opt.id} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${q.id}`} checked={q.correct_answer===opt.id} onChange={()=>updateQuestion(q.id,{correct_answer:opt.id})} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-sm font-medium w-6">{String.fromCharCode(65+i)}.</span>
                      <Input value={opt.text} onChange={e=>{
                        const next = q.options.map(o=> o.id===opt.id? {...o, text:e.target.value}: o);
                        updateQuestion(q.id,{options: next});
                      }} placeholder={`Option ${String.fromCharCode(65+i)}`} />
                      <button onClick={()=>{
                        if (q.options.length<=2){ alert("At least 2 options required"); return;}
                        const next = q.options.filter(o=> o.id!==opt.id);
                        let correct = q.correct_answer;
                        if (correct===opt.id) correct="";
                        updateQuestion(q.id,{options: next, correct_answer: correct});
                      }} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">−</button>
                    </div>
                  ))}
                  {q.options.length<6 && <button onClick={()=>{
                    updateQuestion(q.id,{options: [...q.options, {id: uid(), text:""}]});
                  }} className="text-sm text-indigo-600 hover:underline">+ Add option</button>}
                  {!q.correct_answer && <div className="text-xs text-amber-600">Select the correct answer</div>}
                </div>
              )}

              {q.type==="true_false" && (
                <div className="mt-4">
                  <Label>Correct answer</Label>
                  <div className="flex gap-2">
                    {["true","false"].map(v=>(
                      <label key={v} className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border cursor-pointer ${q.correct_answer===v?"bg-indigo-600 text-white border-indigo-600":"bg-white border-slate-200"}`}>
                        <input type="radio" name={`tf-${q.id}`} checked={q.correct_answer===v} onChange={()=>updateQuestion(q.id,{correct_answer:v})} className="hidden" />
                        <span className="font-medium capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {q.type==="short_answer" && (
                <div className="mt-4">
                  <Label>Expected answer *</Label>
                  <Input value={q.correct_answer} onChange={e=>updateQuestion(q.id,{correct_answer:e.target.value})} placeholder="Exact expected answer (case-insensitive)" />
                  <div className="text-xs text-slate-500 mt-1">Student answer will be compared case-insensitively and trimmed.</div>
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div><Label>Marks</Label><Input type="number" min="1" value={q.marks} onChange={e=>updateQuestion(q.id,{marks: Number(e.target.value)||1})} /></div>
                <div className="sm:col-span-2"><Label>Explanation (shown after submission if enabled)</Label><Input value={q.explanation} onChange={e=>updateQuestion(q.id,{explanation:e.target.value})} placeholder="Why this is correct" /></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Quiz Settings</h3>
              <button onClick={()=>setShowSettings(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-6">
              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Student Identification</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireName} onChange={e=>setSettings({...settings, requireName:e.target.checked})} /> Require student name</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireStudentId} onChange={e=>setSettings({...settings, requireStudentId:e.target.checked})} /> Require student ID / Roll number</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.allowAnonymous} onChange={e=>setSettings({...settings, allowAnonymous:e.target.checked})} /> Allow anonymous submissions</label>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Attempts</h4>
                <div className="flex gap-2">
                  <label className={`flex-1 h-10 rounded-xl border flex items-center justify-center cursor-pointer ${settings.attempts==="single"?"bg-slate-900 text-white border-slate-900":"bg-white"}`}><input type="radio" className="hidden" checked={settings.attempts==="single"} onChange={()=>setSettings({...settings, attempts:"single"})} /> One attempt</label>
                  <label className={`flex-1 h-10 rounded-xl border flex items-center justify-center cursor-pointer ${settings.attempts==="multiple"?"bg-slate-900 text-white border-slate-900":"bg-white"}`}><input type="radio" className="hidden" checked={settings.attempts==="multiple"} onChange={()=>setSettings({...settings, attempts:"multiple"})} /> Multiple</label>
                </div>
                {settings.attempts==="multiple" && (
                  <div className="mt-3"><Label>Max attempts (leave blank for unlimited)</Label><Input type="number" value={settings.maxAttempts as any} onChange={e=>setSettings({...settings, maxAttempts:e.target.value})} placeholder="e.g., 3" /></div>
                )}
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Question Settings</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.randomizeQuestions} onChange={e=>setSettings({...settings, randomizeQuestions:e.target.checked})} /> Randomize question order</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.randomizeOptions} onChange={e=>setSettings({...settings, randomizeOptions:e.target.checked})} /> Randomize answer choices</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showOneAtATime} onChange={e=>setSettings({...settings, showOneAtATime:e.target.checked})} /> Show one question at a time</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.allowNavigation} onChange={e=>setSettings({...settings, allowNavigation:e.target.checked})} /> Allow previous/next navigation</label>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Result Settings</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showScoreImmediately} onChange={e=>setSettings({...settings, showScoreImmediately:e.target.checked})} /> Show score immediately</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showCorrectAnswers} onChange={e=>setSettings({...settings, showCorrectAnswers:e.target.checked})} /> Show correct answers</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showExplanations} onChange={e=>setSettings({...settings, showExplanations:e.target.checked})} /> Show explanations</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.hideUntilReleased} onChange={e=>setSettings({...settings, hideUntilReleased:e.target.checked})} /> Hide results until teacher releases (not yet implemented — hides score)</label>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Student Access — Institute vs Open</h4>
                <div className="space-y-3">
                  <div>
                    <Label>Who can take this quiz?</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <label className={`p-3 rounded-xl border-2 cursor-pointer flex gap-3 ${settings.studentAuthMode==="open"?"bg-indigo-50 border-indigo-600":"bg-white border-slate-200"}`}>
                        <input type="radio" name="authMode" checked={settings.studentAuthMode==="open"} onChange={()=>setSettings({...settings, studentAuthMode:"open"})} className="mt-1" />
                        <div>
                          <div className="font-medium text-sm">🌍 Open — Anyone with link</div>
                          <div className="text-xs text-slate-500">Outside + institute students can all take with just name/ID. No password needed.</div>
                        </div>
                      </label>
                      <label className={`p-3 rounded-xl border-2 cursor-pointer flex gap-3 ${settings.studentAuthMode==="institute"?"bg-indigo-50 border-indigo-600":"bg-white border-slate-200"}`}>
                        <input type="radio" name="authMode" checked={settings.studentAuthMode==="institute"} onChange={()=>setSettings({...settings, studentAuthMode:"institute"})} className="mt-1" />
                        <div>
                          <div className="font-medium text-sm">🏫 Institute only — ID + Password required</div>
                          <div className="text-xs text-slate-500">Only students you added at <b>Students</b> page can take it. Outside students blocked.</div>
                        </div>
                      </label>
                      <label className={`p-3 rounded-xl border-2 cursor-pointer flex gap-3 ${settings.studentAuthMode==="both"?"bg-indigo-50 border-indigo-600":"bg-white border-slate-200"}`}>
                        <input type="radio" name="authMode" checked={settings.studentAuthMode==="both"} onChange={()=>setSettings({...settings, studentAuthMode:"both"})} className="mt-1" />
                        <div>
                          <div className="font-medium text-sm">🔓 Both — Institute login or Guest</div>
                          <div className="text-xs text-slate-500">Institute students login with ID+password (verified), outside students can still join as guest with just name. Best of both.</div>
                        </div>
                      </label>
                    </div>
                    <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
                      Manage institute students at <b>Dashboard → Students</b> (CSV upload). Teacher sets each student's password when adding.
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Access</h4>
                <div className="space-y-3">
                  <div><Label>Access code (optional)</Label><Input value={settings.accessCode} onChange={e=>setSettings({...settings, accessCode:e.target.value})} placeholder="Leave blank for public" /></div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label>Start date/time</Label><Input type="datetime-local" value={settings.startAt} onChange={e=>setSettings({...settings, startAt:e.target.value})} /></div>
                    <div><Label>End date/time</Label><Input type="datetime-local" value={settings.endAt} onChange={e=>setSettings({...settings, endAt:e.target.value})} /></div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={()=>setShowSettings(false)}>Close</Button>
              <Button onClick={()=>{ setShowSettings(false); handleSave(false);}}>Save Settings</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="h-12 border-b flex items-center justify-between px-4 bg-slate-50">
              <span className="font-semibold text-sm">Preview — what students will see</span>
              <button onClick={()=>setShowPreview(false)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="text-center">
                <div className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">{subject || "Quiz"} {grade? `• ${grade}`:""}</div>
                <h3 className="text-xl font-bold mt-1">{title||"Untitled Quiz"}</h3>
                <div className="text-xs text-slate-500 mt-1">{questions.length} Questions {timeLimit?`• ${timeLimit} minutes`:""} • {totalMarks} marks</div>
                {description && <p className="text-sm text-slate-600 mt-2">{description}</p>}
                {instructions && <div className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-left"><b>Instructions:</b> {instructions}</div>}
              </div>

              <div className="space-y-3">
                {questions.slice(0,5).map((q,i)=>(
                  <Card key={q.id} className="p-4">
                    <div className="text-sm font-medium">Q{i+1}. {q.text||<span className="text-slate-400">(Untitled)</span>}</div>
                    {q.type==="multiple_choice" && <div className="mt-2 space-y-1.5">{q.options.slice(0,4).map((o,j)=><div key={o.id} className="h-10 rounded-xl border border-slate-200 flex items-center px-3 text-sm bg-white"><span className="w-6 h-6 rounded-full border border-slate-300 mr-2"/>{o.text||`Option ${String.fromCharCode(65+j)}`}</div>)}</div>}
                    {q.type==="true_false" && <div className="mt-2 grid grid-cols-2 gap-2"><div className="h-10 rounded-xl border flex items-center justify-center text-sm">True</div><div className="h-10 rounded-xl border flex items-center justify-center text-sm">False</div></div>}
                    {q.type==="short_answer" && <div className="mt-2"><Input placeholder="Type your answer" disabled /></div>}
                  </Card>
                ))}
                {questions.length>5 && <div className="text-center text-sm text-slate-500">...and {questions.length-5} more questions</div>}
                {questions.length===0 && <div className="text-center text-sm text-slate-500 py-8">No questions to preview</div>}
              </div>

              <div className="pt-2 text-xs text-center text-slate-500">
                This is a preview only. No submission will be recorded.
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50">
              <Button variant="secondary" className="w-full" onClick={()=>setShowPreview(false)}>Close Preview</Button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto text-xl">✓</div>
            <h3 className="text-xl font-bold">Quiz Published!</h3>
            <p className="text-sm text-slate-600">Share this link with your students. They can open it on any phone — no app needed.</p>
            <div className="bg-slate-900 text-white rounded-xl p-3 font-mono text-sm break-all">{shareUrl}</div>
            <div className="flex gap-2 justify-center">
              <Button onClick={async()=>{ await navigator.clipboard.writeText(shareUrl); alert("Link copied!"); }}>Copy Link</Button>
              <Button variant="secondary" onClick={()=> window.open(shareUrl,"_blank")}>Open Quiz</Button>
              {typeof navigator !== "undefined" && (navigator as any).share && (
                <Button variant="secondary" onClick={()=> (navigator as any).share({title: title, url: shareUrl})}>Share</Button>
              )}
            </div>
            {qrDataUrl && (
              <div className="pt-2">
                <div className="text-sm font-medium mb-2">QR Code</div>
                <img src={qrDataUrl} alt="QR" className="w-48 h-48 mx-auto border border-slate-200 rounded-xl p-2 bg-white" />
                <div className="flex gap-2 justify-center mt-3">
                  <a href={qrDataUrl} download={`quiz-${quizCode}-qr.png`} className="inline-flex h-9 px-4 items-center justify-center rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-50">Download QR</a>
                  <button onClick={()=> window.print()} className="h-9 px-4 rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-50">Print QR</button>
                </div>
                <div className="text-xs text-slate-500 mt-2">Students can scan this QR code in class to open the quiz instantly.</div>
              </div>
            )}
            <Button variant="secondary" className="w-full mt-2" onClick={()=>setShowShare(false)}>Done</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
