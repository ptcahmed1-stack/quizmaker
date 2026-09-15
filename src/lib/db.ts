import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

// Detect Turso (for Vercel). If TURSO_URL is set, use cloud SQLite. Otherwise use local better-sqlite3.
const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || "";
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || "";
const USE_TURSO = !!TURSO_URL;

let localDb: any = null;
let tursoClient: any = null;
let tursoInitDone = false;

function getTursoClient() {
  if (tursoClient) return tursoClient;
  if (!USE_TURSO) return null;
  const { createClient } = require("@libsql/client");
  tursoClient = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  return tursoClient;
}

// Unified wrapper: callers do `const db = await getDb(); await db.prepare(...).get(...)`
// For local, we wrap sync better-sqlite3 calls as async Promises. For Turso, we use HTTP.
export async function getDb(): Promise<any> {
  if (USE_TURSO) {
    const client = getTursoClient();
    if (!client) throw new Error("TURSO_URL not set");
    if (!tursoInitDone) {
      await initTurso(client);
      tursoInitDone = true;
    }
    return createTursoWrapper(client);
  } else {
    if (localDb) return createLocalWrapper(localDb);
    const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const Database = require("better-sqlite3");
    localDb = new Database(DB_PATH);
    try { localDb.pragma("journal_mode = WAL"); } catch {}
    await initLocal(localDb);
    return createLocalWrapper(localDb);
  }
}

function createLocalWrapper(db: any) {
  return {
    _raw: db,
    exec: async (sql: string) => { db.exec(sql); },
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        get: async (...params: any[]) => stmt.get(...params),
        all: async (...params: any[]) => stmt.all(...params),
        run: async (...params: any[]) => stmt.run(...params),
      };
    },
    transaction: (fn: any) => {
      // For local, use real transaction. For async wrapper, we just run sequentially.
      const trx = db.transaction(fn);
      return async (...args: any[]) => trx(...args);
    },
  };
}

function createTursoWrapper(client: any) {
  return {
    _raw: client,
    exec: async (sql: string) => {
      const parts = sql.split(";").map((s:string)=>s.trim()).filter(Boolean);
      for (const p of parts) await client.execute(p);
    },
    prepare: (sql: string) => {
      return {
        get: async (...params: any[]) => {
          const res = await client.execute({ sql, args: params });
          return res.rows[0] as any;
        },
        all: async (...params: any[]) => {
          const res = await client.execute({ sql, args: params });
          return res.rows as any[];
        },
        run: async (...params: any[]) => {
          const res = await client.execute({ sql, args: params });
          return res;
        },
      };
    },
    transaction: (fn: any) => {
      // Turso HTTP has no real transaction, just run sequentially
      return async (...args: any[]) => fn(...args);
    },
  };
}

async function initTurso(client: any) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, institute_name TEXT DEFAULT 'Momin Academy', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, subject TEXT, grade TEXT, instructions TEXT, time_limit INTEGER, passing_percentage INTEGER DEFAULT 50, status TEXT DEFAULT 'draft', code TEXT UNIQUE, settings_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, published_at DATETIME)`,
    `CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, options_json TEXT, correct_answer TEXT NOT NULL, marks INTEGER DEFAULT 1, explanation TEXT, order_index INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, student_name TEXT NOT NULL, student_id TEXT, answers_json TEXT NOT NULL, score INTEGER NOT NULL, total_marks INTEGER NOT NULL, percentage REAL NOT NULL, passed INTEGER NOT NULL, time_taken INTEGER, attempt_number INTEGER DEFAULT 1, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS institute_students (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, student_id TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, class_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(teacher_id, student_id))`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_teacher ON quizzes(teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_code ON quizzes(code)`,
    `CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_quiz ON submissions(quiz_id)`,
    `CREATE INDEX IF NOT EXISTS idx_institute_teacher ON institute_students(teacher_id)`,
  ];
  for (const s of stmts) {
    try { await client.execute(s); } catch (e) { console.error(e); }
  }
  // Migration: add institute_name if missing (old DB)
  try { await client.execute(`ALTER TABLE users ADD COLUMN institute_name TEXT DEFAULT 'Momin Academy'`); } catch {}
  try { await client.execute(`UPDATE users SET institute_name='Momin Academy' WHERE institute_name IS NULL OR institute_name=''`); } catch {}
  try { await seedTurso(client); } catch (e) { console.error("seed turso", e); }
}

