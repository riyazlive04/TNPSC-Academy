# TNPSC Mentors — Project Overview (read-me-first)

_Last updated: 2026-06-11. A single-page mental model of the whole project so you
can pick up any thread quickly._

---

## 1. What it is

A bilingual (English / Tamil) **TNPSC exam-prep web app**. Students pick an exam
group → subject/topic → take a timed, auto-graded mock test → get a results page
with the correct answer, a targeted "why your answer was wrong" note, and a
written explanation per question. Plus gamification (streaks, badges, mascot),
spaced-repetition revision, analytics, and a self-updating current-affairs feed.

**Status: feature-complete and deployment-ready.** Typecheck, production build,
and unit tests all pass on the current working tree (verified 2026-06-11).

---

## 2. Architecture at a glance

```
React 18 + Vite + TS + Tailwind   ──>   Supabase Cloud (Postgres + Auth + RLS)
  (static SPA, the only thing                    ^
   we need to deploy)                            │
                                          Python data pipeline (scrapers + AI)
                                          runs offline / via GitHub Actions cron
```

- **Frontend**: a static single-page app. Build output is `dist/` — plain static
  files, host anywhere.
- **Backend**: **Supabase Cloud** (`cwpdkhfsyujfjcwbnhdo.supabase.co`). Already
  hosted — no server for us to run. _(Note: the handover docs mention a
  self-hosted Supabase on a VPS as the original plan; the live project actually
  uses Supabase Cloud. Deployment is simpler because of this — see §6.)_
- **Data pipeline**: Python scripts in `scrapers/` that scrape question sources,
  run Claude (Batches API) to write explanations / paraphrase / translate, and
  upload to Supabase. Not part of the runtime — run on demand. A GitHub Action
  refreshes current affairs monthly.

---

## 3. The question bank (the product's core asset)

~12,700 MCQs (~10,300 unique after dedupe), **94% bilingual**. Every row has 4
options, a verified answer, an AI-written explanation, and a per-option
`why_wrong` map. Four categories:

| Category | Code | ~Count |
|---|---|---:|
| Previous Year / subject-wise GK | `pyq` | 8,556 |
| Current Affairs | `current_affairs` | 1,875 |
| Samacheer (state board) | `samacheer` | 1,189 |
| Aptitude & Reasoning | `aptitude` | 1,075 |

Key design choice: **PYQ questions are stored once** and shown under any exam
group whose syllabus includes that subject (`fetchQuestions.ts` filters by
`subject`, not a stored group). This is why the old per-group triplication was
removed.

---

## 4. App flow & structure (`src/`)

```
LanguageScreen → Login/Register → TestArena (home)
   → category picker (PYQ / Samacheer / CurrentAffairs / Aptitude)
   → SetupPage (choose count/filters)
   → QuizPage (the engine)
   → ResultPage (score + explanations + PDF)
Side flows: MockTest, Daily (CA), Revision (SRS), Insights, Achievements,
            AdminQuestions (admin-only, shows answers)
```

- **pages/** — all screens listed above.
- **store/** (Zustand) — `authStore`, `quizStore` (timer, 80% gate, flagging,
  scoring), `languageStore`, `progressStore` (gamification).
- **lib/** — `fetchQuestions`, `srs`, `habit`, `achievements`, `game`,
  `analytics`, `i18n`, `pdfGenerator`, `constants` (syllabus taxonomy),
  `supabase`.
- **components/** — Layout (AppLayout, ProtectedRoute), UI (PillButton, Timer,
  ProgressBar, YellowBadge), Quiz (QuestionCard, OptionButton, ResultCard),
  plus Mascot, RewardOverlay, StreakCalendar, ErrorBoundary.

**Quiz rules:** 45s per question total budget, 15s minimum per question, 80%
attendance gate to unlock explanations + PDF, auto-submit on timeout. **Answers
and explanations are never shown mid-quiz** — only on the consolidated Result
page.

---

## 5. Data model (`supabase/schema.sql`)

- **`questions`** — content + metadata + `why_wrong` (jsonb) + Tamil mirrors
  (`*_ta`) + `source_url`.
- **`profiles`** (role user/admin, exam_date, daily_goal), **`test_sessions`**,
  **`test_answers`**, **`review_items`** (SRS), **`daily_activity`** (streaks).
- `user_percentile(uuid)` RPC. **RLS enabled on all user tables.**

---

## 6. Deployment — what's left

The backend (Supabase Cloud) is already live. **Deployment = ship the static
frontend.** Steps:

1. `cd tnpsc-mentor && npm run build` → produces `dist/`.
2. Host `dist/` on any static host (Vercel / Netlify / Cloudflare Pages /
   Hostinger). Configure SPA fallback (all routes → `index.html`).
3. Set production env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at
   build time on the host.
4. In Supabase Auth settings, add the production domain to allowed redirect /
   site URLs (so login + password-reset emails point to the live site).
5. Smoke-test: register → login → take a test → submit → results → PDF download.

**Pre-launch checklist (from handover):** confirm RLS is on in production,
verify the monthly-CA GitHub Action secrets, and review the copyright/paraphrase
posture before charging users at scale (get Indian IP-lawyer sign-off).

---

## 7. Current working-tree state

A large uncommitted UI redesign + gamification feature set is in the working tree
(~2,200 line changes across 41 files, plus new untracked files: achievements,
mascot, reward overlay, streak calendar, progress store, ErrorBoundary,
secure.sql). It **builds and passes tests** but is **not yet committed**.
First deployment step is to review and commit this work.

---

## 8. Where to read more

- `docs/HANDOVER-DEVELOPER.md` — deep technical handover (scrapers, AI pipelines,
  data model, scraper gotchas).
- `docs/HANDOVER-CLIENT.md` — plain-English overview + copyright notes.
- `docs/question-bank/` — full per-category question listings.
- `context.md` (repo root) — the original build spec.
