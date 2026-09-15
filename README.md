# QuizMaker — Production-Ready Web App for Teachers

**Create a quiz → Publish → Get a unique link & QR code → Students take it on their phone (no app, no account) → Results saved securely → Teacher views analytics & exports CSV.**

Built as a **real full-stack web application** (not a mockup) with: real database persistence, secure teacher authentication, server-side scoring, public student URLs, private teacher data, mobile-first student UI, QR sharing, timers, analytics, and CSV export.

---

## 🔗 Live Preview (this workspace)

Dev server is running at:

- **Local:** `http://localhost:3000`
- **Public preview (shareable):** `https://3000-<your-sandbox-id>.e2b.app` — open in your browser to test teacher → student flow live. Replace `<your-sandbox-id>` with your E2B sandbox ID shown in the preview panel. Or open the **Live Preview** tab in Arena.

> Students can open any `/quiz/[CODE]` link directly on their phones. Example published demo quiz: **`/quiz/DEMO01`** and **`/quiz/MATH01`**.

---

## 🧑‍🏫 Demo Teacher Account

A demo teacher is auto-seeded on first run (see `src/lib/db.ts`):

- **Email:** `demo@quizmaker.com`
- **Password:** `demo123`

Or create your own via **Sign up** — teacher data is isolated per account.

**Demo published quizzes:**
- `DEMO01` — General Science — 10 questions, 10 min, 2 submissions already
- `MATH01` — Mathematics Basics — 5 questions, 15 min
- Draft: *English Grammar — Tenses* (shows draft flow)

---

## ✅ Full Workflow (tested end-to-end)

1. Teacher **Signs up / Logs in** → private dashboard (`/dashboard`)
2. **Creates quiz** (`/dashboard/create`): title, description, subject, grade, instructions, time limit, passing %, status (draft/published/closed)
3. **Question builder**: Multiple Choice (4 options default, correct answer, marks, explanation), True/False, Short Answer — add/edit/delete/duplicate/reorder, autosave, total questions & marks shown
4. **Preview** (student view, no submission recorded)
5. **Settings** per-quiz: require name/ID, anonymous, attempts (single/multiple + max), randomize questions/options, one-at-a-time + navigation, result visibility (score/correct/explanations/hide until released), access code, start/end window
6. **Publish** → generates unique 6-char code `ABC123XYZ` → public URL `/quiz/[CODE]` from DB (not fake)
7. **Share modal**: shows `https://yourdomain.com/quiz/CODE`, **Copy Link** (clipboard), **Open Quiz**, **Web Share API** (mobile), **QR Code** (points to real URL) with Download/Print
8. Student opens link on phone → sees title/instructions/questions count/time limit → enters name / ID (if required) → **Start Quiz** (no account)
9. **Mobile-first quiz UI**: large buttons, progress `Question 5 of 20`, `████████████░░░░`, Previous/Next, answered indicator, confirmation before submit, `beforeunload` warning
10. **Timer** (if enabled): live countdown, low-time warning (amber/red), auto-submit at 0, server validates `startedAt` + grace
11. **Secure submission**: answers stored locally for that session, connection warning + reconnect, final POST to `/api/submissions` → **server scores** (never trusts client), stores quizId, name, ID, answers, score, %, pass/fail, time taken, attempt #
12. **Results for student**: per teacher settings, shows `17 / 20  85% PASSED` with correct/incorrect/explanations or hides answer key if disabled
13. **Teacher Results Dashboard** (`/dashboard/quizzes/[id]/results` or `/dashboard/results`): attempts, avg/high/low, pass rate, per-question analytics (correct rate %, correct/incorrect counts, most selected incorrect, distribution), table (Student | Score | % | Time | Status | Submitted) with detail view (question-by-question correctness)
14. **Export CSV**: `Student Name, Student ID, Score, Percentage, Pass/Fail, Time Taken, Submission Date`
15. **Manage**: Edit, Preview, Publish, Copy Link, QR, Results, Duplicate (new ID & URL), Close/Reopen (closed shows *“This quiz is currently closed.”*), Delete (confirm)

---

