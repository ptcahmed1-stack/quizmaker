"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input, Label, Badge } from "@/components/ui";

type QuizInfo = any;
type Question = any;

export default function StudentQuizPage(){
  const params = useParams() as {code:string};
  const code = params.code?.toUpperCase();
  const [quiz,setQuiz]=useState<QuizInfo|null>(null);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [error,setError]=useState<string>("");
  const [status,setStatus]=useState<string>("");
  const [loading,setLoading]=useState(true);

  // Student form
  const [studentName,setStudentName]=useState("");
  const [studentId,setStudentId]=useState("");
  const [studentPassword,setStudentPassword]=useState("");
  const [accessCode,setAccessCode]=useState("");
  const [authTab,setAuthTab]=useState<"institute"|"guest">("institute");
  const [verifyError,setVerifyError]=useState("");
  const [verifying,setVerifying]=useState(false);
  const [verifiedStudent,setVerifiedStudent]=useState<any>(null);

  // Quiz state
  const [started,setStarted]=useState(false);
  const [startedAt,setStartedAt]=useState<Date|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [currentIdx,setCurrentIdx]=useState(0);
  const [timeLeft,setTimeLeft]=useState<number|null>(null); // seconds
  const [submitting,setSubmitting]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [connectionWarning,setConnectionWarning]=useState(false);
  const timerRef = useRef<any>(null);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      try{
        const res = await fetch(`/api/quizzes/by-code/${code}`);
        const data = await res.json();
        if (!res.ok){
          setError(data.error||"Quiz not found");
          setStatus(data.status||"");
          setQuiz(data.quiz||null);
        } else {
          setQuiz(data.quiz);
          setQuestions(data.questions);
          // handle time limit initial
          if (data.quiz.time_limit) setTimeLeft(data.quiz.time_limit*60);
        }
      } catch(e){
        setError("Failed to load quiz. Check your connection.");
      }
      setLoading(false);
    }
    if (code) load();
  },[code]);

  // Timer effect
  useEffect(()=>{
    if (!started || timeLeft===null || result) return;
    if (timeLeft <=0){
      handleSubmit(true);
      return;
    }
    timerRef.current = setTimeout(()=> setTimeLeft(t=> (t!==null? t-1: null)), 1000);
    return ()=> clearTimeout(timerRef.current);
  },[started, timeLeft, result]);

  // Offline handling: preserve answers locally + warn
  useEffect(()=>{
    const saveKey = `qm-answers-${code}`;
    if (started && Object.keys(answers).length){
      localStorage.setItem(saveKey, JSON.stringify({answers, studentName, studentId, startedAt}));
    }
  },[answers, studentName, studentId, startedAt, started, code]);

  useEffect(()=>{
    const saveKey = `qm-answers-${code}`;
    const saved = localStorage.getItem(saveKey);
    if (saved){
      try{
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        // don't auto-restore started state? keep for recovery
      }catch{}
    }
    function onOffline(){ setConnectionWarning(true); }
    function onOnline(){ setConnectionWarning(false); }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    // initial check
    if (typeof navigator !== "undefined" && !navigator.onLine) setConnectionWarning(true);
    return ()=>{
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  },[code]);

  // Warn before leaving
  useEffect(()=>{
    function beforeUnload(e: BeforeUnloadEvent){
      if (started && !result) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return ()=> window.removeEventListener("beforeunload", beforeUnload);
  },[started, result]);

  const authMode = quiz?.settings?.studentAuthMode || "open"; // open | institute | both

  async function handleStart(){
    setVerifyError("");
    const isInstitute = authMode==="institute" || (authMode==="both" && authTab==="institute");
    const isGuest = authMode==="open" || (authMode==="both" && authTab==="guest");

    if (isInstitute){
      if (!studentId.trim() || !studentPassword.trim()){
        setVerifyError("Enter your Institute ID and Password"); return;
      }
      setVerifying(true);
      try{
        const res=await fetch("/api/institute-students/verify",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({student_id: studentId, password: studentPassword, quizCode: code})});
        const data=await res.json();
        if(!res.ok){ setVerifyError(data.error||"Invalid ID or password"); setVerifying(false); return; }
        setVerifiedStudent(data.student);
        setStudentName(data.student.name); // use institute name
      }catch{
        setVerifyError("Verification failed — check connection");
        setVerifying(false);
        return;
      }
      setVerifying(false);
    } else {
      // guest / open
      if (quiz.settings?.requireName!==false && !studentName.trim()){
        alert("Please enter your name"); return;
      }
      if (quiz.settings?.requireStudentId && !studentId.trim()){
        alert("Please enter your Student ID / Roll number"); return;
      }
    }

    if (quiz.settings?.accessCode && accessCode !== quiz.settings.accessCode){
      alert("Invalid access code"); return;
    }
    // Check attempt limits? server will handle but we can warn
    setStarted(true);
    setStartedAt(new Date());
    if (quiz.time_limit) setTimeLeft(quiz.time_limit*60);
    // scroll top
    window.scrollTo(0,0);
  }

  async function handleSubmit(isAuto=false){
    if (!started || submitting) return;
    const unanswered = questions.filter(q=> !answers[q.id] || String(answers[q.id]).trim()==="").length;
    if (!isAuto && unanswered>0){
      if (!confirm(`You still have ${unanswered} unanswered question(s). Are you sure you want to submit?`)) return;
    }
    setSubmitting(true);
    try{
      const payload = {
        quizCode: code,
        student_name: studentName,
        student_id: studentId,
        student_password: studentPassword || undefined,
        answers: questions.map(q=> ({questionId: q.id, answer: answers[q.id]||""})),
        time_taken: startedAt ? Math.floor((Date.now()-startedAt.getTime())/1000) : null,
        startedAt: startedAt?.toISOString(),
        accessCode
      };
      const res = await fetch("/api/submissions",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const data = await res.json();
      if (!res.ok){
        alert(data.error||"Submission failed. Please check your connection and try again.");
        setSubmitting(false);
        return;
      }
      setResult(data);
      // clear local saved answers
      localStorage.removeItem(`qm-answers-${code}`);
      window.scrollTo(0,0);
    } catch(e){
      alert("Submission failed — please check your internet and try again. Your answers are saved locally.");
      setConnectionWarning(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><Card className="p-8 text-center">Loading quiz...</Card></div>;
  if (error){
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-2xl">🚫</div>
          <h1 className="text-xl font-bold mt-4">{status==="closed"?"Quiz Closed": status==="not_found"?"Not Found":"Quiz Unavailable"}</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
          {status==="closed" && <p className="text-sm text-slate-500 mt-2">This quiz is currently closed. Please contact your teacher.</p>}
          <a href="/" className="inline-block mt-6 text-sm text-indigo-600 hover:underline">← Back to QuizMaker</a>
        </Card>
      </div>
    );
  }
  if (result){
    const r = result.result;
    const submission = result.submission;
    const settings = result.settings;
    // If hideUntilReleased and not showing score, show pending
    if (!r.showScore && settings.hideUntilReleased){
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-2xl">📝</div>
            <h1 className="text-xl font-bold mt-4">Quiz Submitted!</h1>
            <p className="text-sm text-slate-600 mt-2">Your answers have been recorded. Your teacher will release results later.</p>
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
              <div><b>{studentName}</b> {studentId?`• ${studentId}`:""}</div>
              <div className="text-xs text-slate-500">Submitted at {new Date(submission.submitted_at).toLocaleString()}</div>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex justify-center">
        <div className="w-full max-w-2xl space-y-4">
          <Card className="p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] tracking-widest font-semibold px-2.5 py-1 rounded-full mb-2">🏫 {quiz?.institute_name || "Momin Academy"}</div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto text-xl">✓</div>
            <h1 className="text-2xl font-extrabold mt-3">QUIZ COMPLETE</h1>
            {r.showScore ? (
              <>
                <div className="mt-4">
                  <div className="text-5xl font-extrabold">{submission.score} / {submission.totalMarks}</div>
                  <div className="text-3xl font-bold mt-2 text-indigo-600">{submission.percentage}%</div>
                  <div className={`inline-flex mt-3 px-3 py-1 rounded-full text-sm font-bold border ${submission.passed?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-red-50 text-red-700 border-red-200"}`}>{submission.passed?"PASSED":"FAILED"}</div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6 text-center">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><div className="text-lg font-bold text-emerald-600">{r.questionResults? r.questionResults.filter((x:any)=>x.isCorrect).length : "?"}</div><div className="text-xs text-slate-500">Correct</div></div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><div className="text-lg font-bold text-red-600">{r.questionResults? r.questionResults.filter((x:any)=>!x.isCorrect).length : "?"}</div><div className="text-xs text-slate-500">Incorrect</div></div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><div className="text-lg font-bold">{submission.totalMarks}</div><div className="text-xs text-slate-500">Total marks</div></div>
                </div>
                {submission.time_taken !== null && <div className="text-xs text-slate-500 mt-3">Time taken: {Math.floor(submission.time_taken/60)}m {submission.time_taken%60}s</div>}
              </>
            ) : (
              <p className="text-sm text-slate-600 mt-3">Your submission has been recorded. Score hidden per teacher settings.</p>
            )}
            <div className="text-xs text-slate-500 mt-4">Student: <b>{studentName}</b> {studentId?`• ${studentId}`:""} • {new Date(submission.submitted_at).toLocaleString()}</div>
          </Card>

          {r.questionResults && (
            <div className="space-y-3">
              <h2 className="font-semibold">Detailed Results</h2>
              {r.questionResults.map((qr:any, idx:number)=>(
                <Card key={qr.questionId} className={`p-4 border-l-4 ${qr.isCorrect?"border-l-emerald-500":"border-l-red-500"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">Q{idx+1}. {qr.text}</div>
                    <Badge variant={qr.isCorrect?"success":"danger"}>{qr.isCorrect?"Correct":"Incorrect"}</Badge>
                  </div>
                  {qr.type==="multiple_choice" && qr.options && (
                    <div className="mt-3 space-y-1.5">
                      {qr.options.map((o:any)=>{
                        const isSelected = qr.studentAnswer===o.id || qr.studentAnswer===o.text;
                        const isCorrectOpt = qr.correctAnswer===o.id || qr.correctAnswer===o.text;
                        return (
                          <div key={o.id} className={`h-10 rounded-xl border flex items-center px-3 text-sm justify-between ${isCorrectOpt?"bg-emerald-50 border-emerald-300 text-emerald-800": isSelected?"bg-red-50 border-red-300 text-red-800":"bg-white border-slate-200"}`}>
                            <span>{o.text}</span>
                            {isCorrectOpt && <span className="text-xs font-bold">✓ Correct</span>}
                            {isSelected && !isCorrectOpt && <span className="text-xs">Your answer</span>}
                            {isSelected && isCorrectOpt && <span className="text-xs">Your answer ✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {qr.type==="true_false" && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-sm">Your answer: <b className={qr.isCorrect?"text-emerald-600":"text-red-600"}>{qr.studentAnswer || "(blank)"}</b></div>
                      {r.showCorrect && <div className="text-sm">Correct answer: <b>{qr.correctAnswer}</b></div>}
                    </div>
                  )}
                  {qr.type==="short_answer" && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm">Your answer: <b>{qr.studentAnswer || "(blank)"}</b></div>
                      {r.showCorrect && <div className="text-sm">Correct answer: <b>{qr.correctAnswer}</b></div>}
                    </div>
                  )}
                  {qr.explanation && r.showExplanations && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm"><b>Explanation:</b> {qr.explanation}</div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">{qr.earned}/{qr.marks} marks</div>
                </Card>
              ))}
            </div>
          )}

          {!r.questionResults && r.showScore && (
            <Card className="p-4 text-center text-sm text-slate-500">
              Detailed answers are hidden per teacher settings.
            </Card>
          )}

          <div className="text-center py-4">
            <a href="/" className="text-sm text-slate-500 hover:underline">Powered by QuizMaker</a>
          </div>
        </div>
      </div>
    );
  }

  // Not started -> landing screen
  if (!started){
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-medium shadow-sm">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Live Quiz • No app needed
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-1 bg-slate-900 text-white text-[11px] tracking-widest font-semibold px-2.5 py-1 rounded-full">🏫 {quiz.institute_name || "Momin Academy"}</div>
              <div className="text-xs font-semibold tracking-wider text-indigo-600 uppercase mt-2">{quiz.subject || "Quiz"} {quiz.grade? `• ${quiz.grade}`:""}</div>
              <h1 className="text-2xl font-extrabold mt-1 leading-tight">{quiz.title}</h1>
              {quiz.description && <p className="text-sm text-slate-600 mt-2">{quiz.description}</p>}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                <Badge variant="info">{questions.length} Questions</Badge>
                {quiz.time_limit ? <Badge variant="warning">⏱ {quiz.time_limit} minutes</Badge> : <Badge> No time limit</Badge>}
                <Badge>{quiz.passing_percentage}% to pass</Badge>
              </div>
            </div>

            {quiz.instructions && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <div className="font-semibold">Instructions</div>
                <div className="text-slate-700 mt-1">{quiz.instructions}</div>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {/* Institute / Open / Both auth */}
              {(authMode==="institute" || authMode==="both") && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
                  {authMode==="institute" ? "🏫 This quiz is for institute students only — enter your Institute ID + Password." : "🔓 This quiz supports both institute students and guests — pick a tab below."}
                </div>
              )}
              {authMode==="institute" && (
                <>
                  <div><Label>Institute Student ID *</Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Your Institute ID" className="h-12 text-base" /></div>
                  <div><Label>Password *</Label><Input type="password" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} placeholder="Your password (teacher set)" className="h-12 text-base" /></div>
                  <div className="rounded-lg bg-white border border-amber-200 p-2 text-xs text-amber-800">Use the ID + Password your teacher gave you. If you are not in this institute, you cannot take this quiz.</div>
                </>
              )}
              {authMode==="open" && (
                <>
                  <div><Label>Student Name {quiz.settings?.requireName!==false && <span className="text-red-500">*</span>}</Label><Input value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="Enter your full name" className="h-12 text-base" /></div>
                  {(quiz.settings?.requireStudentId || quiz.settings?.allowAnonymous===false) && (
                    <div><Label>Student ID / Roll Number {quiz.settings?.requireStudentId && <span className="text-red-500">*</span>}</Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="e.g., 12345" className="h-12 text-base" /></div>
                  )}
                  {quiz.settings?.allowAnonymous && !quiz.settings?.requireStudentId && (
                    <div><Label>Student ID <span className="text-slate-400">(optional)</span></Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Optional" className="h-12 text-base" /></div>
                  )}
                  {!quiz.settings?.requireStudentId && !quiz.settings?.allowAnonymous && (
                    <div><Label>Student ID <span className="text-slate-400">(optional)</span></Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Optional" className="h-12 text-base" /></div>
                  )}
                </>
              )}
              {authMode==="both" && (
                <div>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button onClick={()=>{setAuthTab("institute"); setVerifyError("")}} className={`h-10 rounded-lg font-medium text-sm ${authTab==="institute"?"bg-slate-900 text-white":"bg-white border border-slate-200"}`}>🏫 Institute Login</button>
                    <button onClick={()=>{setAuthTab("guest"); setVerifyError("")}} className={`h-10 rounded-lg font-medium text-sm ${authTab==="guest"?"bg-slate-900 text-white":"bg-white border border-slate-200"}`}>🌍 Guest</button>
                  </div>
                  {authTab==="institute" ? (
                    <div className="mt-4 space-y-3">
                      <div><Label>Institute Student ID *</Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Your Institute ID" className="h-12 text-base" /></div>
                      <div><Label>Password *</Label><Input type="password" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} placeholder="Password" className="h-12 text-base" /></div>
                      <div className="text-xs text-slate-500">Name will be filled from your institute record.</div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div><Label>Your Name *</Label><Input value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="Enter your full name" className="h-12 text-base" /></div>
                      <div><Label>Student ID <span className="text-slate-400">(optional)</span></Label><Input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Optional" className="h-12 text-base" /></div>
                      <div className="text-xs text-slate-500">Guest entry — no password needed. Institute students should use the Institute tab.</div>
                    </div>
                  )}
                </div>
              )}

              {quiz.settings?.accessCode && (
                <div>
                  <Label>Access Code <span className="text-red-500">*</span></Label>
                  <Input value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Enter access code" className="h-12 text-base" />
                </div>
              )}
              {verifyError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{verifyError}</div>}

              {quiz.settings?.startAt && <div className="text-xs text-slate-500">Starts: {new Date(quiz.settings.startAt).toLocaleString()}</div>}
              {quiz.settings?.endAt && <div className="text-xs text-slate-500">Ends: {new Date(quiz.settings.endAt).toLocaleString()}</div>}

              <Button size="lg" className="w-full h-14 text-base font-bold" onClick={handleStart} disabled={verifying}>{verifying?"Verifying...":"START QUIZ →"}</Button>
              <div className="text-xs text-center text-slate-500">By starting, you agree to submit your answers for grading. Your attempt will be recorded.</div>
            </div>
          </Card>

          <div className="text-center text-xs text-slate-400">🏫 {quiz.institute_name || "Momin Academy"} • Powered by QuizMaker • Works on any phone</div>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const q = questions[currentIdx];
  const progress = Math.round(((currentIdx+1)/questions.length)*100);
  const answeredCount = Object.keys(answers).filter(k=> answers[k] && String(answers[k]).trim()!=="").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{quiz.title}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-500 truncate">🏫 {quiz.institute_name || "Momin Academy"} • {answeredCount}/{questions.length} answered</div>
          </div>
          {timeLeft!==null && (
            <div className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold border ${timeLeft<60?"bg-red-50 text-red-700 border-red-200 animate-pulse": timeLeft<300?"bg-amber-50 text-amber-800 border-amber-200":"bg-slate-900 text-white border-slate-900"}`}>
              ⏱ {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}
            </div>
          )}
          <button onClick={()=> {
            if (confirm("Leave quiz? Your progress will be lost unless you submit. Answers are saved locally for this session.")) {
              setStarted(false);
            }
          }} className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Exit</button>
        </div>
        <div className="h-1.5 bg-slate-100">
          <div className="h-1.5 bg-indigo-600 transition-all" style={{width: `${progress}%`}}/>
        </div>
      </header>

      {connectionWarning && (
        <div className="bg-amber-500 text-white text-sm text-center py-2 px-4">
          ⚠ Connection lost — your answers are saved locally. Reconnect to submit.
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pb-24">
        {/* Question nav overview if allowNavigation */}
        {quiz.settings?.allowNavigation!==false && !quiz.settings?.showOneAtATime && questions.length>1 && (
          <Card className="p-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {questions.map((qq,i)=> {
                const isAnswered = !!answers[qq.id];
                const isCurrent = i===currentIdx;
                return (
                  <button key={qq.id} onClick={()=>setCurrentIdx(i)} className={`w-8 h-8 rounded-lg text-xs font-bold border ${isCurrent?"bg-slate-900 text-white border-slate-900": isAnswered?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-white border-slate-200 text-slate-600"}`}>{i+1}</button>
                );
              })}
            </div>
          </Card>
        )}

        {quiz.settings?.showOneAtATime ? (
          // Show one at a time
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">Question {currentIdx+1} of {questions.length}</span>
              <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">{q.marks} mark{q.marks!==1?"s":""}</span>
            </div>
            <h2 className="text-lg font-semibold leading-relaxed">{q.text}</h2>

            <div className="mt-6 space-y-3">
              {q.type==="multiple_choice" && q.options.map((o:any)=> {
                const selected = answers[q.id]===o.id;
                return (
                  <label key={o.id} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selected?"bg-indigo-50 border-indigo-600 shadow-sm":"bg-white border-slate-200 hover:border-slate-300"}`}>
                    <input type="radio" name={`q-${q.id}`} checked={selected} onChange={()=> setAnswers({...answers, [q.id]: o.id})} className="w-5 h-5 accent-indigo-600" />
                    <span className="flex-1 text-base">{o.text}</span>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected?"bg-indigo-600 border-indigo-600 text-white":"border-slate-300"}`}>{selected?"✓":""}</span>
                  </label>
                );
              })}
              {q.type==="true_false" && ["true","false"].map(v=>{
                const selected = String(answers[q.id]||"").toLowerCase()===v;
                return (
                  <label key={v} className={`flex items-center justify-center gap-2 h-14 rounded-2xl border-2 cursor-pointer font-medium ${selected?"bg-indigo-600 text-white border-indigo-600":"bg-white border-slate-200"}`}>
                    <input type="radio" name={`q-${q.id}`} checked={selected} onChange={()=> setAnswers({...answers, [q.id]: v})} className="hidden" />
                    <span className="capitalize text-base">{v}</span>
                  </label>
                );
              })}
              {q.type==="short_answer" && (
                <div>
                  <Input value={answers[q.id]||""} onChange={e=> setAnswers({...answers, [q.id]: e.target.value})} placeholder="Type your answer here" className="h-12 text-base" />
                  <div className="text-xs text-slate-500 mt-2">Answer is case-insensitive</div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="secondary" className="flex-1 h-12" disabled={currentIdx===0} onClick={()=> setCurrentIdx(i=> Math.max(0,i-1))}>← Previous</Button>
              {currentIdx < questions.length-1 ? (
                <Button className="flex-1 h-12" onClick={()=> setCurrentIdx(i=> Math.min(questions.length-1,i+1))}>Next →</Button>
              ) : (
                <Button className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700" onClick={()=>handleSubmit(false)} disabled={submitting}>{submitting?"Submitting...":"Submit Quiz"}</Button>
              )}
            </div>
          </Card>
        ) : (
          // Show all questions or one with nav but we still show one at a time with nav; for simplicity if not showOneAtATime we show single with nav as well but plus overview? Already one. For non-one-at-a-time we could show all scrollable but spec says Show one question at a time is option; if disabled we can show all.
          // Let's implement both: if !showOneAtATime -> show all questions on same page with navigation still.
          quiz.settings?.showOneAtATime ? null : (
            <div className="space-y-4">
              {questions.map((qq:any, idx:number)=>(
                <Card key={qq.id} className={`p-5 sm:p-6 ${currentIdx===idx?"ring-2 ring-indigo-500":""}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">Question {idx+1} of {questions.length}</span>
                    <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">{qq.marks} mark{qq.marks!==1?"s":""}</span>
                  </div>
                  <h2 className="text-base font-semibold leading-relaxed">{qq.text}</h2>
                  <div className="mt-4 space-y-2">
                    {qq.type==="multiple_choice" && qq.options.map((o:any)=>{
                      const selected = answers[qq.id]===o.id;
                      return (
                        <label key={o.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer ${selected?"bg-indigo-50 border-indigo-600":"bg-white border-slate-200"}`}>
                          <input type="radio" name={`q-${qq.id}`} checked={selected} onChange={()=> setAnswers({...answers, [qq.id]: o.id})} className="w-5 h-5 accent-indigo-600" />
                          <span className="flex-1 text-sm">{o.text}</span>
                        </label>
                      );
                    })}
                    {qq.type==="true_false" && (
                      <div className="grid grid-cols-2 gap-2">
                        {["true","false"].map(v=>{
                          const selected = String(answers[qq.id]||"").toLowerCase()===v;
                          return (
                            <label key={v} className={`h-12 rounded-2xl border-2 flex items-center justify-center font-medium cursor-pointer ${selected?"bg-indigo-600 text-white border-indigo-600":"bg-white border-slate-200"}`}>
                              <input type="radio" name={`q-${qq.id}`} checked={selected} onChange={()=> setAnswers({...answers, [qq.id]: v})} className="hidden" />
                              <span className="capitalize">{v}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {qq.type==="short_answer" && (
                      <Input value={answers[qq.id]||""} onChange={e=> setAnswers({...answers, [qq.id]: e.target.value})} placeholder="Type your answer" className="h-11" />
                    )}
                  </div>
                </Card>
              ))}
              <Card className="p-4 flex gap-3 sticky bottom-4 bg-white/90 backdrop-blur border-slate-300 shadow-lg">
                <div className="flex-1 text-sm">
                  <div className="font-medium">{answeredCount}/{questions.length} answered</div>
                  <div className="text-xs text-slate-500">Review before submitting</div>
                </div>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>handleSubmit(false)} disabled={submitting}>{submitting?"Submitting...":"Submit Quiz"}</Button>
              </Card>
            </div>
          )
        )}

        {/* If both modes collapsed, handle second rendering for showOneAtATime false we already did; if showOneAtATime true we rendered single. For !showOneAtATime we need to avoid double rendering single card earlier - we did conditional separate.*/}

      </main>

      {/* Bottom nav for one-at-a-time with all nav */}
      {quiz.settings?.showOneAtATime && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Button variant="secondary" className="flex-1" disabled={currentIdx===0} onClick={()=> setCurrentIdx(i=> Math.max(0,i-1))}>Previous</Button>
            <span className="text-xs text-slate-500">{currentIdx+1} / {questions.length}</span>
            {currentIdx < questions.length-1 ? (
              <Button className="flex-1" onClick={()=> setCurrentIdx(i=> Math.min(questions.length-1,i+1))}>Next</Button>
            ) : (
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={()=>handleSubmit(false)} disabled={submitting}>{submitting?"Submitting...":"Submit"}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
