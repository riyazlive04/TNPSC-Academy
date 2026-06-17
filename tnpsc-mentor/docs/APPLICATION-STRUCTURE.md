# TNPSC Mentor — Application Structure, Workflow & Details

A reference guide to how the TNPSC Mentor exam-prep web app is organised, how data
flows through it, and how its main user journeys work end to end.

> Companion docs: [`README.md`](../README.md) (quick start), [`PROJECT-OVERVIEW.md`](PROJECT-OVERVIEW.md),
> [`HANDOVER-DEVELOPER.md`](HANDOVER-DEVELOPER.md), and [`DEPLOY-VERCEL-RENDER.md`](DEPLOY-VERCEL-RENDER.md).

---

## 1. What the app is

A production-grade, **bilingual (English / Tamil)** TNPSC exam-preparation single-page
app. It provides:

- Authentication and per-user profiles.
- A multi-category, timed **test engine** with server-side grading.
- A proctored, OMR-style **mock-test engine** for full group-exam patterns.
- **Spaced revision** (SRS), **bookmarks**, **streaks/gamification**, and **analytics/insights**.
- Gated **PDF explanation** downloads.
- An **admin** question-bank manager and a **superadmin** platform console.

---

## 2. Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript (SPA) |
| Routing | React Router v6 (lazy/code-split routes) |
| State | Zustand (with `persist` for auth, quiz, language) |
| Styling | Tailwind CSS (strict TNPSC palette — navy `#0D47A1`, yellow `#FFC107`) |
| PDFs | jsPDF |
| Icons | lucide-react |
| Fonts | Rajdhani (headings), Inter (body), Noto Sans Tamil (Tamil) |
| Backend | Express API (TypeScript, ESM) — the **only** client that talks to Supabase |
| Data/Auth | Supabase (Postgres + Auth), reached server-side only |
| Tests | Vitest |

---

## 3. Three-tier architecture

The browser **never holds Supabase keys**. The SPA talks only to the Express API,
which holds the Supabase service credentials and is the sole gateway to the database.

```
┌────────────────────┐     HTTPS / Bearer JWT     ┌────────────────────┐     service-role     ┌──────────────────┐
│  SPA (React/Vite)  │  ───────────────────────►  │  Express API       │  ─────────────────►  │  Supabase        │
│  src/              │  ◄───────────────────────  │  server/           │  ◄─────────────────  │  Postgres + Auth │
│  VITE_API_URL only │      JSON responses        │  holds all secrets │   RPCs / SQL / RLS   │  Storage         │
└────────────────────┘                            └────────────────────┘                       └──────────────────┘
```

- The frontend needs a **single env var**: `VITE_API_URL`.
- All Supabase credentials (URL, anon key, **service-role key**) live exclusively in
  the server environment (`server/.env`).
- Auth uses **Authorization: Bearer** access tokens (no cookies), with transparent
  refresh-token rotation handled in [`src/lib/api.ts`](../src/lib/api.ts).

---

## 4. Repository layout

The app lives in `TNPSC-Academy/tnpsc-mentor/`. Surrounding folders in the repo root
(`AllYears/`, `pyq_all/`, `rewritten/`, `solutions/`, `by_topic/`, `history/`, …) hold
**raw question-bank source content** used by the import scripts.