## 🏗 Technology & Architecture

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js 16 (App Router) + React 19 + TypeScript** | Production React stack, server components, API routes, file-based routing, deployable to Vercel |
| **Styling** | **Tailwind CSS 4** | Responsive, mobile-first, modern SaaS palette (indigo/slate/emerald), no heavy UI lib |
| **Database** | **SQLite + `better-sqlite3` (WAL mode)** with fallback to file `data.db` | Real persistence, relational (`users → quizzes → questions`, `submissions` per quiz), proper indexes, foreign keys. File lives at `process.cwd()/data.db` (under `/home/user/quizmaker/data.db` in this workspace) — persisted across restarts. Easy to swap to Postgres/Turso/Neon for scale. |
| **Auth** | **`bcryptjs` + `jose` (JWT HS256) + httpOnly `token` cookie** | Sign up / login / logout, 7-day session, protected `/dashboard*` (layout redirect), row-level isolation (`teacher_id` check on every quiz query), never exposes other teacher's data |
| **QR** | **`qrcode` (npm) → `toDataURL`** | Real QR pointing to `window.location.origin/quiz/CODE`, downloadable PNG, printable |
| **Security** | Server-side scoring only; public API strips `correct_answer`; teacher APIs require auth; student cannot access `/dashboard`; timing validated server-side | Validates quizId/status/attempts/accessCode/startEnd/window before scoring |
| **Icons** | `lucide-react` (minimal) | No animation bloat |
| **Build** | `npm run build` → static + dynamic routes, `next start` | Deployable to public URL |

### Database Schema (relational)

```sql
users(id PK, email UNIQUE, password_hash, name, created_at)
quizzes(id PK, teacher_id FK→users, title, description, subject, grade, instructions,
        time_limit INT, passing_percentage INT, status ENUM('draft','published','closed'),
        code UNIQUE TEXT(6), settings_json TEXT, created_at, updated_at, published_at)
questions(id PK, quiz_id FK→quizzes, type ENUM('multiple_choice','true_false','short_answer'),
          text, options_json TEXT, correct_answer TEXT, marks INT, explanation TEXT, order_index INT)
submissions(id PK, quiz_id FK→quizzes, student_name TEXT, student_id TEXT,
            answers_json TEXT, score INT, total_marks INT, percentage REAL, passed BOOLEAN,
            time_taken INT, attempt_number INT, submitted_at DATETIME)
indexes: quizzes(teacher_id), quizzes(code), questions(quiz_id), submissions(quiz_id)
```

`settings_json` stores: `requireName`, `requireStudentId`, `allowAnonymous`, `attempts`, `maxAttempts`, `randomizeQuestions`, `randomizeOptions`, `showOneAtATime`, `allowNavigation`, `showScoreImmediately`, `showCorrectAnswers`, `showExplanations`, `hideUntilReleased`, `accessCode`, `startAt`, `endAt`.

---

## 🚀 Local Development

```bash
cd /home/user/quizmaker  # or your clone
npm install
npm run dev -- -H 0.0.0.0 -p 3000
# open http://localhost:3000
```

Seed runs automatically if `users` table empty (creates `demo@quizmaker.com` + 3 demo quizzes with 2 submissions).

**Build & start (production):**
```bash
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

**Test the workflow via curl (optional):**
```bash
# login as demo
curl -c cookie.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@quizmaker.com","password":"demo123"}'
# list quizzes
curl -b cookie.txt http://localhost:3000/api/quizzes
# public student fetch (no auth) — note correct_answer is NOT returned
curl http://localhost:3000/api/quizzes/by-code/DEMO01
# student submit (server scores)
curl -X POST http://localhost:3000/api/submissions -H "Content-Type: application/json" -d '{"quizCode":"DEMO01","student_name":"Ali","student_id":"08","answers":[{"questionId":"...","answer":"a"}],"time_taken":95}'
```

---

## 🔐 Environment Variables

Create `.env` (or set in host dashboard):

```env
# Required in production — random 32+ char string
JWT_SECRET=change-me-to-a-long-random-string-in-production

# Optional — defaults to ./data.db (cwd). For Docker/Vercel use persistent volume or external DB
DATABASE_PATH=/data/data.db

# Next.js
NODE_ENV=production
```

For **Vercel / serverless**, SQLite file is ephemeral. Instead:
- Switch `src/lib/db.ts` to use **Turso (SQLite over HTTP)**, **Neon/Supabase Postgres** (via `pg` or Prisma), or **Vercel Postgres**.
- Keep same schema; only swap the `getDb()` driver. All API routes remain because they use raw SQL via `prepare()` — abstraction is minimal.

Example `.env.example` already in repo.

---

## 🌐 Deployment to Public URL

### Option A — Vercel (recommended for Next.js)
1. Push this folder to GitHub
2. Import in Vercel — it auto-detects `next build`
3. Set env var `JWT_SECRET`
4. **Database**: add Vercel Postgres or Turso, then replace `better-sqlite3` driver (or use `libSQL`). For quick demo, Vercel's `/tmp` is not persistent — use external DB for real classrooms.
5. Deploy → share `https://your-app.vercel.app/quiz/ABC123` with students

