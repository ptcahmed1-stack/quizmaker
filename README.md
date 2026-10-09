# QuizMaker

Create, publish, share and analyse online quizzes. Teachers build quizzes and share a link or QR code;
students take them on any phone **without an account or app**; scores are calculated on the server and
saved to PostgreSQL; teachers see their own students' results; administrators see everything.

Built with Next.js 16 (App Router), PostgreSQL, Drizzle ORM and Tailwind CSS.

## Roles

| Role | What they can do |
|---|---|
| **Student** | Opens `/quiz/<CODE>`, enters a name (and ID / access code if required), takes the quiz, sees results according to the teacher's settings. No login. |
| **Teacher** | Creates quizzes, previews, publishes, shares link/QR, closes/reopens, duplicates, views **only their own students'** results and analytics, exports CSV. |
| **Administrator** | Everything above, plus: manage teacher accounts (add / bulk-add / suspend / delete / set password / reset link), see **every result and all teacher activity**, assign quizzes to teachers, platform settings, audit log. |

### Assigning a quiz to teachers
Admin → *All Quizzes* → open a quiz → **Assign to teachers**. Each selected teacher receives **their own copy** with
its own student link and QR code, so each teacher only sees their own students' results while you see the combined
results. Optionally publish immediately and lock the questions so every class sits the same paper.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public base URL for share links, QR codes and reset links when behind a proxy. |
| `ADMIN_EMAILS` | Recommended | Comma-separated emails that automatically become administrators on sign-up/login. |
| `ADMIN_PASSWORD` | Recommended | Initial password for the built-in admin account `admin@quizmaker.app` (default `admin1234` — **change it**). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | Email password-reset links. Without them, administrators set passwords or generate reset links in the admin panel. |

See `.env.example`.

## Run locally

```bash
npm install
cp .env.example .env            # set DATABASE_URL
npx drizzle-kit push            # create the tables
npm run dev                     # http://localhost:3000
```

Sign in at `/login`:

* **Admin:** `admin@quizmaker.app` / `admin1234` (created automatically; change the password in *My Account & Password*)
* **Demo teacher:** the "Log in as demo teacher" button creates three clearly-labelled `[Demo]` quizzes with sample results.

## Deploy to a public URL

1. Provision a PostgreSQL database (Neon, Supabase, Railway, RDS, …).
2. Set `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS` and `ADMIN_PASSWORD` on your host (Vercel, Railway, Render, Fly, a VPS, …).
3. Create the tables once:
   `DATABASE_URL=postgresql://… npx drizzle-kit push --config=drizzle.production.config.ts`
4. Build and start: `npm run build && npm run start`.
5. Log in as the admin, **change the default password**, then add teachers.

`GET /api/health` returns `{ "ok": true }` when the app can reach the database (use it for health checks).

## Security model

* Passwords are hashed with scrypt; sessions are random tokens stored hashed in the database and sent in `httpOnly` cookies.
* Login, password-reset and quiz-start endpoints are rate-limited (in memory, per instance).
* **Answer keys never reach the student's browser.** The server stores the key, scores every submission, and validates the
  attempt token, quiz status, attempt limits, access code and time limit (late submissions are flagged).
* Every teacher query is scoped by `teacher_id`; cross-teacher reads and writes are rejected. Admin routes require the admin role.
* Suspended teachers are logged out immediately and their public quizzes become unavailable.
* Every administrative action is recorded in the **Audit log**; teacher actions and student submissions appear in **Teacher Activity**.

## Useful scripts

```bash
npm run build        # production build
npm run start        # start production server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```