```
tnpsc-mentor/
├── src/                  # React SPA (frontend)
│   ├── App.tsx           # Route table (public + protected) + lazy loading
│   ├── main.tsx          # React/Router bootstrap
│   ├── pages/            # One component per route (~30 pages)
│   ├── components/       # Reusable UI, grouped by domain
│   ├── hooks/            # useAuth, useQuiz, useStartTest, useProctoring
│   ├── store/            # Zustand stores (auth, quiz, language, progress, toast)
│   ├── lib/              # API client + domain logic (grading helpers, SRS, PDF, i18n…)
│   ├── types/            # Shared domain types + Match-question parser
│   └── index.css         # Tailwind layers
├── server/               # Express API (backend)
│   ├── src/index.ts      # App entry: middleware, rate limits, route mounting
│   ├── src/config.ts     # Env config + CORS origin allow-list
│   ├── src/supabase.ts   # Supabase service-role client
│   ├── src/middleware/   # auth.ts (Bearer verification, role gates)
│   ├── src/routes/       # auth, questions, tests, reviews, bookmarks,
│   │                     #   profile, analytics, admin, superadmin, feedback
│   ├── *.mjs             # One-off import/migration/maintenance scripts
│   └── run-migration.mjs # Runs SQL via the direct pg pooler (DDL)
├── supabase/             # SQL: schema, secure RPCs, feature migrations
├── scrapers/             # Python content scrapers (PYQ, current affairs, aptitude)
├── docs/                 # This file + handover/deploy/import docs
├── public/               # Static assets
└── dist/                 # Production build output
```

---

## 5. Frontend structure

### 5.1 Routing ([`src/App.tsx`](../src/App.tsx))

- **Public routes:** `/login`, `/register`, `/forgot-password`.
- **Root `/`** is auth-aware: logged-in users → `/test-arena`, otherwise → `/login`.
- **Protected routes** are declared in a single `PROTECTED_ROUTES` array and wrapped in
  `<ProtectedRoute>`. Some carry a `role` (`admin` / `superadmin`) for role-gated access.
- Every page is **lazy-loaded** (`React.lazy`) so each route ships as its own chunk —
  the main lever on first-load weight.

Key protected routes:

| Path | Page | Purpose |
|------|------|---------|
| `/test-arena` | TestArenaPage | Home / category picker |
| `/test-arena/pyq` + `/pyq/history` | Previous-Year banks | PYQ by group/subject; History by period |
| `/test-arena/subjects` | SubjectPracticePage | Subject → Topic → Question-Type flow |
| `/test-arena/current-affairs` | CurrentAffairsPage | CA by month / topic |
| `/test-arena/aptitude` | AptitudePage | Numerics / reasoning |
| `/test-arena/samacheer` | SamacheerPage | (hidden from dashboard, route kept) |
| `/quiz/instructions` → `/quiz` | Quiz engine | Timed practice test |
| `/mock` → `/mock/instructions` → `/mock/quiz` | Mock engine | Proctored OMR exam |
| `/result` | ResultPage | Score, review, gated PDF |
| `/revision` | RevisionPage | Spaced-repetition due queue |
| `/bookmarks` | BookmarksPage | Saved questions |
| `/daily` | DailyPage | Daily Current-Affairs challenge |
| `/insights` | InsightsPage | Performance analytics |
| `/profile` | ProfilePage | Profile, exam date, daily goal |
| `/admin/questions` | AdminQuestionsPage | Question-bank manager (admin) |
| `/superadmin` | SuperAdminPage | Platform console (superadmin) |

### 5.2 State (Zustand stores — [`src/store/`](../src/store/))

- **`authStore`** — session bootstrap (`init`), current `user`/`profile`, `loading`.
- **`quizStore`** (persisted) — the active test: config, questions, current index,
  answers, flags, timer. Persisted so an in-progress test survives a refresh; remaining
  time is recomputed from `startedAt` so a closed tab doesn't pause the clock.
- **`languageStore`** (persisted) — display language (`en` / `ta` / `both`).
- **`progressStore`** — streaks / gamification progress.
- **`toastStore`** — transient notifications.

### 5.3 Components ([`src/components/`](../src/components/))

Grouped by domain: `Auth/`, `Layout/` (AppLayout, PickerPage, **ProtectedRoute**),
`Quiz/` (QuestionCard, OMR bubbles/options, ScreenGuard, WorkedSolution, ResultCard,
dialogs), `Admin/` (QuestionEditor, BulkImportPanel), `Feedback/`, plus shared `UI/`
primitives (Timer, ProgressBar, PillButton, Toaster, …) and flavour pieces
(Mascot, RewardOverlay, StreakCalendar).