### Option B — Any Node host with persistent disk (Render, Railway, Fly.io, Coolify, self-VPS)
1. `git clone` + `npm ci` + `npm run build`
2. Ensure disk mount for `DATABASE_PATH` (e.g., `/data/data.db`)
3. Set `JWT_SECRET` env var
4. `npm start -- -H 0.0.0.0 -p 3000` (or `PORT` env)
5. Put behind HTTPS (Caddy/Nginx/Cloudflare) → public link ready

### Option C — Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV DATABASE_PATH=/data/data.db
VOLUME /data
EXPOSE 3000
CMD ["npm","start","--","-H","0.0.0.0","-p","3000"]
```

This workspace preview is already **online** via the E2B proxy: `https://3000-<sandboxId>.e2b.app` — send a `/quiz/DEMO01` link to a phone on the same network to test.

---

## 📱 Mobile & Accessibility

- Student interface is **mobile-first**: large 48px+ tap targets, 16px+ typography, generous spacing, progress bar, sticky timer, thumb-reachable Previous/Next/Submit, no hover-only interactions.
- Works on Android Chrome, iPhone Safari, tablets, laptops, desktop.
- Teacher dashboard: sidebar on desktop, compact top nav + hamburger on mobile.
- Accessibility: semantic labels, `Label` + `Input` with `htmlFor`, focus rings (`focus:ring-indigo-500`), high contrast (slate-900 on white, indigo-600 primary), not color-only for correctness (icons + text + badges).
- Performance: no heavy deps, student quiz page ships no dashboard code, lazy QR generation, WAL SQLite, no unnecessary fetches.

---

## 🧪 Security Highlights

- **Never sends answer key to client before submit**: `GET /api/quizzes/by-code/[code]` selects only `id,text,options,marks` — `correct_answer` omitted.
- **Server scores**: compares each answer server-side (case-insensitive for short answer, id-or-text for MC), computes `score/total/percentage/passed`.
- **Attempt limits** enforced server-side (counts prior submissions by normalized name+ID).
- **Status checks**: `draft`/`closed` blocked, `startAt`/`endAt` windows checked, `accessCode` validated.
- **Teacher isolation**: every quiz query adds `WHERE teacher_id = ?` — 403 if not owner.
- **Timing**: `time_taken` derived from `startedAt`; server allows 10s grace (client timer manipulation cannot gain extra time beyond grace).
- **Row-level safety**: cookies httpOnly, SameSite Lax, Secure in prod, 7-day JWT.

---

## 📂 Project Structure

```
src/
  app/
    page.tsx                       # Landing (hero, steps, features)
    layout.tsx                     # Root + font
    globals.css                    # Tailwind
    auth/login|signup/page.tsx     # Teacher auth
    dashboard/
      layout.tsx                   # Sidebar + auth guard
      page.tsx                     # Stats (total/published/attempts/avg) + recent
      quizzes/page.tsx             # My Quizzes (filter, duplicate/close/delete, copy link)
      quizzes/[id]/edit/page.tsx   # QuizEditor (reuse)
      quizzes/[id]/results/page.tsx # Analytics + submissions table + CSV
      quizzes/[id]/results/[submissionId]/page.tsx # Student detail
      results/page.tsx             # All results (quiz selector)
      create/page.tsx              # New quiz
      settings/page.tsx            # Profile
    quiz/[code]/page.tsx           # STUDENT: landing → taking → results (mobile-first)
    api/
      auth/signup|login|logout|me
      quizzes (GET/POST), [id] (GET/PUT/DELETE), [id]/publish, duplicate, close, [id]/submissions, by-code/[code]
      submissions (POST)
  lib/
    db.ts                          # SQLite + seed demo data
    auth.ts                        # bcrypt, jose, getCurrentUser
    utils.ts
  components/
    ui.tsx                         # Button/Input/Textarea/Card/Badge
    QuizEditor.tsx                 # Full question builder + settings + publish + QR
    DashboardClient.tsx            # Logout, MobileMenu
```

---

## 🛠 Troubleshooting

- **No quizzes yet?** → Seed creates 3 demo quizzes for `demo@quizmaker.com`. Log in as demo or create your own and Publish.
- **Quiz link shows “closed”?** → Teacher closed it; reopen from My Quizzes or edit → status Published.
- **Student submit says “Maximum attempts reached”?** → Settings enforce single attempt; student must use different name/ID or teacher sets multiple.
- **Copy Link not working?** → Requires HTTPS or localhost + clipboard permission. Manual copy fallback: select the code box.
- **QR not showing?** → Generated via `qrcode` toDataURL — requires published quiz with code; ensure `npm install qrcode`.
- **Database locked?** → WAL mode enabled; for high concurrency use Postgres.

---

## 📄 License

MIT — free for schools.

---

**Made for real classrooms in Islamabad and everywhere — students just need a link, no app.**
