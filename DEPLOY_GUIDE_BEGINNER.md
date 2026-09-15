# QuizMaker — FREE Deployment Guide for Beginners (No Hosting Knowledge Needed)

This guide gets your QuizMaker live on a **real public link** like `https://your-quiz.vercel.app/quiz/DEMO01` that you can share on WhatsApp with students.

**Time: 8-12 minutes | Cost: Rs. 0 | No credit card needed**

---

## First: What is "Hosting"? (30 seconds)

- Your QuizMaker is now running **only on this temporary workspace** (like a computer that will shut down in a few hours).
- "Hosting" = putting it on a **permanent computer on the internet** (like Vercel) so it stays online 24/7 and anyone with the link can open it.
- You will get a free link like `https://quizmaker-xxxxx.vercel.app` — students open it, no app needed.

You need **2 free accounts** (takes 2 minutes):
1.  **GitHub** (to store your code) — like Google Drive for code
2.  **Vercel** (to host your website) — like free hosting for Next.js apps

Both are free forever for classrooms.

---

## OPTION 1: Vercel — RECOMMENDED (Best for Next.js, stays free forever, students get fast link)

### Step 0 — Download your QuizMaker code as ZIP (1 minute)

In this Arena workspace:

1. Look at the left/file panel — you see folder `quizmaker`.
2. We have prepared a ZIP for you **without heavy files**. Download it:
   - If you see a download button, click **Download** on file `quizmaker-free-deploy.zip` (we will create it below).
   - **OR** in terminal we can make it: See "Create ZIP" at bottom of this guide.

If you can't download, we can also push directly to GitHub from here — just ask me "push to my GitHub" and give your GitHub username.

---

### Step 1 — Create a GitHub account (2 minutes)

1. Go to https://github.com on your phone/laptop
2. Click **Sign up** → enter email, password, username (e.g., `ayesha-teacher`)
3. Verify email (check inbox)
4. Done. Keep it open.

### Step 2 — Upload your code to GitHub (3 minutes, no commands needed)

**Easiest (phone/laptop, no terminal):**

1. After logging in to GitHub, click **+** top-right → **New repository**
2. Name: `quizmaker` (any name)
3. Choose **Public** → **Create repository**
4. On the next page, click **“uploading an existing file”**
5. **Drag & Drop** the ZIP you downloaded → but **unzip it first** on your computer/phone:
   - On Windows: Right-click ZIP → Extract All
   - On Android: Use Files app → tap ZIP → Extract
   - On iPhone: Tap ZIP → Preview → Share → Save to Files
6. **Important:** After extracting, open the folder `quizmaker` — select **ALL files inside it** (not the outer folder) and drag them to GitHub upload page
7. Click **Commit changes**

You should now see files like `package.json`, `src`, `README.md` on GitHub.

> **If you hate drag-drop:** Tell me your GitHub username, I can give you exact 3 commands to push from this workspace directly.

---

### Step 3 — Create a Vercel account (1 minute)

1. Go to https://vercel.com
2. Click **Sign Up** → **Continue with GitHub** → Approve (log in with the GitHub you just made)
3. Done. No credit card asked on Hobby plan.

### Step 4 — Deploy (2 minutes, 1 click)

1. In Vercel dashboard, click **Add New... → Project**
2. You will see your `quizmaker` repository → Click **Import**
3. Vercel auto-detects Next.js — **DO NOT change** Build settings
4. Open **Environment Variables** section (click to expand):
   - Key: `JWT_SECRET`
   - Value: paste this random string (copy exactly):
     ```
     quizmaker-change-this-to-any-long-random-text-1234567890-ABCD
     ```
     > For better security, you can generate a new one at https://generate-secret.vercel.app/32 — copy and paste.
   - Click **Add**
   - Also add: Key: `DATABASE_PATH` Value: `/tmp/data.db`  → Add (temporary, see note below)
5. Click **Deploy** → Wait 2-3 minutes (you see "Building...") → **Congratulations!** → You get a link like `https://quizmaker-xyz.vercel.app`

**Open that link** — your homepage should load! 🎉

### Step 5 — Test your live quiz (1 minute)

1. Open your live link → Click **Start for free** → Sign up as teacher (use your real email)
2. **Create Quiz** → Add 2-3 questions → **Publish** → Copy the `.../quiz/ABC123` link
3. Open that quiz link on your **phone's browser** (or send to a friend on WhatsApp) → Enter name → **Start Quiz** → Submit → See result
4. Back to Vercel link → **Dashboard → Results** → See the submission!

**Share with students:** Just copy the `/quiz/CODE` link and paste in WhatsApp, SMS, Google Classroom, or show the QR code in class (students scan with phone camera).

---

### ⚠️ IMPORTANT NOTE about FREE Database (Read!)

With the simple Vercel setup above, your data (quizzes, submissions) is stored in a **temporary file** (`/tmp/data.db`) which **resets when Vercel sleeps or you redeploy**. For a small class/demo this is OK (re-create quizzes once). But for **permanent storage (so results never disappear)** you need a FREE cloud database:

**2 FREE permanent options (both stay Rs. 0):**