### 5.4 Domain logic ([`src/lib/`](../src/lib/))

The **API client** ([`api.ts`](../src/lib/api.ts)) is the typed surface for every
backend call (auth, questions, tests, reviews, bookmarks, profile, analytics, admin,
superadmin, feedback). It owns token storage and the single-flight refresh-on-401.

Other notable modules: `fetchQuestions.ts` / `submitTest.ts` / `abandonTest.ts` (test
lifecycle), `srs.ts` (spaced-repetition scheduling), `pdfGenerator.ts` (explanation PDF),
`i18n.ts` (UI strings), `achievements.ts` / `game.ts` / `habit.ts` (gamification),
`proctor.ts` (violation rules), `analytics.ts`, `bookmarks.ts`, `aptitudeSolution.ts`,
and `constants.ts` / `features.ts`.

---

## 6. Backend structure ([`server/`](../server/))

[`server/src/index.ts`](../server/src/index.ts) wires it together:

- **Middleware:** `helmet`, `cors` (origin allow-list supporting `*` wildcards for Vercel
  previews; no `credentials` since auth is Bearer-based), `express.json({ limit: '2mb' })`,
  and `trust proxy = 1` (for correct client IP behind Render's edge).
- **Rate limits:** 300 req/min on `/api`, a stricter 30 req/min on `/api/auth`.
- **Health check:** `GET /api/health`.

### API route groups

| Mount | Responsibility |
|-------|----------------|
| `/api/auth` | login, register, refresh, forgot-password, `me` |
| `/api/questions` | quiz pool, topics, subjects, qtype counts, history periods, mock-group, subject-mock |
| `/api/tests` | submit (grades + persists), abandon |
| `/api/reviews` | SRS: due, count, enqueue, grade |
| `/api/bookmarks` | list ids, list questions, add, remove |
| `/api/profile` | get/update profile, percentile, activity (read + record) |
| `/api/analytics` | sessions + answers for the Insights page |
| `/api/admin` | list/upsert/delete/bulk-insert questions (admin role) |
| `/api/superadmin` | metrics, user list, set role, feedback inbox (superadmin role) |
| `/api/feedback` | student-submitted rating/message |

Auth and role gating live in [`server/src/middleware/auth.ts`](../server/src/middleware/auth.ts):
the access token is verified against Supabase, the profile/role loaded, and admin/superadmin
routes rejected for insufficient roles.

---

## 7. Data model (core tables)

Defined in [`supabase/schema.sql`](../supabase/schema.sql) and extended by the feature
migrations in [`supabase/`](../supabase/).

- **`questions`** — the bank. Categorised by `category` (`pyq` | `samacheer` |
  `current_affairs` | `aptitude` | `outer` | `subject`) with category-specific columns
  (`group_type`, `year`, `standard`, `ca_month`/`ca_type`/`ca_topic`, `aptitude_type`,
  `subject`/`unit`/`topic`/`question_type`). Holds bilingual text (`*_ta`), four options,
  `correct_answer`, `explanation`, per-wrong-option `why_wrong`, `difficulty`, optional
  `images[]`, and provenance (`source_tag`, `source_url`).
- **`test_sessions`** — one row per attempt: scope, totals, `score_percentage`,
  `passed_80_percent`, `pdf_unlocked`, timing, and `status`
  (`in_progress` | `completed` | `abandoned`).
- **`test_answers`** — per-question selection, correctness, time spent, flag.
- **`profiles`** — name, email, phone, target group, **`role`** (`user` | `admin` |
  `superadmin`), `exam_date`, `daily_goal`. Created by the `handle_new_user` trigger.
- **`review_items`** — SRS queue (spaced revision scheduling).
- **`daily_activity`** — per-day questions/tests counts (streaks & insights).
- **`app_feedback`** — student feedback (rating, message, page).

### Key categories / banks (current state)

- **`pyq`** — Previous-Year Questions (reloaded 2026-06-14, ~980 rows, 2019–25).
- **`subject`** — the rewritten Subject Practice bank (Subject → Topic → Question-Type).
- **`outer`** — admin-only subject bank (~28.6k rows), excluded from student tests.
- Legacy `samacheer` / `aptitude` banks were moved to `questions_backup` during the
  2026-06-14 restructure (Samacheer route retained for direct/admin access).

---

## 8. Security model

This is the heart of the design — the client can never see the answer key during a test.

1. **No keys in the browser.** Supabase is never imported client-side; the SPA only
   knows `VITE_API_URL`.
2. **Column-level grants** ([`supabase/secure.sql`](../supabase/secure.sql)) hide
   `correct_answer` / `explanation` columns from the client role.
3. **SECURITY DEFINER RPCs** are the only way to fetch quiz questions, grade a
   submission, run revision, and read the admin bank. The quiz pool is delivered with
   answer/explanation fields **stripped**.
4. **Server-side grading.** Scores are computed by `submit_test` on the server, so they
   can't be forged from the client. `is_correct` is unknown to the client until grading.
5. **Gated explanations.** Correct answers + explanations are returned only once the
   attendance gate is met (see §9.3).
6. **Role enforcement** happens both in API middleware and in the DB (`is_admin()` is
   widened so a superadmin inherits admin rights).

> **Required setup:** `secure.sql` must be run after `schema.sql`. Until it does, the
> quiz/submit/revision flows won't work (they call these RPCs).

---

## 9. Key workflows

### 9.1 Authentication

1. User submits login/register → `api.auth.*` → `/api/auth/*`.
2. Server authenticates against Supabase, returns `{ access_token, refresh_token, user, profile }`.
3. Tokens are stored in `localStorage`; `authStore.init()` bootstraps the session on app mount.
4. Every authenticated request attaches `Authorization: Bearer <access>`. On a `401`, the
   API client performs a **single shared refresh** and retries transparently; if refresh
   fails, tokens are cleared and the user is routed to `/login`.

### 9.2 Taking a practice test

```
Test Arena → pick category → pick subject/topic/filters → Quiz Instructions
   → fetch question pool (answers stripped)  [POST /api/questions/quiz]
   → quizStore.initSession(config, questions)   (timer + persisted state)
   → answer / flag / navigate (state persisted across refresh)
   → submit  [POST /api/tests/submit]  → server grades + writes session/answers
   → Result page (score, review, gated PDF)
```

- **Timing:** default `45s × questions` (configurable per mode); the timer survives a
  refresh by recomputing from `startedAt`.
- **Abandon:** leaving mid-test calls `/api/tests/abandon`, recording an `abandoned` session.

### 9.3 Grading & the explanation gate

- The server computes `attempted`, `correct`, `score_percentage`, and `passed_80`.
- The **attendance gate** decides whether explanations/correct answers are returned in the
  graded result and whether the **explanation PDF** unlocks (`pdf_unlocked`).
- Per-question feedback includes the correct letter, the explanation (EN/TA), and
  per-wrong-option `why_wrong` rationale — surfaced in the Result/WorkedSolution UI.

### 9.4 Mock tests (proctored OMR engine)

- Two kinds: a **full group-exam** (2024/2025 blueprint, questions pooled per subject
  slot via `/api/questions/mock-group`) and a **subject/topic drill** with optional
  difficulty (`/api/questions/subject-mock`).
- Runs through a dedicated engine: fullscreen, OMR-style question palette/bubbles,
  fixed duration, optional **negative marking**, and **violation/proctoring** tracking
  (`useProctoring` + `proctor.ts` + `ScreenGuard`).

### 9.5 Spaced revision (SRS)

- Wrong/bookmarked questions are enqueued into `review_items`.
- `/revision` pulls the **due** queue (`/api/reviews/due`), the user grades each, and
  the server reschedules via the SRS algorithm (`/api/reviews/grade`).

### 9.6 Bookmarks, daily challenge & gamification

- **Bookmarks:** save/remove questions, reviewable on `/bookmarks`.
- **Daily challenge:** a Current-Affairs drill on `/daily`; completing it grants the
  daily reward and feeds the **streak calendar** (`daily_activity`).
- **Gamification:** achievements/badges, reward overlays, and streaks
  (`achievements.ts`, `game.ts`, `habit.ts`, `progressStore`).

### 9.7 Admin & superadmin

- **Admin** (`/admin/questions`) follows the same selection flow but lands on the full
  question bank **with answers/explanations revealed**, plus search, inline editing
  (`QuestionEditor`), and **bulk import** (`BulkImportPanel`). See
  [`IMPORT-FORMAT.md`](IMPORT-FORMAT.md).
- **Superadmin** (`/superadmin`) adds a platform console: metrics (users, activity,
  tests, feedback, signups), **user management** (search + set role), and a **feedback
  inbox**.

---

## 10. Content pipeline

Raw content (repo-root folders + `scrapers/`) is normalised and loaded into the
`questions` table:

- **Scrapers** (`scrapers/*.py`) produce JSON for PYQ, current affairs, and aptitude.
- **Importers** (`server/import_*.mjs`, `load-*.mjs`) bulk-insert into Supabase using the
  service-role client.
- **Schema/DDL changes** run through [`server/run-migration.mjs`](../server/run-migration.mjs)
  (direct pg pooler), applying the SQL files in [`supabase/`](../supabase/).

---

## 11. Environment & configuration

**Frontend** (`tnpsc-mentor/.env`):

```
VITE_API_URL=http://localhost:4000      # the only required frontend var
```

**Backend** (`server/.env`):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...           # server-only — never shipped to the browser
CORS_ORIGIN=http://localhost:5173       # comma-separated; supports * wildcards
```

If `VITE_API_URL` is unset, the SPA runs in **UI-preview mode** (no backend, no auth gate).

---

## 12. Local development

```bash
# Frontend
cd tnpsc-mentor
npm install
cp .env.example .env          # set VITE_API_URL
npm run dev                   # http://localhost:5173
npm run build                 # tsc + vite build → dist/
npm test                      # vitest

# Backend (separate terminal)
cd server
npm install
cp .env.example .env          # set Supabase creds + CORS_ORIGIN
npm run dev                   # http://localhost:4000
```

Database: run [`supabase/schema.sql`](../supabase/schema.sql) then
[`supabase/secure.sql`](../supabase/secure.sql) (required), followed by the relevant
feature migrations in [`supabase/`](../supabase/).

---

## 13. Deployment

- **Frontend → Vercel** (or Hostinger static): build to `dist/`, set `VITE_API_URL` to the
  API URL. See [`vercel.json`](../vercel.json) / [`DEPLOY-HOSTINGER.md`](DEPLOY-HOSTINGER.md).
- **Backend → Render:** deploy `server/` via [`render.yaml`](../render.yaml); set Supabase
  creds + `CORS_ORIGIN` there.
- Full walkthrough: [`DEPLOY-VERCEL-RENDER.md`](DEPLOY-VERCEL-RENDER.md).

---

## 14. Request lifecycle at a glance

```
User action (React page)
   → store/hook (useStartTest, useQuiz, useAuth)
      → api.* (src/lib/api.ts)  — attach Bearer, refresh-on-401
         → Express route (server/src/routes/*)
            → auth middleware (verify token + role)
               → Supabase RPC / query (service role, RLS-aware)
                  → answers stripped / grading enforced server-side
         ← JSON response
      ← typed result
   ← UI update (Zustand state → render)
```
