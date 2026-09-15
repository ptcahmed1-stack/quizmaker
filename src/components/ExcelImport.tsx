"use client";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea, Badge } from "@/components/ui";
import * as XLSX from "xlsx";

function uid(){ return Math.random().toString(36).slice(2,9); }
function defaultOptions(){ return [{id:uid(),text:""},{id:uid(),text:""},{id:uid(),text:""},{id:uid(),text:""}]; }

type ParsedQuestion = {
  id: string;
  type: "multiple_choice"|"true_false"|"short_answer";
  text: string;
  options: {id:string, text:string}[];
  correct_answer: string;
  marks: number;
  explanation: string;
  _error?: string;
};

function normalizeHeader(h:any): string {
  return String(h||"").trim().toLowerCase().replace(/_/g," ").replace(/\s+/g," ").trim();
}

const aliasMap: Record<string,string> = {
  "type": "type", "question type": "type", "qtype": "type", "q type": "type", "category": "type", "kind":"type",
  "question": "question", "question text":"question", "q":"question", "text":"question", "statement":"question", "question title":"question",
  "option a":"optA", "opt a":"optA", "choice a":"optA", "a":"optA", "option a text":"optA",
  "option b":"optB", "opt b":"optB", "choice b":"optB", "b":"optB",
  "option c":"optC", "opt c":"optC", "choice c":"optC", "c":"optC",
  "option d":"optD", "opt d":"optD", "choice d":"optD", "d":"optD",
  "option e":"optE", "opt e":"optE", "choice e":"optE", "e":"optE",
  "option f":"optF", "opt f":"optF", "choice f":"optF", "f":"optF",
  "correct answer":"correct", "correct":"correct", "answer":"correct", "correct ans":"correct", "ans":"correct", "right answer":"correct", "correct option":"correct",
  "marks":"marks", "mark":"marks", "points":"marks", "score":"marks", "weight":"marks", "marks/points":"marks",
  "explanation":"explanation", "explain":"explanation", "explan":"explanation", "note":"explanation", "hint":"explanation", "details":"explanation"
};

function mapType(raw:any): "multiple_choice"|"true_false"|"short_answer" {
  const v = String(raw||"").trim().toLowerCase();
  if (!v) return "multiple_choice";
  if (["mc","multiple_choice","multiple choice","multiple","choice","mcq"].includes(v)) return "multiple_choice";
  if (["tf","true_false","true false","true/false","truefalse","bool","boolean","t/f"].includes(v)) return "true_false";
  if (["sa","short_answer","short answer","short","text","short ans"].includes(v)) return "short_answer";
  // also detect if v looks like question text? fallback
  if (v.includes("true")||v.includes("false")) return "true_false";
  return "multiple_choice";
}