**A) Turso (SQLite cloud, closest to your current code) — 5 min extra:**
1. Go to https://turso.tech → Sign up with GitHub (free)
2. Create database: name `quizmaker` → Copy URL + Token
3. In Vercel → your project → Settings → Environment Variables → Add `TURSO_URL` and `TURSO_AUTH_TOKEN`
4. Tell me "convert to Turso" — I will update 1 file (`src/lib/db.ts`) for you and you just re-push to GitHub (Vercel auto-redeploys). Free tier: 9 GB, 500 DBs.

**B) Neon or Supabase (Postgres, very popular) — also free:**
- Neon: https://neon.tech (free 3 GB)
- Supabase: https://supabase.com (free 500 MB)
- Same: create → copy connection string → add as `DATABASE_URL` → I convert file for you.

**If you want me to convert NOW so your deployment is permanent from day 1, just reply:** 
> "Convert my code to Turso/Neon so it stays permanent"

I will do it in 2 minutes and give you updated ZIP — you won't need to learn SQL.

---

## OPTION 2: Render / Railway — Even Simpler If You Don't Want to Change Code (SQLite stays, no cloud DB needed)

If you find Vercel + cloud DB confusing, use **Render** or **Replit** where SQLite file persists automatically:

**Replit (easiest for beginners, no GitHub needed, runs exactly like here):**
1. Go to https://replit.com → Sign up
2. Click **Create Repl → Import from GitHub** → paste your `quizmaker` GitHub URL → Choose Node.js
3. Click **Run** → It runs `npm run dev` → You get a public link `https://quizmaker.yourname.repl.co` → **Always on** (free tier sleeps after inactivity but wakes when student opens link)
4. No env var needed except `JWT_SECRET`

**Render (also free, more permanent):**
1. https://render.com → Sign up with GitHub
2. New + → Web Service → Connect `quizmaker` repo → Build Command: `npm install && npm run build` → Start Command: `npm start -- -H 0.0.0.0 -p $PORT`
3. Add env `JWT_SECRET` → Deploy → Free link like `https://quizmaker.onrender.com`

*Downside:* Render free sleeps after 15 min (takes 30 sec to wake when student opens). Vercel is faster for students.

---

## What to do RIGHT NOW (Fastest Path, 0 Rs.)

**If you want to finish in 5 minutes and don't care if data resets after a few days:**
→ Follow **Option 1 Steps 0-5** exactly. You will be live.

**If you want it PERMANENT (recommended for real class):**
→ Follow Option 1 Steps 0-5, then reply to me "make it permanent with Turso" — I will update your code, you re-upload to GitHub (drag & drop again), Vercel auto-updates in 2 min, done. Still free.

---

## How to Share With Students After Deployment

In your live site (teacher):
- Go to **My Quizzes → Published quiz → Copy Link**
- Paste in **WhatsApp group** for class:
  > "Assalamu alaikum, open this link on your phone and take the quiz: https://your-app.vercel.app/quiz/ABC123  — Enter your name and roll number, no app needed!"
- Or click **Generate QR Code → Download** → Print and stick on classroom wall → students scan with phone camera.

---

## FAQ for Beginners (Islamabad)

**Q: Do I need to pay Vercel/GitHub?**
A: No. Both free Hobby plans are enough for 100s of students. Vercel gives 100 GB bandwidth free — a quiz is only ~50 KB, so ~2 million quiz attempts free per month. No credit card.

**Q: What is GitHub? Is it needed?**
A: It's just where Vercel reads your code from. Think of it as Drive for code. You upload once, Vercel copies and hosts.

**Q: Can I do this from my phone only?**
A: Yes, but laptop is easier for unzip/drag-drop. From phone, use GitHub mobile site → Upload files → Select files from your phone's file manager.

**Q: Will my quizzes be deleted?**
A: With simple Vercel `/tmp` setup, yes after redeploy/sleep (but you can re-publish in 10 seconds). With Turso/Neon, never.

**Q: Can students see other teacher's quizzes?**
A: No. Each teacher sees only their own. Student links work without login but cannot access dashboard.

**Q: My preview link `https://3000-...e2b.app` already works, why host?**
A: That preview dies after this workspace closes (few hours). Vercel link stays forever (until you delete).

**Q: I got stuck!**
A: Reply here with screenshot/error text and where you stuck (Step 1, 2, etc.) — I will guide next click.

---

## Create ZIP for Upload (if you couldn't download)

In this workspace terminal, run:
```bash
cd /home/user/quizmaker
zip -r ../quizmaker-free-deploy.zip . -x "node_modules/*" ".next/*" "data.db" ".git/*" "*.log"
```
Then download `../quizmaker-free-deploy.zip` from file panel → unzip → upload to GitHub as in Step 2.

---

## Need Me to Do It For You?

Just tell me:
1. Which option you want (Vercel or Replit?)
2. If you want permanent DB now (Turso/Neon) or temporary is OK
3. Your GitHub username (if you want me to give you 3 terminal commands to push automatically)

I will prepare the exact ZIP and step-by-step clicks for your phone/laptop.

**You are 10 minutes away from having a real link to send to students — you don't need to pay or learn hosting!**