async function initLocal(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, institute_name TEXT DEFAULT 'Momin Academy', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, subject TEXT, grade TEXT, instructions TEXT, time_limit INTEGER, passing_percentage INTEGER DEFAULT 50, status TEXT DEFAULT 'draft', code TEXT UNIQUE, settings_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, published_at DATETIME);
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, options_json TEXT, correct_answer TEXT NOT NULL, marks INTEGER DEFAULT 1, explanation TEXT, order_index INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, student_name TEXT NOT NULL, student_id TEXT, answers_json TEXT NOT NULL, score INTEGER NOT NULL, total_marks INTEGER NOT NULL, percentage REAL NOT NULL, passed INTEGER NOT NULL, time_taken INTEGER, attempt_number INTEGER DEFAULT 1, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS institute_students (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, student_id TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, class_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(teacher_id, student_id));
    CREATE INDEX IF NOT EXISTS idx_quizzes_teacher ON quizzes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_code ON quizzes(code);
    CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_quiz ON submissions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_institute_teacher ON institute_students(teacher_id);
  `);
  // Migration for old local DBs
  try { db.exec(`ALTER TABLE users ADD COLUMN institute_name TEXT DEFAULT 'Momin Academy'`); } catch {}
  try { db.exec(`UPDATE users SET institute_name='Momin Academy' WHERE institute_name IS NULL OR institute_name=''`); } catch {}
  await seedLocal(db);
}

async function seedLocal(db: any) {
  const row = await db.prepare("SELECT COUNT(*) as c FROM users").get() as any;
  if (row.c > 0) return;
  const bcrypt = require("bcryptjs");
  const demoId = randomBytes(12).toString("hex");
  const hash = bcrypt.hashSync("demo123", 10);
  await db.prepare("INSERT INTO users (id, email, password_hash, name, institute_name) VALUES (?,?,?,?,?)").run(demoId, "demo@quizmaker.com", hash, "Demo Teacher", "Momin Academy");
  const now = new Date().toISOString();
  const quizzes = getDemoQuizzes();
  for (const qz of quizzes) {
    const qid = randomBytes(12).toString("hex");
    const settings = JSON.stringify({ requireName: true, requireStudentId: false, allowAnonymous: false, attempts: "multiple", maxAttempts: "", randomizeQuestions: false, randomizeOptions: false, showOneAtATime: false, allowNavigation: true, showScoreImmediately: true, showCorrectAnswers: true, showExplanations: true, hideUntilReleased: false, accessCode: "", startAt: "", endAt: "" });
    await db.prepare(`INSERT INTO quizzes (id, teacher_id, title, description, subject, grade, instructions, time_limit, passing_percentage, status, code, settings_json, created_at, updated_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(qid, demoId, qz.title, qz.description, qz.subject, qz.grade, qz.instructions, qz.time_limit, qz.passing, qz.status, qz.code, settings, now, now, qz.status==="published"?now:null);
    for (let i=0;i<qz.questions.length;i++) {
      const qq = qz.questions[i] as any;
      const qid2 = randomBytes(12).toString("hex");
      const opts = (qq as any).options ? JSON.stringify((qq as any).options) : null;
      await db.prepare(`INSERT INTO questions (id, quiz_id, type, text, options_json, correct_answer, marks, explanation, order_index) VALUES (?,?,?,?,?,?,?,?,?)`).run(qid2, qid, qq.type, qq.text, opts, (qq as any).correct, qq.marks, (qq as any).exp, i);
    }
    if (qz.status==="published" && qz.code==="DEMO01") {
      const qList = await db.prepare("SELECT * FROM questions WHERE quiz_id=? ORDER BY order_index").all(qid) as any[];
      const totalMarks = qList.reduce((s:number,r:any)=>s+Number(r.marks),0);
      const fakeSubs = [
        {name:"Ayesha Siddiqui", sid:"21", answers: qList.map((qq:any,i:number)=>({questionId:qq.id, answer:i%2===0?qq.correct_answer:"wrong"})), time:320},
        {name:"Usman Tariq", sid:"22", answers: qList.map((qq:any)=>({questionId:qq.id, answer:qq.correct_answer})), time:410},
      ];
      for (const fs of fakeSubs) {
        let score=0;
        for (const qq of qList) {
          const ans = fs.answers.find((a:any)=>a.questionId===qq.id);
          const given = ans?.answer||"";
          const correct = String(qq.correct_answer).trim().toLowerCase();
          if (String(given).trim().toLowerCase()===correct) score+=Number(qq.marks);
        }
        const perc=Math.round(score/totalMarks*100);
        const passed=perc>=50?1:0;
        const sid2=randomBytes(12).toString("hex");
        await db.prepare(`INSERT INTO submissions (id, quiz_id, student_name, student_id, answers_json, score, total_marks, percentage, passed, time_taken, attempt_number, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(sid2,qid,fs.name,fs.sid,JSON.stringify(fs.answers),score,totalMarks,perc,passed,fs.time,1,new Date(Date.now()-Math.random()*86400000*2).toISOString());
      }
    }
  }
}

async function seedTurso(client: any) {
  const res = await client.execute("SELECT COUNT(*) as c FROM users");
  const c = (res.rows[0] as any)?.c || 0;
  if (c>0) return;
  const bcrypt = require("bcryptjs");
  const demoId = randomBytes(12).toString("hex");
  const hash = bcrypt.hashSync("demo123",10);
  await client.execute({ sql: "INSERT INTO users (id, email, password_hash, name, institute_name) VALUES (?,?,?,?,?)", args: [demoId, "demo@quizmaker.com", hash, "Demo Teacher", "Momin Academy"] });
  const now=new Date().toISOString();
  const quizzes=getDemoQuizzes();
  for (const qz of quizzes) {
    const qid=randomBytes(12).toString("hex");
    const settings=JSON.stringify({requireName:true,requireStudentId:false,allowAnonymous:false,attempts:"multiple",maxAttempts:"",randomizeQuestions:false,randomizeOptions:false,showOneAtATime:false,allowNavigation:true,showScoreImmediately:true,showCorrectAnswers:true,showExplanations:true,hideUntilReleased:false,accessCode:"",startAt:"",endAt:""});
    await client.execute({ sql: `INSERT INTO quizzes (id, teacher_id, title, description, subject, grade, instructions, time_limit, passing_percentage, status, code, settings_json, created_at, updated_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [qid, demoId, qz.title, qz.description, qz.subject, qz.grade, qz.instructions, qz.time_limit, qz.passing, qz.status, qz.code, settings, now, now, qz.status==="published"?now:null] });
    for (let i=0;i<qz.questions.length;i++) {
      const qq=qz.questions[i] as any;
      const qid2=randomBytes(12).toString("hex");
      const opts=(qq as any).options? JSON.stringify((qq as any).options): null;
      await client.execute({ sql: `INSERT INTO questions (id, quiz_id, type, text, options_json, correct_answer, marks, explanation, order_index) VALUES (?,?,?,?,?,?,?,?,?)`, args: [qid2, qid, qq.type, qq.text, opts, (qq as any).correct, qq.marks, (qq as any).exp, i] });
    }
    if (qz.status==="published" && qz.code==="DEMO01") {
      const qRes=await client.execute({ sql:"SELECT * FROM questions WHERE quiz_id=? ORDER BY order_index", args:[qid] });
      const qList=qRes.rows as any[];
      const totalMarks=qList.reduce((s:number,r:any)=>s+Number(r.marks),0);
      const fakeSubs=[
        {name:"Ayesha Siddiqui", sid:"21", answers: qList.map((qq:any,i:number)=>({questionId:qq.id, answer:i%2===0?qq.correct_answer:"wrong"})), time:320},
        {name:"Usman Tariq", sid:"22", answers: qList.map((qq:any)=>({questionId:qq.id, answer:qq.correct_answer})), time:410},
      ];
      for (const fs of fakeSubs) {
        let score=0;
        for (const qq of qList) {
          const ans=fs.answers.find((a:any)=>a.questionId===qq.id);
          const given=ans?.answer||"";
          const correct=String(qq.correct_answer).trim().toLowerCase();
          if (String(given).trim().toLowerCase()===correct) score+=Number(qq.marks);
        }
        const perc=Math.round(score/totalMarks*100);
        const passed=perc>=50?1:0;
        const sid2=randomBytes(12).toString("hex");
        await client.execute({ sql: `INSERT INTO submissions (id, quiz_id, student_name, student_id, answers_json, score, total_marks, percentage, passed, time_taken, attempt_number, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [sid2,qid,fs.name,fs.sid,JSON.stringify(fs.answers),score,totalMarks,perc,passed,fs.time,1,new Date(Date.now()-Math.random()*86400000*2).toISOString()] });
      }
    }
  }
}

function getDemoQuizzes(): any[] {
  return [
    {
      title: "General Science — Chapter 1: Living World",
      description: "Demo quiz • 10 questions covering basics of living organisms. (Demo Data)",
      subject: "Science", grade: "Class 6", instructions: "Answer all questions. You have 10 minutes. Good luck!", time_limit: 10, passing: 50, code: "DEMO01", status: "published",
      questions: [
        { type:"multiple_choice", text:"What is the basic unit of life?", options:[{id:"a",text:"Cell"},{id:"b",text:"Tissue"},{id:"c",text:"Organ"},{id:"d",text:"Organism"}], correct:"a", marks:1, exp:"Cell is the basic unit of life."},
        { type:"true_false", text:"Plants can make their own food through photosynthesis.", correct:"true", marks:1, exp:"True — chlorophyll helps plants make food."},
        { type:"multiple_choice", text:"Which of the following is a non-living thing?", options:[{id:"a",text:"Dog"},{id:"b",text:"Tree"},{id:"c",text:"Stone"},{id:"d",text:"Fish"}], correct:"c", marks:1, exp:"Stone is non-living."},
        { type:"short_answer", text:"What gas do plants release during photosynthesis?", correct:"Oxygen", marks:1, exp:"Plants release oxygen."},
        { type:"multiple_choice", text:"How many senses do humans have?", options:[{id:"a",text:"4"},{id:"b",text:"5"},{id:"c",text:"6"},{id:"d",text:"7"}], correct:"b", marks:1, exp:"Humans have 5 senses."},
        { type:"true_false", text:"Water boils at 100°C at sea level.", correct:"true", marks:1, exp:"True."},
        { type:"multiple_choice", text:"Which organ pumps blood?", options:[{id:"a",text:"Brain"},{id:"b",text:"Lungs"},{id:"c",text:"Heart"},{id:"d",text:"Liver"}], correct:"c", marks:1, exp:"Heart pumps blood."},
        { type:"short_answer", text:"What is the capital of Pakistan?", correct:"Islamabad", marks:1, exp:"Islamabad is the capital."},
        { type:"multiple_choice", text:"Which of these is a mammal?", options:[{id:"a",text:"Shark"},{id:"b",text:"Penguin"},{id:"c",text:"Dolphin"},{id:"d",text:"Crocodile"}], correct:"c", marks:1, exp:"Dolphin is a mammal."},
        { type:"true_false", text:"The Earth is flat.", correct:"false", marks:1, exp:"False — Earth is roughly spherical."},
      ]
    },
    {
      title: "Mathematics Basics — Grade 7",
      description: "Demo quiz • Arithmetic, fractions and geometry. (Demo Data)",
      subject: "Mathematics", grade: "Class 7", instructions: "Show your working on paper. Time limit 15 minutes.", time_limit: 15, passing: 60, code: "MATH01", status: "published",
      questions: [
        { type:"multiple_choice", text:"What is 15 × 12?", options:[{id:"a",text:"150"},{id:"b",text:"180"},{id:"c",text:"175"},{id:"d",text:"165"}], correct:"b", marks:2, exp:"15×12=180"},
        { type:"multiple_choice", text:"What is 3/4 of 100?", options:[{id:"a",text:"25"},{id:"b",text:"50"},{id:"c",text:"75"},{id:"d",text:"80"}], correct:"c", marks:1, exp:"75"},
        { type:"true_false", text:"A triangle has 4 sides.", correct:"false", marks:1, exp:"Triangle has 3 sides."},
        { type:"short_answer", text:"What is the square root of 64?", correct:"8", marks:1, exp:"8×8=64"},
        { type:"multiple_choice", text:"Which is the largest: 0.5, 0.75, 0.25?", options:[{id:"a",text:"0.5"},{id:"b",text:"0.75"},{id:"c",text:"0.25"},{id:"d",text:"All equal"}], correct:"b", marks:1, exp:"0.75 is largest"},
      ]
    },
    {
      title: "English Grammar — Tenses (Demo)",
      description: "Demo draft • Not yet published. Test draft functionality.",
      subject: "English", grade: "Class 8", instructions: "Choose the correct tense.", time_limit: null, passing: 50, code: null, status: "draft",
      questions: [
        { type:"multiple_choice", text:"She ___ to school every day.", options:[{id:"a",text:"go"},{id:"b",text:"goes"},{id:"c",text:"going"},{id:"d",text:"gone"}], correct:"b", marks:1, exp:"She goes — present simple"},
        { type:"true_false", text:"Present perfect uses 'have/has' + past participle.", correct:"true", marks:1, exp:"True"},
        { type:"short_answer", text:"Fill: I ___ (be) happy yesterday.", correct:"was", marks:1, exp:"was"},
      ]
    }
  ];
}

export function generateId(): string { return randomBytes(12).toString("hex"); }

export async function generateQuizCode(): Promise<string> {
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code=""; for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  const db=await getDb();
  const exists=await db.prepare("SELECT id FROM quizzes WHERE code = ?").get(code);
  if(exists) return generateQuizCode();
  return code;
}

export default getDb;