export default function ExcelImport(){
  const [title,setTitle]=useState("");
  const [subject,setSubject]=useState("");
  const [grade,setGrade]=useState("");
  const [description,setDescription]=useState("");
  const [instructions,setInstructions]=useState("Answer all questions carefully.");
  const [timeLimit,setTimeLimit]=useState("");
  const [passing,setPassing]=useState("50");
  const [questions,setQuestions]=useState<ParsedQuestion[]>([]);
  const [fileName,setFileName]=useState("");
  const [parseErrors,setParseErrors]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");

  function downloadTemplate(){
    const headers = ["Type","Question","Option A","Option B","Option C","Option D","Option E","Option F","Correct Answer","Marks","Explanation"];
    const rows = [
      ["multiple_choice","What is the capital of Pakistan?","Islamabad","Karachi","Lahore","Peshawar","","","A","1","Islamabad is the capital"],
      ["true_false","Water boils at 100°C at sea level.","","","","","","","true","1","At sea level"],
      ["short_answer","What gas do plants release during photosynthesis?","","","","","","","Oxygen","1","Plants release oxygen"],
      ["multiple_choice","Which organ pumps blood?","Brain","Lungs","Heart","Liver","","","C","1",""],
      ["multiple_choice","2 + 2 = ?","3","4","5","6","","","B","1",""]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // set column widths
    ws["!cols"] = [{wch:16},{wch:42},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12},{wch:12},{wch:16},{wch:7},{wch:22}];
    // style header bold
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quiz Questions");
    // add instructions sheet
    const inst = [
      ["Instructions - How to fill this Excel for QuizMaker"],
      [""],
      ["Columns:"],
      ["Type","multiple_choice (or mc), true_false (or tf), short_answer (or sa)"],
      ["Question","Question text (required)"],
      ["Option A - F","For multiple_choice, fill 2-6 options. Leave blank for other types."],
      ["Correct Answer","MC: put A/B/C/D/E/F OR the exact option text. TF: true/false. SA: exact expected answer."],
      ["Marks","Number (default 1)"],
      ["Explanation","Optional, shown after quiz if enabled"],
      [""],
      ["Tips:"],
      ["- First row must be header as in template."],
      ["- Keep Option A-D at least for MC."],
      ["- Do not merge cells."],
      ["- Example rows are included — delete them and add your own."],
      ["- Max 200 questions per import."],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(inst);
    ws2["!cols"]=[{wch:18},{wch:70}];
    XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
    XLSX.writeFile(wb, "Momin-Academy-Quiz-Template.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseErrors([]);
    setMsg("");
    const buf = await file.arrayBuffer();
    try{
      const wb = XLSX.read(buf, {type:"array"});
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, {header:1, defval:"", blankrows:false});
      if (rows.length < 2){ setParseErrors(["Excel is empty or has only header"]); setQuestions([]); return; }
      const headerRow = rows[0];
      // Build column map
      const colMap: Record<string, number> = {};
      headerRow.forEach((h:any, idx:number)=>{
        const norm = normalizeHeader(h);
        const key = aliasMap[norm];
        if (key) {
          if (!(key in colMap)) colMap[key]=idx;
        }
      });
      // Fallback: if not found but header count matches template order, map by position
      if (!("question" in colMap) && headerRow.length>=2){
        // try positional mapping if first header looks like Type/Question etc but aliases missed due to weird spaces
        // check by index if header strings contain keywords
        // keep colMap as is, no fallback to avoid overwriting
      }
      const requiredMissing:string[]=[];
      if (!("question" in colMap)) requiredMissing.push("Question");
      if (!("correct" in colMap)) requiredMissing.push("Correct Answer");
      if (!("type" in colMap)) {
        // not fatal, default MC, but warn
      }
      if (requiredMissing.length){
        setParseErrors([`Missing columns: ${requiredMissing.join(", ")}. Download template to see expected headers.`]);
        // try positional fallback: assume order Type,Question,A,B,C,D,E,F,Correct,Marks,Explanation
        if (headerRow.length>=9){
          const fallback = ["type","question","optA","optB","optC","optD","optE","optF","correct","marks","explanation"];
          fallback.forEach((k,i)=>{ if (!(k in colMap) && i < headerRow.length) colMap[k]=i; });
        }
      }

      const parsed: ParsedQuestion[] = [];
      const errors: string[]=[];
      for(let r=1;r<rows.length;r++){
        const row = rows[r];
        if (!row || row.every(c=> String(c).trim()==="")) continue;
        const get = (k:string)=> row[colMap[k]] ?? "";
        const rawQ = String(get("question")||"").trim();
        if (!rawQ) { errors.push(`Row ${r+1}: missing question text — skipped`); continue; }
        const rawType = get("type");
        const t = mapType(rawType);
        const marksRaw = String(get("marks")||"").trim();
        const marks = marksRaw ? Number(marksRaw)||1 : 1;
        const explanation = String(get("explanation")||"").trim();
        const correctRaw = String(get("correct")||"").trim();
        if (!correctRaw){ errors.push(`Row ${r+1}: missing correct answer`); }

        if (t==="multiple_choice"){
          const optTexts = ["optA","optB","optC","optD","optE","optF"].map(k=> String(get(k)||"").trim()).filter(Boolean);
          if (optTexts.length<2){
            errors.push(`Row ${r+1}: MC needs at least 2 options (found ${optTexts.length})`);
          }
          const opts = optTexts.map(txt=> ({id: uid(), text: txt}));
          // map correct
          let correctId = "";
          const corrNorm = correctRaw.trim();
          const upper = corrNorm.toUpperCase();
          // if single letter A-F and matches option index
          if (/^[A-F]$/.test(upper) && opts.length){
            const idx = upper.charCodeAt(0)-65;
            if (idx < opts.length) correctId = opts[idx].id;
          }
          if (!correctId && corrNorm){
            const found = opts.find(o=> o.text.toLowerCase()===corrNorm.toLowerCase());
            if (found) correctId = found.id;
          }
          // try case where correct is option text but with extra spaces
          if (!correctId && corrNorm){
            const found = opts.find(o=> o.text.toLowerCase().trim()===corrNorm.toLowerCase().trim());
            if (found) correctId = found.id;
          }
          if (!correctId && corrNorm && opts.length){
            // if correctRaw is like "A" but lower case etc already handled
            // leave empty to surface error
          }
          const err = !correctId ? `Row ${r+1}: MC correct answer "${correctRaw}" does not match any option (use A/B/C/D or exact text)` : undefined;
          if (err) errors.push(err);
          parsed.push({id:uid(), type:t, text:rawQ, options: opts, correct_answer: correctId, marks, explanation, _error: err});
        } else if (t==="true_false"){
          let corr = correctRaw.toLowerCase().trim();
          if (corr==="t") corr="true";
          if (corr==="f") corr="false";
          if (corr==="yes") corr="true";
          if (corr==="no") corr="false";
          if (!["true","false"].includes(corr)){
            errors.push(`Row ${r+1}: TF correct must be true or false (got "${correctRaw}")`);
            corr="";
          }
          parsed.push({id:uid(), type:t, text:rawQ, options:[], correct_answer: corr, marks, explanation, _error: corr?undefined:`invalid tf answer`});
        } else {
          // short answer
          parsed.push({id:uid(), type:t, text:rawQ, options:[], correct_answer: correctRaw, marks, explanation});
        }
      }
      if (parsed.length===0){ setParseErrors(["No valid questions found. Check template."]); }
      else if (parsed.length>200){ setParseErrors([`Too many questions: ${parsed.length}. Max 200 per import.`]); }
      else { setParseErrors(errors.slice(0,12)); }
      setQuestions(parsed);
    }catch(err:any){
      setParseErrors([`Failed to parse Excel: ${err.message}. Try .xlsx format from template.`]);
      setQuestions([]);
    }
    // reset input
    e.target.value="";
  }

  async function handleImport(){
    setMsg("");
    if (!title.trim()){ alert("Quiz title required"); return; }
    if (questions.length===0){ alert("No questions to import — upload Excel first"); return; }
    const invalid = questions.filter(q=> !q.text.trim() || !q.correct_answer);
    if (invalid.length){ if(!confirm(`${invalid.length} question(s) are missing correct answer — they will be imported with blank answer (you must fix later). Continue?`)) return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description, subject, grade, instructions,
      time_limit: timeLimit ? Number(timeLimit): null,
      passing_percentage: passing ? Number(passing) : 50,
      status: "draft",
      settings: {
        requireName: true, requireStudentId: false, allowAnonymous: false, attempts: "multiple", maxAttempts: "",
        randomizeQuestions: false, randomizeOptions: false, showOneAtATime: false, allowNavigation: true,
        showScoreImmediately: true, showCorrectAnswers: true, showExplanations: false, hideUntilReleased: false,
        accessCode: "", startAt:"", endAt:"", studentAuthMode:"open"
      },
      questions: questions.map((q,i)=>({
        id: q.id, type: q.type, text: q.text, options: q.options, correct_answer: q.correct_answer, marks: q.marks, explanation: q.explanation, order_index: i
      }))
    };
    try{
      const res=await fetch("/api/quizzes",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Failed");
      setMsg(`✅ Imported ${questions.length} questions into quiz "${data.quiz.title}" — redirecting to edit...`);
      setTimeout(()=> window.location.href=`/dashboard/quizzes/${data.quiz.id}/edit`, 1200);
    }catch(e:any){
      setMsg(`❌ ${e.message}`);
    }finally{ setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200">
        <div>
          <div className="font-bold">📥 Import Quiz from Excel</div>
          <div className="text-sm text-slate-600">Upload your Excel and save hours — Momin Academy style, small institute badge auto-shown on every quiz.</div>
        </div>
        <Button variant="secondary" onClick={downloadTemplate}>⬇ Download Template (.xlsx)</Button>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">1) Quiz Details</h3>
          <div><Label>Quiz Title *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g., Science Ch.1 - Momin Academy Test" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g., Science" /></div>
            <div><Label>Grade / Class</Label><Input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="e.g., Class 8" /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description" /></div>
          <div><Label>Instructions</Label><Textarea rows={2} value={instructions} onChange={e=>setInstructions(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Time limit (minutes)</Label><Input type="number" value={timeLimit} onChange={e=>setTimeLimit(e.target.value)} placeholder="blank = no limit" /></div>
            <div><Label>Passing %</Label><Input type="number" value={passing} onChange={e=>setPassing(e.target.value)} /></div>
          </div>
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800">
            After import you can edit everything at <b>Dashboard → My Quizzes → Edit</b>, set <b>Student Access (Open/Institute/Both)</b>, and publish. Your <b>🏫 Momin Academy</b> badge shows small on all quizzes.
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">2) Upload Excel (.xlsx)</h3>
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
            <div className="text-3xl">📊</div>
            <div className="font-medium mt-2">Drop your Excel here</div>
            <div className="text-xs text-slate-500 mt-1">Headers: Type | Question | Option A-D | Correct Answer | Marks | Explanation<br/>Max 200 questions • .xlsx, .xls, .csv</div>
            <label className="inline-flex mt-4 h-10 px-5 items-center justify-center rounded-xl bg-indigo-600 text-white text-sm font-medium cursor-pointer hover:bg-indigo-700">
              Choose File
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
            {fileName && <div className="text-xs text-slate-600 mt-2">Selected: <b>{fileName}</b> • {questions.length} questions parsed</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={downloadTemplate}>Download Template Again</Button>
            <a href="/dashboard/create" className="flex-1 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm hover:bg-slate-50">Or Create Manually</a>
          </div>
          {parseErrors.length>0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            {parseErrors.map((e,i)=><div key={i}>• {e}</div>)}
            {parseErrors.length>=12 && <div>...more errors hidden</div>}
          </div>}
        </Card>
      </div>

      {questions.length>0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Preview — {questions.length} questions</h3>
            <Badge>{questions.filter(q=>q._error).length? `${questions.filter(q=>q._error).length} need fix` : "All parsed"}</Badge>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Question</th><th className="text-left px-3 py-2">Options / Answer</th><th className="text-left px-3 py-2">Marks</th><th className="text-left px-3 py-2"></th></tr>
              </thead>
              <tbody className="divide-y">
                {questions.slice(0,120).map((q,i)=>(
                  <tr key={q.id} className={q._error? "bg-red-50":""}>
                    <td className="px-3 py-2 text-xs">{i+1}</td>
                    <td className="px-3 py-2"><Badge variant={q.type==="multiple_choice"?"info": q.type==="true_false"?"warning":"default"}>{q.type.replace("_"," ")}</Badge></td>
                    <td className="px-3 py-2"><div className="font-medium line-clamp-2">{q.text}</div>{q._error && <div className="text-xs text-red-600 mt-1">{q._error}</div>}</td>
                    <td className="px-3 py-2 text-xs">
                      {q.type==="multiple_choice" && <div>{q.options.map((o,idx)=> <div key={o.id} className={q.correct_answer===o.id? "font-bold text-emerald-700":""}>{String.fromCharCode(65+idx)}. {o.text} {q.correct_answer===o.id?"✓":""}</div>)}<div className="mt-1 text-slate-500">Correct: {q.correct_answer? q.options.find(o=>o.id===q.correct_answer)?.text : "(blank)"}</div></div>}
                      {q.type==="true_false" && <div>Correct: <b>{q.correct_answer||"(blank)"}</b></div>}
                      {q.type==="short_answer" && <div>Answer: <b>{q.correct_answer||"(blank)"}</b></div>}
                      {q.explanation && <div className="text-slate-500 mt-1">Exp: {q.explanation.slice(0,60)}</div>}
                    </td>
                    <td className="px-3 py-2">{q.marks}</td>
                    <td className="px-3 py-2"><button onClick={()=> setQuestions(questions.filter(x=>x.id!==q.id))} className="text-xs text-red-600 hover:underline">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {questions.length>120 && <div className="p-3 text-xs text-center text-slate-500">...and {questions.length-120} more (all will be imported)</div>}
          </div>
          <div className="p-4 border-t bg-slate-50 flex gap-3">
            <Button onClick={handleImport} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base">{saving?"Importing...":`Import ${questions.length} Questions → Create Quiz`}</Button>
            <Button variant="secondary" onClick={()=>{ setQuestions([]); setFileName(""); }}>Clear</Button>
          </div>
          {msg && <div className="px-4 pb-4 text-sm">{msg}</div>}
        </Card>
      )}

      <Card className="p-4 bg-slate-900 text-white">
        <div className="font-semibold text-sm">Need help?</div>
        <div className="text-xs text-slate-300 mt-1">1) Download template → 2) Fill your questions → 3) Set Quiz Title → 4) Upload → 5) Preview → 6) Import → Edit/Publish. You can still edit every question after import before publishing. Institute badge <b>🏫 Momin Academy</b> shows automatically — no need to type it in Excel.</div>
      </Card>
    </div>
  );
}
