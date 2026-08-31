# TNPSC Mentors — The Application, Top to Bottom

_A single end-to-end explanation of the product: what it is, how it is built,
every layer of the stack, and the complete flow of every path a request can
take through it._

_Written 2026-08-29 against the working tree at commit `a2f3f9f` (branch `main`).
Row counts are live production numbers pulled the same day._

> Companion docs: [`WHAT-THE-APP-DOES.md`](WHAT-THE-APP-DOES.md) (functional catalogue),
> [`ARCHITECTURE.md`](ARCHITECTURE.md), [`APPLICATION-STRUCTURE.md`](APPLICATION-STRUCTURE.md),
> [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md), [`MOBILE_RELEASE.md`](MOBILE_RELEASE.md),
> [`LIVE-UPDATES.md`](LIVE-UPDATES.md), [`README-VPS.md`](../deploy/README-VPS.md).

---

## Table of contents

1. [What the product is](#1-what-the-product-is)
2. [System architecture](#2-system-architecture)
3. [Repository layout](#3-repository-layout)
4. [Boot sequence](#4-boot-sequence)
5. [Identity: auth, sessions, devices, roles](#5-identity-auth-sessions-devices-roles)
6. [The data layer](#6-the-data-layer)
7. [The content model: the question bank](#7-the-content-model-the-question-bank)
8. [The test engine — complete flow](#8-the-test-engine--complete-flow)
9. [The mock / OMR engine and proctoring](#9-the-mock--omr-engine-and-proctoring)
10. [Credits: the free tier](#10-credits-the-free-tier)
11. [Money: plans, payments, entitlements](#11-money-plans-payments-entitlements)
12. [The study loop](#12-the-study-loop)
13. [Content beyond tests](#13-content-beyond-tests)
14. [Notifications and messaging](#14-notifications-and-messaging)
15. [Admin and superadmin back office](#15-admin-and-superadmin-back-office)
16. [The mobile app](#16-the-mobile-app)
17. [Deployment and operations](#17-deployment-and-operations)
18. [Security posture](#18-security-posture)
19. [Observability, audit, breach response](#19-observability-audit-breach-response)
20. [Known drift and gotchas](#20-known-drift-and-gotchas)
21. [Where to look for what](#21-where-to-look-for-what)

---

## 1. What the product is

**TNPSC Mentors** is a bilingual (English / Tamil) exam-preparation platform for
candidates sitting Tamil Nadu Public Service Commission exams — Group 1,
Group 2/2A, Group 4 and VAO.

One codebase ships three surfaces:

| Surface | Built from | Served at |
|---|---|---|
| Public marketing site | the same SPA, route `/` when logged out | `tnpscmentors.in` |
| Web app | the SPA | `app.tnpscmentors.in` |
| Android / iOS app | the same `dist/` inside a Capacitor shell | `com.tnpscmentor.app` |

The core loop is simple and everything else hangs off it:

```
pick a scope  →  read the rules & set count/timer  →  pay credits  →
take a timed, SERVER-GRADED test  →  get a result page with the correct answer,
per-option "why this was wrong", a bilingual explanation, an optional YouTube
walkthrough and a watermarked PDF  →  the wrong answers feed a revision queue.
```

Layered on top: a credit-based free tier with five paid plans, spaced revision,
a daily current-affairs magazine and daily CA test, study materials, streaks and
achievements, push/in-app notifications, and a full admin + superadmin back
office for content, users, revenue and publishing.

Live scale (2026-08-29): **632 accounts**, **583 test sessions** (443 completed),
**49,676 question rows**, **2,122 CA magazine items**, **96 published materials**,
**36 test-series papers**, **6 fixed mock exams**, **1,330 Thirukkural entries**.

---

## 2. System architecture

### 2.1 Topology

```
                         ┌───────────────────────────────────────────┐
                         │  Hostinger VPS (4 vCPU) — single box       │
                         │                                            │
  Browser / WebView      │   ┌──────────────┐                         │
  ┌──────────────────┐   │   │    Nginx     │  static: /var/www/tnpsc │
  │ React 18 SPA     │───┼──▶│  :80 / :443  │──── / ────▶ dist/       │
  │ (Vite bundle)    │   │   │  TLS certbot │                         │
  │                  │   │   └──────┬───────┘                         │
  │ knows exactly    │   │          │ /api/ reverse-proxy             │
  │ ONE secret:      │   │          ▼                                 │
  │ VITE_API_URL     │   │   ┌──────────────┐                         │
  └──────────────────┘   │   │ Express API  │  PM2 cluster ×4         │
         ▲               │   │ node:20 ESM  │  127.0.0.1:4000         │
         │ JSON          │   │ holds ALL    │                         │
         │ Bearer JWT    │   │ secrets      │                         │
         └───────────────┼───┴──────┬───────┘                         │
                         └──────────┼─────────────────────────────────┘
                                    │ service-role key  /  user JWT
                                    ▼
                    ┌───────────────────────────────────┐
                    │        Supabase Cloud             │
                    │  Postgres · GoTrue auth · Storage │
                    │  RLS + SECURITY DEFINER RPCs      │
                    └───────────────────────────────────┘

  External: Razorpay · Google Play Billing / StoreKit · Google OAuth ·
            FCM/APNs + Web Push (VAPID) · MSG91 (phone OTP) · AiSensy (WhatsApp OTP) ·
            Telegram Bot API · GTM/GA4 · Meta Pixel · Microsoft Clarity ·
            a separate VPS pipeline that generates the CA magazine
```

### 2.2 The one architectural rule

**The browser never holds a Supabase key.** The SPA's only backend config is
`VITE_API_URL`. Every read and write goes through the Express API, which is the
single trusted client in front of Postgres. This is what makes the rest of the
security model possible — answer keys, prices, entitlements and grading all live
behind a boundary the client cannot reach around.

The API keeps **two** kinds of DB client (`server/src/supabase.ts`):

| Client | Key | Used for |
|---|---|---|
| `supabaseAdmin` | service role, bypasses RLS | trusted server ops only: token verification, session registry, ledger reads, role lookups |
| `userClient(token)` | anon key + the caller's JWT | **almost everything** — every query runs as that user, so RLS and `auth.uid()`-based RPCs behave exactly as if the browser were talking to Supabase directly |

That second client is the trick that let Express slot in front of the database
without rewriting a single RLS policy: `requireAuth` verifies the Bearer token
with GoTrue, then attaches `req.db = userClient(token)` for the handler to use.

Both clients wrap `fetch` in `resilientFetch` — three attempts with backoff —
because the VPS's route to Supabase's Cloudflare edge occasionally hits a
connect-phase blip that used to surface to users as "Failed to fetch" on login.

### 2.3 Layer responsibilities

| Layer | Owns | Never does |
|---|---|---|
| **SPA** | rendering, navigation, local test state, timers, PDF generation, language/theme | grading, pricing, entitlement decisions, holding answer keys |
| **Express API** | auth verification, rate limiting, role gates, credit charging, price resolution, receipt verification, audit logging, third-party integrations | trusting a client-declared plan, amount, score or total |
| **Postgres RPCs** | question sampling, **grading**, revision scheduling, credit arithmetic, admin bank access, metrics | returning answer columns to an un-gated caller |

### 2.4 Request pipeline

Every API request passes through, in order (`server/src/index.ts`):

```
trust proxy 1 (Nginx sets X-Forwarded-For)
  → helmet()
  → cors(origin allow-list, credentials: true)      exact origins + single-label wildcards
  → express.json({ limit: '2mb' })
  → cookieParser()
  → requestLog                                       access log + live 403/429/5xx detectors
  → rateLimit /api      300 req/min
  → rateLimit /api/auth  30 req/min
  → 28 route modules  (/api/admin and /api/superadmin also pass auditAdmin)
  → 404 for unknown /api paths
  → central error handler: 5xx hidden behind a generic message + a Telegram page
```

Caveat worth knowing: `express-rate-limit` uses its in-memory store, and PM2 runs
**4 cluster instances**, so the effective limit on any route is up to 4× the
configured `max`. A shared store (Redis) would be needed to tighten that.

---

## 3. Repository layout

```
TNPSC-Academy/tnpsc-mentor/
├─ src/                     # React SPA
│  ├─ App.tsx               # route table, shell vs. bare routes, boot effects
│  ├─ main.tsx
│  ├─ pages/        (41)    # one file per screen, all lazy-loaded
│  ├─ components/           # Admin, Auth, Feedback, Home, Landing, Layout,
│  │                        # Materials, Onboarding, Profile, Quiz, SuperAdmin,
│  │                        # TestSeries, Thirukural, UI, revision
│  ├─ store/        (17)    # Zustand stores
│  ├─ lib/          (60+)   # api client, pdf, i18n, analytics, native bridges…
│  ├─ hooks/        (16)
│  ├─ data/                 # bundled Thirukkural question JSON
│  └─ types/index.ts        # QuizConfig, Question, Profile, SubmitResult…
│
├─ server/                  # Express API (TypeScript, ESM, node ≥20)
│  ├─ src/index.ts          # middleware chain + route mounting + error handler
│  ├─ src/routes/    (27)   # one module per API namespace
│  ├─ src/lib/       (26)   # credits, premium, revision, seen, fcm, iap*, totp…
│  ├─ src/middleware/       # auth, auditAdmin, requestLog
│  ├─ src/pricing.ts        # SERVER-SIDE prices + validity windows
│  ├─ src/sessions.ts       # device-session cap
│  ├─ src/supabase.ts       # the two DB clients
│  ├─ import_*.mjs          # bank importers (pyq, pyq2, pyq4, gov, outer…)
│  ├─ load-*.mjs            # loaders (mock exams, test series, thirukural…)
│  └─ run-migration.mjs     # applies supabase/*.sql via the direct pg pooler
│
├─ supabase/         (90+)  # every migration, cumulative, applied by hand
│  ├─ schema.sql            # base tables
│  ├─ secure.sql            # THE security file: column grants + the RPCs
│  └─ <feature>.sql         # one file per feature migration
│
├─ android/ · ios/          # Capacitor native projects
├─ deploy/                  # nginx conf, PM2 ecosystem, deploy.sh, logrotate
├─ scripts/                 # bundle packer, store assets, legal export
├─ public/ · index.html     # static shell, GTM + Meta Pixel, JSON-LD
└─ docs/                    # this file and its companions
```

### Frontend stack

React 18 · Vite 5 · TypeScript 5 · React Router v6 (per-route code splitting +
idle prefetch) · Zustand (17 stores) · Tailwind with CSS-variable design tokens
(violet accent, light/dark) · `motion` for transitions · Lenis smooth scroll ·
KaTeX for maths · jsPDF + html2canvas for PDFs · pptxgenjs for CA slide decks ·
Vitest for unit tests · Capacitor 8 for the native shell.

### Backend stack

Express 4 · helmet · cors · express-rate-limit · cookie-parser ·
`@supabase/supabase-js` · `pg` (migrations only) · razorpay · web-push · otplib +
qrcode (TOTP) · google-auth-library · `@apple/app-store-server-library` ·
`@anthropic-ai/sdk` (content-generation scripts).

---

## 4. Boot sequence

### 4.1 Web

```
index.html
  ├─ GTM container GTM-P4WXHVR8  (which also loads Microsoft Clarity xinm0efx1o)
  ├─ Meta Pixel 1006796038910199
  ├─ JSON-LD + SEO meta
  └─ <script type=module> → /assets/index-*.js

main.tsx → <App/>
  useEffect on mount, in order:
    1. themeStore.init()      re-apply stored theme, subscribe to OS light/dark
    2. warmApi()              DNS/TLS pre-connect to the API host
    3. authStore.init()       ← the gate everything else waits on
    4. authConfigStore.init() GET /api/auth/config — which optional auth methods
                              (phone OTP, WhatsApp OTP, Telegram, Google) the
                              server actually has configured
    5. installCopyGuard()     block copy/cut/paste/long-press in the app
    6. getConsent()           auto-accept trackers, fire GTM/Clarity/Pixel

  requestIdleCallback → prefetchRoutes(PREFETCH_ON_BOOT)
      warms the chunk for every nav tab so a tab tap never hits a spinner
```

`authStore.init()` calls `api.auth.me()` if there is an access token **or** (on
web) a possible HttpOnly refresh cookie. `me()` transparently refreshes when the
access token is absent or expired, so a returning web user stays signed in
without JavaScript ever being able to read the refresh token.

### 4.2 Route shape

Routes split three ways in `src/App.tsx`:

| Group | Chrome | Examples |
|---|---|---|
| **Public** | none | `/login`, `/register`, `/rank-booster`, `/privacy`, `/delete-account` |
| **`SHELL_ROUTES`** | persistent header + tab bar, cross-faded content | `/test-arena`, `/mock`, `/test-series`, `/insights`, `/profile`, `/superadmin` |
| **`BARE_ROUTES`** | full viewport, **no animation** | `/quiz`, `/mock/quiz`, `/complete-profile`, `/language`, `/payment-success` |

The shell is mounted **once** for every chrome route, so switching tabs swaps only
the content — the nav never unmounts or re-animates. `AnimatedOutlet` uses
`useOutlet()` rather than `<Outlet/>` so the outgoing screen keeps rendering its
own content through the exit animation instead of flipping mid-transition. Live
test screens are bare and unanimated deliberately: a test must appear the instant
it is ready.

`/` is auth-aware: signed in → `/test-arena`; signed out on web → the marketing
`LandingPage`; signed out in the native app → `/login` (the landing chunk is
never even fetched inside the APK).

Bottom/side nav: **Home · Group 1 Test Series · Test Series · Revision ·
Materials · Insights · Profile**, plus a header credit pill, notification bell,
messages icon, language switch (EN / தமிழ் / both) and light-dark toggle. Admins
get a reduced nav (Home · Reports) plus the student-preview toggle.

### 4.3 Native extras

`useNativeBootstrap()` runs only in the Capacitor build: edge-to-edge chrome,
splash dismissal, **purchase recovery** (a store charge the server never
recorded), push-token refresh, deep-link handling, and `notifyAppReady()` for the
OTA plugin.

---

## 5. Identity: auth, sessions, devices, roles

### 5.1 The ways in

| Method | Path | Notes |
|---|---|---|
| Email + password | `POST /api/auth/login` | password floor 8 chars + HIBP breach check at signup |
| Google | `POST /api/auth/google` | web OAuth and native Google sign-in; an email registered with Google is routed *back* to the Google button instead of failing at the password step |
| Phone OTP | `/api/auth/otp/send` → `/verify` | MSG91; behind a server config flag |
| WhatsApp signup OTP | `/api/auth/register/otp/send` → `/verify` | AiSensy (official WABA); issues a **ticket** that `POST /register` must carry |
| Telegram fallback | `/api/telegram/start` → `/status` | for numbers with no WhatsApp; issues the same ticket shape |
| TOTP step-up | `/api/auth/totp/step-up` | admin/superadmin only, opt-in; password/Google succeeds but withholds the session until a 6-digit or backup code is redeemed |

`GET /api/auth/config` tells the client which of these are live, so the UI never
shows a button for an unconfigured provider.

**One account = one email = one phone.** Duplicate phone or email is rejected at
signup with a specific error code (`phone_already_registered`,
`email_already_registered`, `email_registered_google`, `password_breached`) that
the client turns into a precise nudge rather than a dead end. `LoginPage` and
`RegisterPage` bounce a user to each other when the email belongs on the other
page.

### 5.2 Token handling

```
login  ─▶ GoTrue mints { access_token (short-lived), refresh_token }
          │
          ├─ WEB:    refresh token → HttpOnly cookie set by the server
          │          (XSS cannot read it; requests use credentials: 'include')
          └─ NATIVE: refresh token → secure storage, sent in the request BODY
                     (the Capacitor WebView can't rely on cross-site cookies)

every request ─▶ Authorization: Bearer <access>
                 X-Client-Platform: web | android | ios
                 X-Device-Id: <stable localStorage id>

401 ─▶ api client transparently calls POST /api/auth/refresh, retries once
```

Password reset lands on `/reset-password` at the **real web origin** — never
`window.location.origin`, which inside Capacitor is `https://localhost` and would
mail out a dead link.

### 5.3 The two-device cap

Implemented in `server/src/sessions.ts`. `MAX_DEVICES = 2`, idle TTL 7 days.

The cap binds to the **GoTrue `session_id` claim** decoded out of the access
token — unforgeable, because Supabase signed it — not to the client-supplied
device id. But the client's stable `device_id` *is* recorded, and used to collapse
repeat logins from the same browser into one slot (`revokeSameDevice`), which is
what stops one browser from tripping its own limit.

```
POST /api/auth/login
  ├─ revokeSameDevice()    free any slot this browser still holds
  ├─ activeCount(exclude self) >= 2 ?  ──▶ 403 { error:'device_limit', devices:[…] }
  ├─ upsert user_sessions row
  └─ RE-CHECK activeCount  ──▶ if a concurrent login raced us, roll our row
                               back and report blocked
```

The check-then-act is deliberately non-atomic (there is no registration RPC to
defer to), so the post-insert re-check collapses the race window into a brief
over-count that self-heals rather than a durable breach.

On a `device_limit` 403 the client shows `DeviceLimitModal` listing the active
devices; picking one calls `/login/replace-device` (or the OTP / Google / TOTP
variant), which signs that device out and completes the login in one round-trip.

`touchSession()` heartbeats on every refresh/boot and returns `{ revoked: true }`
when the session was signed out remotely, so the client 401s. Enforcement happens
**only at login**, which is why shipping the feature never logged existing users
out.

### 5.4 Roles

Three nesting roles on `profiles.role`: `user` < `admin` < `superadmin`.

Enforced in **two independent places**:

- API middleware — `requireAdmin` / `requireSuperadmin` (`middleware/auth.ts`),
  with a 30-second role cache to avoid a `profiles` round-trip per request.
- The database — `is_admin()` / `is_superadmin()` guard every privileged RPC.

An admin can flip a header toggle (`adminViewStore`) to **preview the app as a
student**. This masks the effective role in `useAuth` only; `ProtectedRoute` and
every server gate still see the real role.

A Google signup arrives with no phone, so `selectProfileNeedsOnboarding` routes
such aspirants through `/complete-profile` until it is filled. Staff skip it.

### 5.5 First-run sequence

A brand-new account is armed with, in order: a **Starter Challenge** prompt (an
18-question hard mixed paper), then a **guided spotlight tour** of the dashboard
(`OnboardingTour`, bilingual, consumed once, replayable from Profile), then a
one-time "Test Series Paper 1 is free" promo (`MarathonFreeAlert`).

---

## 6. The data layer

### 6.1 Tables (40)

| Group | Tables |
|---|---|
| **Content** | `questions`, `ca_daily_questions`, `ca_magazine`, `materials`, `thirukural`, `mock_exams`, `test_series`, `vettri_exams`, `questions_backup` (retired banks) |
| **Learning** | `test_sessions`, `test_answers`, `review_items`, `revision_topics`, `seen_questions`, `bookmarks`, `daily_activity`, `mock_exam_attempts`, `test_series_attempts`, `free_test_usage` |
| **Identity** | `profiles`, `user_sessions`, `phone_otps`, `telegram_verifications` |
| **Money** | `payments`, `coupons`, `credit_transactions` |
| **Comms** | `notifications`, `notification_reads`, `push_subscriptions`, `push_devices`, `app_alerts`, `alert_dismissals`, `user_messages` |
| **Feedback** | `app_feedback`, `explanation_feedback`, `question_reports`, `question_report_status` |
| **Ops** | `audit_log`, `app_settings`, `app_releases`, `web_bundles`, `ca_telegram_posts`, `ca_whatsapp_posts` |

Two foreign-key decisions worth remembering:

- `test_answers.question_id` is `on delete set null` — deleting a question must
  neither be blocked by nor wipe a user's answer history. The row keeps
  `is_correct`/`selected_answer`, so past scores stay intact; only the link to
  the deleted content is severed. (The default `NO ACTION` previously made every
  answered question undeletable.)
- `test_sessions.user_id` is `on delete cascade` — deleting an account really
  does delete its history, which is what the privacy policy promises.

### 6.2 The security model in the database

`supabase/secure.sql` is the file that matters. It does two things:

1. **Column-level grants** revoke `correct_answer` and `explanation` from the
   client role entirely. Even a direct PostgREST query cannot select them.
2. **SECURITY DEFINER RPCs** become the *only* route to answers — and each one
   decides for itself what to hand back.

The ~60 RPCs, by job:

| Job | Functions |
|---|---|
| Serve questions | `get_quiz_questions`, `count_quiz_questions`, `subject_mock_questions`, `mock_slot_questions`, `starter_test_questions`, `check_answer` |
| **Grade** | `submit_test`, `grade_review`, `record_abandoned_test` |
| Taxonomy / counts | `distinct_question_topics`, `subject_practice_subjects`, `subject_topic_counts`, `subject_qtype_counts`, `question_topic_counts`, `question_year_counts`, `pyq_history_period_counts` |
| Revision | `get_due_reviews`, `upsert_revision_topic`, `list_revision_topics`, `clear_revision_topic`, `dismiss_revision_topic`, `revision_analytics` |
| Credits | `spend_credits`, `grant_daily_credit`, `grant_first_test_bonus` |
| Admin bank | `admin_list_questions`, `admin_upsert_question`, `admin_delete_question`, `admin_set_question_active`, `admin_bulk_insert_questions` |
| Reports | `admin_list_question_reports`, `admin_set_report_status`, `admin_count_open_reports` |
| Superadmin | `get_platform_metrics`, `get_revenue_metrics`, `superadmin_list_users`, `superadmin_user_insights`, `superadmin_set_role`, `superadmin_grant_plan`, `superadmin_revoke_*` |
| Housekeeping | `handle_new_user`, `increment_activity`, `user_percentile`, `prune_audit_log`, `is_admin`, `is_superadmin` |

`handle_new_user` is a trigger on `auth.users` that creates the matching
`profiles` row (with the 50-credit default) on signup.

### 6.3 Migrations

There is no migration framework. `supabase/*.sql` files are **cumulative and
idempotent** (`create table if not exists`, `add column if not exists`,
`create or replace function`), applied by hand:

```bash
node server/run-migration.mjs supabase/<file>.sql   # direct pg pooler, not PostgREST
```

Consequence, and it bites: **the production schema has drifted from
`schema.sql`.** `schema.sql` still declares the original four-category check
constraint and no `active` / `unit` / `why_wrong` / `option_e` columns in its
`create table`; the real shape is the sum of ninety files. Read the feature's own
`.sql` file, not `schema.sql`, when you need ground truth. Several files
supersede earlier ones outright (`superadmin_users_v2.sql` over the older
list-users definitions, `revenue_metrics.sql` over its predecessor, and so on).

---

## 7. The content model: the question bank

### 7.1 One table, partitioned by `category`

Live counts, production, 2026-08-29:

| Bank | `category` | Rows | Active | Served to students? |
|---|---|---:|---:|---|
| Admin-only provenance bank | `outer` | 28,619 | 28,619 | **No** — admin browse only |
| Subject Practice (main study bank) | `subject` | 8,373 | 7,887 | Yes |
| Group 2 / 2A previous-year | `pyq2` | 2,699 | 2,689 | Yes |
| Group II/IIA Rank Booster series | `testseries_g2` | 2,000 | 2,000 | Paid |
| Current Affairs | `current_affairs` | 1,710 | 1,709 | Yes |
| Group 1 Test Series (Test Marathon) | `testseries` | 1,600 | 1,600 | Paid |
| Group 4 & VAO previous-year | `pyq4` | 1,400 | 1,400 | Yes |
| Fixed full mock exams (6 × 200) | `mock` | 1,200 | 1,200 | Gated |
| Aptitude & Reasoning | `aptitude` | 1,086 | 1,066 | Yes |
| Group 1 previous-year | `pyq` | 989 | 986 | Yes |
| **Total** | | **49,676** | **48,556** | |

Plus 1,330 Thirukkural rows, 872 `ca_daily_questions`, 2,122 CA magazine items.
Legacy `samacheer` and the old `vettri` bank are retired to `questions_backup`
(the `/test-arena/samacheer` route survives for direct/admin access).

### 7.2 What a row carries

Four options (plus an optional `option_e`), the verified `correct_answer`, a
written `explanation`, a per-wrong-option `why_wrong` JSONB map, `difficulty`,
`question_type` (the style tag), optional figure and option images, an optional
`explanation_video_url`, provenance (`source_tag`, `source_url`, `external_id`),
an `active` flag — and a **Tamil mirror of every text field** (`*_ta`). The
frontend renders Tamil / English / both and falls back to English when a `_ta`
column is null.

`external_id` carries a UNIQUE index so the CA generator's REST upsert can dedupe
on it.

### 7.3 PYQ membership is derived, not stored

A previous-year question is stored **once** and surfaces under any group whose
syllabus includes that subject — membership by subject, not by a stored
`group_type`. Group 2 and Group 4 are both driven by one generic page pair
(`PyqGroupPage` / `PyqSectionPage`) off a client-side `PYQ_GROUPS` registry, so
adding a group is a data change, not a new screen. Year chips are derived at
runtime from `question_year_counts`.

Scanned figures and option images are served from Supabase Storage where the
original paper had them.

### 7.4 How content gets in

```
raw source (scanned papers, textbooks, CA feeds)
   │
   ├─ scrapers/*.py                 → JSON
   ├─ server/import_*.mjs           → bulk insert via service role
   ├─ server/load-*.mjs             → catalogue loaders (mock exams, series…)
   └─ explanations: model-authored through an author → verify pipeline,
      then fact-checked; defects tracked in FLAGGED_*.md at the project root
```

**The reload rule** (learned the hard way): for ANY bank reload, `UPDATE` by
`external_id` or scope strictly to new ids. Never blanket delete-and-reinsert —
`questions.id` foreign keys are `CASCADE` / `SET NULL` and will silently eat user
history.

**The figure rule**: scanned figure crops can include the printed answer key.
Look at every crop before upload — two Group 4 crops shipped with the answer
visible.

---

## 8. The test engine — complete flow

This is the heart of the app. Here is one practice test end to end.

### 8.1 The complete practice-test flow

```
┌─ PICKER PAGE ─────────────────────────────────────────────────────────────┐
│ e.g. SubjectPracticePage: subject → topic → question type                 │
│ builds a QuizConfig  { category, subject, topic, question_type, … }       │
│ counts come from POST /api/questions/count → count_quiz_questions RPC     │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │ useStartTest(config)
                    ┌────────┴────────┐
             isAdmin│                 │user
                    ▼                 ▼
        /admin/questions      /quiz/instructions
        (full bank, answers    · rules, count slider, timer
         + explanations)       · CreditConfirmPopup shows the exact cost
                                       │ "Start"
                                       ▼
┌─ FETCH ───────────────────────────────────────────────────────────────────┐
│ fetchQuestionsForConfig(config)  → POST /api/questions/quiz               │
│                                                                           │
│ SERVER:                                                                   │
│   1. QUIZ_BLOCKED_CATEGORIES backstop — mock / testseries / testseries_g2 │
│      / vettri / outer can never be drawn through the generic route        │
│   2. isUnlimited(req)  — staff OR bundleAccess().creditsUnlimited         │
│   3. rpc get_quiz_questions(p_config)                                     │
│        SECURITY DEFINER · returns ONLY safe columns · random order ·      │
│        unseen-first sampling (seen_questions), soft — never shortens      │
│   4. if (!unlimited && questions.length)                                  │
│        chargeTestStart() → spend_credits(cost = 1 × questionCount)        │
│        insufficient ──▶ 402 { error:'insufficient_credits', balance, cost}│
│   5. recordSeen()  (fire-and-forget)                                      │
└────────────────────────────┬──────────────────────────────────────────────┘
                             ▼
┌─ /quiz  (BARE route, full viewport) ──────────────────────────────────────┐
│ quizStore.initSession(config, questions)                                  │
│   timeLimit = durationSeconds ?? questions.length × 45s                   │
│   startedAt = Date.now()                                                  │
│                                                                           │
│ The store is PERSISTED to localStorage (safeLocalStorage — a quota error   │
│ must never crash a running test). totalTimeLeft is NOT persisted: it is    │
│ recomputed from startedAt, so closing the tab does not pause the clock,    │
│ and a refresh resumes the test exactly where it was.                       │
│                                                                           │
│ answer · flag for review · jump freely · optional instant check-answer     │
│ ── the browser holds NO answer key at any point ──                         │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │ submit (or timer hits 0, or 5 proctor violations)
                             ▼
┌─ GRADE ───────────────────────────────────────────────────────────────────┐
│ submitTest() builds ONE entry per SHOWN question (null = skipped) so the   │
│ server can grade attendance and enqueue unattempted questions.             │
│         POST /api/tests/submit  { session, answers[] }   (max 500)         │
│                                                                           │
│ SERVER → rpc submit_test(p_session, p_answers):                           │
│   • v_total is DERIVED from answer rows that JOIN real questions —         │
│     never taken from the client's total_questions (which could be forged)  │
│   • grades against questions.correct_answer                               │
│   • v_passed = attempted / total >= 0.25   ← the attendance gate           │
│   • INSERT test_sessions (status 'completed') + test_answers               │
│   • INSERT review_items for wrong / unattempted / flagged  (SRS enqueue)   │
│   • UPSERT daily_activity on the IST date  (streaks + daily goal)          │
│   • returns per-question results, revealing correct_answer / explanation / │
│     explanation_ta / explanation_video_url / why_wrong ONLY when v_passed  │
│                                                                           │
│ then, best-effort and never blocking the result:                           │
│   • applyRevision()      score ≤ 40% on a topic test → flag for revision;  │
│                          a revision re-test scoring > 40% clears it        │
│   • grantFirstTestBonus() +25 credits on the user's FIRST graded test      │
│   • recordMockExamAttempt / recordTestSeriesAttempt for capped papers      │
└────────────────────────────┬──────────────────────────────────────────────┘
                             ▼
┌─ /result ─────────────────────────────────────────────────────────────────┐
│ score · accuracy · time · per-question review with the correct letter,     │
│ the bilingual explanation, the per-wrong-option why_wrong rationale, an     │
│ embedded YouTube walkthrough where one exists, a bookmark toggle, a         │
│ "report an error in this question" action, and the explanation PDF          │
│ (jsPDF, KaTeX-aware for aptitude, watermarked with the downloader's         │
│ identity; free users capped at 3 downloads total).                          │
└───────────────────────────────────────────────────────────────────────────┘
```

Leaving mid-test calls `POST /api/tests/abandon` → `record_abandoned_test`, so
the session is recorded as `abandoned` rather than vanishing.

### 8.2 Timing and gate constants

| Constant | Value | Where |
|---|---|---|
| `SECONDS_PER_QUESTION` | 45 | `src/store/quizStore.ts` |
| `MIN_SECONDS_PER_QUESTION` | 7 | same |
| `ATTENDANCE_GATE` | **0.25** (25%) | same, mirrored inside `submit_test` |
| `MAX_ANSWERS` per submit | 500 | `server/src/routes/tests.ts` |
| `MAX_VIOLATIONS` (auto-submit) | 5 | `src/hooks/useProctoring.ts` |

### 8.3 The three graders

Not every test goes through `submit_test`. There are three paths, by design:

| Path | Fetch | Grade | Why |
|---|---|---|---|
| **Standard** | `get_quiz_questions` | `submit_test` RPC | the default |
| **Thirukkural** | bundled JSON, `buildThirukuralQuestions` | **client-side** `gradeLocally()` | the bank ships inside the app; no server round-trip. Uses the same 25% gate and produces the same `ResultPayload` shape |
| **Daily CA** | `POST /api/ca-questions/daily/:id/quiz` | `POST /api/ca-questions/daily/:id/submit` | its questions live in `ca_daily_questions`, not `questions`, so `submit_test`'s join would score every answer as unknown |

### 8.4 Instant check-answer

`POST /api/questions/check-answer` reveals **one** question's answer and
explanation for practice-mode instant feedback. It is gated entirely inside the
`check_answer` RPC — only a question this user was already legitimately served
(per `seen_questions`) can be revealed — with a defence-in-depth rate limit of
60 per 10 minutes per user on top.

### 8.5 Practice modes

| Mode | Route | Shape |
|---|---|---|
| Subject Practice | `/test-arena/subjects` | Subject → Topic → Question type (5 styles + Mixed) |
| PYQ Group 1 | `/test-arena/pyq/group1` | subject-wise; History splits by period (Ancient / Medieval / Modern); dedicated aptitude entry |
| PYQ Group 2/2A, Group 4/VAO | `/test-arena/pyq/:group/:section` | section → sub-type, with a year filter |
| Current Affairs | `/test-arena/current-affairs` | month-wise and topic-wise; months come from the DB, so a newly pushed month appears with no redeploy |
| Aptitude & Reasoning | `/test-arena/aptitude` | numerics / reasoning → topic; "Area and Volume" drills two levels deeper; KaTeX-typeset in-app and in the PDF |
| Thirukkural | `/test-arena/thirukural` | adhigaram + question type |
| Daily CA Test | `/daily` | day-picker popup: today plus every earlier published day |
| CA Questions | `/test-arena/ca-questions` | two tabs — Quiz (graded) and PDF (watermarked download) |
| Starter Challenge | tour CTA / dashboard hero | fixed 18-question hard mixed paper, its own sampler |

---

## 9. The mock / OMR engine and proctoring

`/mock` → `/mock/instructions` → `/mock/quiz` runs a **separate engine** with its
own persisted store (`mockQuizStore`), an OMR bubble palette, a fixed duration,
optional negative marking, countdown warnings and proctoring. It mirrors
`quizStore`'s resume-after-refresh pattern: everything persists except the live
countdown, which is recomputed from `startedAt`.

Five kinds of mock, discriminated by `config.mockKind`:

| `mockKind` | Source | Gate |
|---|---|---|
| `group` | `mock_slot_questions` against a per-group **blueprint** (`GROUP_SLOTS` in `routes/questions.ts`) — Group 1 Prelims 100Q/90min, Group 2/2A, Group 4/VAO, each a list of subject slots with counts and source categories | credits |
| `subject` | `subject_mock_questions` — configurable count and difficulty | credits |
| `exam` | one of 6 fixed 200-question bilingual papers (`category='mock'`) | free tier: **1 ever**; superadmin-enabled set; **2 attempts** |
| `series` | a scheduled test-series paper | date + entitlement + **2 attempts** |
| `vettri` | the retired Vettri bank | dark |

A blueprint slot pools one or more `{category, subjects[]}` queries, shuffles and
takes `count`. Example — the Group 1 blueprint: History & INM 15, Polity 12,
Geography 12, General Science 15, Economy 10, TN History & Culture 10,
TN Administration 6, Current Affairs 10, Aptitude 10.

### Proctoring (`src/hooks/useProctoring.ts`)

Shared by the mock engine and the regular quiz. Tracked violation types:
`fullscreen_exit`, `tab_switch`, `copy_paste`, `screenshot`, `screen_record`.

- Enforces fullscreen where the Fullscreen API exists; degrades to
  visibility/blur proctoring on phones that lack it.
- Detects OS screen-capture shortcuts (PrintScreen, Win+Shift+S,
  Cmd+Shift+3/4/5, Win+Alt+R) and wipes the captured clipboard.
- A blur + `visibilitychange` pair from one tab switch is de-duplicated so it
  counts once.
- **5 violations auto-submit the test.**

`ScreenGuard` additionally blanks exam content, and the native build applies
screen security on exam screens.

This is also why the OTA updater is configured `autoUpdate: 'atBackground'` — a
bundle swap mid-session would reload the WebView, which the proctor would score
as a violation and cost the attempt.

---

## 10. Credits: the free tier

Credits replaced the older per-topic and per-subject free gates entirely.
(`/topic-access` and `/subject-access` still exist but now always answer "no
locks" — the client still computes keys with `lib/freeGate.ts`, they simply never
match.)

### The rules (`server/src/lib/credits.ts`, `supabase/credits.sql`)

| Rule | Value |
|---|---|
| Signup grant | **50** (a column default, so it back-filled every existing profile) |
| Daily login grant | **+10** per IST day, starting the day *after* signup |
| Daily grant with an active ₹399 Mock Pack | **+50** |
| Cost | **1 credit per question** — a test costs its question count |
| First graded test | one-time **+25** |
| Free mock exams | **1 ever** (`FREE_MOCK_LIMIT`) |
| Free explanation PDFs | **3 total** (`FREE_PDF_DOWNLOADS`) |
| Paid plans | unlimited — never touch the ledger |

Charging per question is what makes a full 200-question mock unaffordable on the
free tier **by design**.

**Daily credits are use-it-or-lose-it.** `grant_daily_credit` tracks `daily_left`
and, at the next IST day boundary, claws back whatever remains of the previous
day's grant before adding today's. Spends drain the expiring daily pool *first*,
so a saved-up signup/admin balance is preserved. `profiles.credits` stays the
single authoritative balance; `credit_transactions` is the audit trail.

### Why charge at start, not at submit

`chargeTestStart()` runs inside `POST /api/questions/quiz` (and the starter-test
and revision routes), atomically, the moment a real non-empty paper is delivered.
This is a deliberate correction of an earlier design that charged on submit:

- a forged submit payload (e.g. `mock_kind: 'series'`) skipped the fee entirely;
- the submit-time charge was best-effort, so it could be dropped;
- charging at start also makes each start a **reservation**, so opening several
  tests at once can no longer all be graded off one balance.

Out of credits produces a `402` with `{ balance, cost }`, which the client turns
into the forced upsell modal (`upsellStore` → lazily-loaded `UpsellModal`, which
carries the purchase cards and Razorpay plumbing in its own chunk so boot never
downloads them).

A bilingual `CreditConfirmPopup` shows the exact cost before every test, and a
header `CreditPill` shows the live balance. `CreditWall` appears on the dashboard
only when the balance actually starts blocking practice — a quiet strip while
low, the full plan cards at zero.

---

## 11. Money: plans, payments, entitlements

### 11.1 The five plans (`server/src/pricing.ts`)

| Plan id | Price | Window | Unlocks |
|---|---:|---:|---|
| `premium_annual` | ₹1,699 | **180 d** | everything — unlimited practice, unlimited PDFs, and every other plan's content |
| `vettri_nichayam` | ₹899 | 60 d | the Group 1 Test Series (Test Marathon) + unlimited PYQ/CA |
| `vettri_month` | ₹499 | 30 d | half the programme; pay again to extend |
| `rank_booster_g2` | ₹1,249 (MRP ₹1,800) | 90 d | the Group II/IIA Rank Booster series + the credit bypass |
| `group1_mock_pack` | ₹399 | 80 d | a **boosted daily credit grant** (50/day), not unlimited credits |

Prices live only on the server. `baseAmountForPlan()` ignores the client amount
entirely for a known plan; only the generic "contribution" path accepts a client
amount, clamped to ₹1 – ₹100,000.

### 11.2 Entitlements are derived, never stored

There is no mutable `is_premium` flag anywhere. `bundleAccess()`
(`server/src/lib/premium.ts`) reads the paid rows of the ledger in **one** query
over the widest validity window, then bounds each plan against *its own* window.
It returns three deliberately different unions:

```
unlimited            = premium || vettri                   → the Group 1 Test Series bank
rankBoosterUnlocked  = premium || rankBooster               → the Group II/IIA series
                       (NOT vettri — Rank Booster is its own purchase)
creditsUnlimited     = premium || vettri || rankBooster     → the credit-gate bypass
mockPack             = its own field                        → boosted daily grant only
```

Vettri access takes whichever of the ₹899 and ₹499 windows expires later, so a
user who renewed monthly keeps the longest access.

Every entitlement read **fails closed**: a DB error is treated as *no*
entitlement, so a transient failure applies the gate rather than handing out free
access.

### 11.3 Web payments — Razorpay

```
SPA  ─▶ POST /api/payments/order  { plan?, amount?, couponCode? }
        SERVER:
          plan  = KNOWN_PLANS.has(client plan) ? that : null   (notes.plan overwritten,
                                                                so entitlement can never
                                                                be driven by a client string)
          base  = baseAmountForPlan(plan, clientAmount)        ← SERVER price wins
          coupon evaluated server-side (exact match, rate-limited)
          amount === 0 (100%-off coupon)?
            └─▶ write a paid ₹0 ledger row directly, alert admins, done
          else rzp.orders.create() + a 'created' ledger row
        ◀─ { order, keyId }   ← only the PUBLIC key id ever reaches the browser

Razorpay Checkout opens in the browser
        │ success
SPA  ─▶ POST /api/payments/verify
        SERVER: HMAC-verify the signature, assert the payment is captured,
                belongs to THIS order, and paid the EXACT recorded amount;
                the UPDATE is guarded on status='created' so duplicates are idempotent
        ◀─ paid
        entitlementsStore.markPremium() / markVettri() / … (optimistic)
        Meta CompleteRegistration fires only here, on a verified payment
```

With Razorpay keys unset, `/api/payments/*` returns `503` and the app runs
normally. A pre-payment confirmation popup runs on every plan card.

### 11.4 Mobile payments — store IAP

`/api/iap/verify` verifies a Play or App Store receipt server-side
(`lib/iapGoogle.ts`, `lib/iapApple.ts`) and **re-derives the plan from the product
id inside the verified receipt**, then writes the same ledger row shape. Mounted
separately from `/api/payments` so it stays reachable when Razorpay is
unconfigured — the native apps have no Razorpay fallback to degrade to.

`useNativeBootstrap` runs a **purchase-recovery** pass on launch for a charge the
store took but the server never recorded.

### 11.5 Test series

Two products, one code path (`lib/testSeriesCatalog.ts`):

| Key | Category | Papers | Unlocked by |
|---|---|---:|---|
| `g1_marathon` — "Test Marathon 2026" | `testseries` | 13 | `unlimited` |
| `g2a_rankbooster` — "Group II/IIA Rank Booster" | `testseries_g2` | 10 | `rankBoosterUnlocked` |

Papers unlock by **date**, superadmin can override the schedule, and each allows
**2 attempts**. A client that omits `series` defaults to `g1_marathon`, which is
what keeps older Android builds (no OTA) working. `/test-series` has its own
analytics tab: attempt score history and a weak-area breakdown by subject and
derived question type, with practice deep-links.

`/rank-booster` is a standalone public enrollment/marketing landing page —
purchasable directly once signed in, or sign-up-then-return for a new visitor.

---

## 12. The study loop

| Feature | Mechanism |
|---|---|
| **Spaced revision (SRS)** | `submit_test` auto-enqueues every wrong / unattempted / flagged question into `review_items`. `get_due_reviews` serves the due deck; `grade_review` grades one card and reschedules it by the SRS interval. |
| **Topic revision** | Any topic test scoring **≤ 40%** (`REVISION_PASS_MARK`) is auto-flagged into `revision_topics`. The re-test unlocks after **12 hours of *awake* time** — `computeAvailableAt()` skips the 23:00–07:00 IST sleep window entirely — and draws *similar*, not identical, questions (the prior ids are stored as `seen_ids`). Scoring **above** 40% clears the flag. |
| **Seen questions** | Every delivered question is recorded in `seen_questions`; samplers prefer unseen rows across quiz, subject-mock and mock-slot fetches. A **soft** de-prioritisation — it never shortens a paper. Also the gate `check_answer` uses: only a question you were legitimately served can be revealed. |
| **Bookmarks** | Save any question, revisit as a list at `/bookmarks`. |
| **Insights** | Accuracy ring, trend chart, per-subject and per-question-type breakdowns, streak stats, and a percentile against other users (`user_percentile`). |
| **Streaks & goals** | `daily_activity` keyed on the **IST** date (`submit_test` writes `now() at time zone 'Asia/Kolkata'`, because `current_date` would be UTC). 7-day calendar, daily question goal, exam-date countdown, editable from Profile. |
| **Achievements** | XP, levels, badges, and a reward overlay on unlock (`lib/game.ts`, `lib/achievements.ts`). |
| **Question reports** | A student flags a wrong or unclear question from inside a test or the result page → `question_reports` → admin triage at `/admin/reports` → resolving notifies every reporter with superadmin-editable copy. |

A handful of surfaces sit behind compile-time flags in `src/lib/features.ts`:
`SHOW_STREAK` and `SHOW_GOALS` are on; `SHOW_MOMENTUM` (the once-per-sign-in
dashboard momentum panel) is off while its data keeps being recorded.

---

## 13. Content beyond tests

### 13.1 The dashboard (`/test-arena`)

Time-of-day greeting, first name, day-streak flame · **Kural of the day** (a
rotating Thirukkural couplet, tap for the full 1,330-kural browser) · the
**current-affairs magazine carousel** (last seven published daily issues) · a
**Starter Challenge hero** while the account has zero completed tests · one
gradient hero card for Mock Tests · then a grid of practice entries (Daily CA
Test, Group 1 Test Series, Test Series, Subject Practice, PYQ, Current Affairs,
Aptitude, CA Questions, Thirukkural Quiz) · the credit wall when it starts to
bite · "keep going" shortcuts to Revision and Insights.

### 13.2 The current-affairs pipeline

A **separate VPS pipeline** (contract documented in `APP_INTEGRATION.md`)
generates the daily CA magazine and monthly 240-question CA banks and pushes them
into the app's database and storage. From there:

```
pipeline push ─▶ ca_magazine rows (+ storage assets)
                        │
     superadmin reviews / edits in the CA Magazine tab
                        │  approve
                        ▼
     materials row (kind='magazine')  ──▶ in-app MagazineReader,
                                          dashboard carousel,
                                          ca_daily_questions → the Daily CA Test
                        │
     ├─▶ CA Slides   : any issue → a bilingual class deck (PPTX + PDF),
     │                 generated browser-side from one shared layout model
     │                 (make_ca_ppt.py is the CLI twin)
     ├─▶ CA Telegram : push EN + TA PDFs to @tnpscmentors with editable
     │                 captions and a brand watermark
     └─▶ CA WhatsApp : the same shape for WhatsApp distribution
```

`startCaMonthlyAutoPublish()` runs on API boot: it recovers a monthly magazine
the pipeline pushed to storage/questions but failed to insert into `ca_magazine`,
and auto-publishes it rather than waiting on a superadmin.

### 13.3 Materials

Superadmin-curated videos, images, PDFs and documents in a **private** Supabase
Storage bucket, served via short-lived signed URLs
(`GET /api/materials/:id/file`), with per-item download gating and placement
control (materials page / profile). 96 published items today.

### 13.4 PDFs

Explanation PDFs are generated **client-side** with jsPDF, KaTeX-aware for
aptitude maths, and watermarked with the downloader's identity (`pdfWatermark.ts`).
Free users are capped at 3 downloads (`record_pdf_download` /
`GET /api/tests/pdf-quota`).

---

## 14. Notifications and messaging

| Channel | Mechanism |
|---|---|
| **Web Push** | VAPID; `push_subscriptions`; `GET /api/notifications/vapid-public-key` → `subscribe` |
| **Native push** | FCM (Android) / APNs (iOS) via `push_devices` and `lib/fcm.ts` |
| **In-app bell + feed** | `notifications` + `notification_reads`, bilingual copy, audience targeting (all / premium / a single user via `target_user_id`) |
| **Popup alerts** | `app_alerts` + `alert_dismissals` — superadmin modal announcements shown **once per account**, typed `info` / `alert` / `update` / `success` (`lib/alertKinds.ts`) |
| **Direct messages** | `user_messages` — a real two-way superadmin ↔ student thread at `/messages`; superadmin-initiated only |
| **Automatic nudges** | e.g. `firstTestNudge` fires 24 h after signup without a first test; a targeted push when a free user hits a lock |

`PushPrimer` / `PushNudge` handle the opt-in ask, because the installed Android
WebView cannot do Web Push — that path needs native FCM.

---

## 15. Admin and superadmin back office

### `/admin/questions`

The question bank **with answers and explanations visible**: search, filter by
category and scope, inline edit, activate/deactivate, delete, and bulk import from
CSV/JSON (`docs/IMPORT-FORMAT.md`). Admins reach it through the *same* selection
flow a student uses — picking a category lands an admin on the bank instead of a
test.

### `/admin/reports`

The student question-report triage queue, with a "contact the reporter" path.

### `/superadmin` — the platform console

| Tab | Purpose |
|---|---|
| Overview | users, active today / 7-day, tests completed and abandoned, bank size, average rating, feedback count |
| Revenue | week / month / year / all-time revenue, paying customers, active premium, conversion, AOV, coupon orders, discounts, failed payments |
| Users | search + paging, a user detail popup with per-user insights, plan badges, role changes, plan grant/revoke (a comped grant writes a ₹0 paid row), device-session listing and revocation, account deletion |
| Coupons | create / edit / copy / delete with redemption stats |
| Notifications | compose and send push + in-app notifications by audience |
| Alerts | the popup-announcement composer |
| Feedback | the student feedback inbox |
| Reports | question-error reports and the editable "resolved" message |
| Messages | the direct-message threads |
| Mock Exams | enable/disable the fixed 200-question papers |
| Test Series | schedule and catalogue for both series products |
| Vettri | the retired Vettri exam catalogue |
| Materials | upload and place videos, images, PDFs, documents |
| CA Magazine | review, edit, publish daily/monthly issues; Telegram + WhatsApp broadcast |
| CA Slides | generate bilingual PPTX/PDF decks from an issue |
| CA Questions | publish daily and monthly question sets |
| App | Android APK releases, the update prompt, and **Live updates** (OTA bundles) |

Runtime feature flags live in `app_settings` (`mock_group_enabled`,
`mock_subject_enabled`, `test_series_enabled`, `vettri_enabled`, …) — superadmin-
controlled rows, so whole sections appear and disappear without a deploy.

Every call under `/api/admin` and `/api/superadmin` passes the `auditAdmin`
middleware, mounted at the router level so no privileged route can be added later
without a trail.

---

## 16. The mobile app

One Capacitor project (`com.tnpscmentor.app`) produces both Android and iOS from
the same `dist/`.

| Concern | Implementation |
|---|---|
| Google sign-in | `@capgo/capacitor-social-login`, **Google only** — bundling every provider would drag in the Facebook SDK and force an ATT prompt for an SDK the app never calls |
| Billing | `@capgo/native-purchases` → `/api/iap/verify` |
| Push | `@capacitor/push-notifications` → FCM / APNs |
| Deep links | `.well-known/assetlinks.json` (Android) and `apple-app-site-association` (iOS), served by Nginx with the right content type |
| Chrome | edge-to-edge, `contentInset: 'never'` on iOS, `env(safe-area-inset-*)` in CSS with `viewport-fit=cover` |
| Screen security | copy guard app-wide, screen security on exam screens |
| WebView escape hatch | Google sign-in is blocked inside in-app WebViews (Meta ad browsers), so the app detects the WebView proactively and offers "open in browser" |

### Live updates (OTA)

`@capgo/capacitor-updater` asks **our own server** for a newer `dist` zip,
downloads it in the background, and swaps it in the next time the app goes to
background. Capgo's cloud is not involved (`statsUrl: ''`).

```
device foreground ─▶ POST /api/app/web-bundle/check
                     server (lib/webBundles.ts): pick by
                       • min app version window
                       • rollout % (stable hash of the install id — raising the
                         percentage only ever ADDS devices)
                     ◀─ { version, url, checksum }  |  { version: 'builtin' }  |  up_to_date
download in background ─▶ swap at next backgrounding (never mid-session)
boot fails to call notifyAppReady() within 15 s ─▶ plugin rolls back by itself
```

Ships live: screens, components, copy, styles, bug fixes, client-side taxonomy.
Needs a store release: a new plugin, a permission, `targetSdk`, `versionCode`,
splash/icon. `resetWhenUpdate: true` means a store update wipes downloaded
bundles, so an old bundle can never sit on top of a newer binary.

Cut a bundle with `npm run build && npm run bundle:pack 2.0.6+w1`, then upload it
in **Superadmin → App → Live updates**. Roll back by **pausing** the bundle
(deleting also removes the zip, so a download in flight would fail).

Release signing uses `tnpsc-release-2026.keystore` with credentials from
`android/keystore.properties`; Play re-signs with its own certificate, which is
the SHA-1 that must be registered for Google OAuth to work in production.

---

## 17. Deployment and operations

Everything runs on **one Hostinger VPS**; the database stays on Supabase Cloud.
Vercel and Render were removed.

```
tnpscmentors.in / www   → Nginx static  (/var/www/tnpsc)   marketing + SPA
app.tnpscmentors.in     → Nginx static  + /api/ reverse-proxy to 127.0.0.1:4000
                          (this subdomain is deliberately noindex)
Express API             → PM2 cluster, 4 instances, cwd server/, script dist/index.js
                          NODE_ENV=production set by the ecosystem config
```

### Redeploy

```bash
cd /var/www/tnpsc-app/tnpsc-mentor
git pull
bash deploy/deploy.sh
```

`deploy.sh`: `npm ci --omit=optional` (skips the Capacitor/Android packages) →
reinstall the matching `@rollup/rollup-linux-x64-gnu` binary with
`--no-save --no-package-lock` (the flag combination matters: without
`--no-package-lock` npm rewrites the lockfile, the checkout stays dirty, the next
`git pull` fails **silently**, and the deploy then rebuilds stale source while
looking successful) → `npm run build` → `rsync --delete dist/ /var/www/tnpsc/`
→ build the API → `pm2 reload tnpsc-api` → poll `/api/health` for 15 s.

### Nginx notes

- Full CSP and `Permissions-Policy` on both server blocks, allow-listing exactly
  Clarity, Google (accounts/GTM/analytics), Razorpay, Meta, Supabase frames and
  YouTube-nocookie.
- `try_files $uri $uri/ /index.html` for SPA routing; `/assets/` is
  immutable-cached and 404s rather than falling through.
- The **live** Nginx config is certbot-drifted. Edit it in place on the box with
  `sed`; never `cp` `deploy/nginx-tnpsc.conf` over it, or you drop the TLS
  blocks certbot added.

### Environments

| Var | Where | Notes |
|---|---|---|
| `VITE_API_URL` | frontend build | the **only** backend config the SPA has |
| `SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY` | `server/.env` | never leaves the server |
| `RAZORPAY_KEY_ID` / `_SECRET` | `server/.env` | unset → `/api/payments/*` returns 503 |
| `SUPABASE_DB_*` | `server/.env` | direct pg pooler, for `run-migration.mjs` |
| `SECURITY_ALERT_CHAT_ID`, Telegram bot token | `server/.env` | breach + error paging |
| MSG91 / AiSensy keys, VAPID pair, FCM/APNs creds, `GOOGLE_CLIENT_ID` | `server/.env` | |

Local dev: `npm run dev` (5173) + `cd server && npm run dev` (4000, or 4400 via
`.env.local`).

---

## 18. Security posture

1. **No Supabase keys in the browser.** The SPA knows one env var.
2. **Column-level grants** hide `correct_answer` and `explanation` from the
   client role entirely.
3. **SECURITY DEFINER RPCs** are the only route to quiz questions, grading,
   revision and the admin bank; the delivered quiz pool has the answer fields
   stripped, and a server-side `QUIZ_BLOCKED_CATEGORIES` backstop keeps paid and
   admin banks off the generic route regardless of which migration of the RPC is
   live.
4. **Server-side grading.** `submit_test` derives the total from rows that join
   real questions, so a forged `total_questions` cannot fake a score.
5. **Server-side pricing and entitlements.** The plan is re-derived from the
   server catalogue (web) or from the verified receipt (mobile); the client
   amount is ignored for known plans.
6. **Charge-at-start credits** — the free gate cannot be bypassed with a forged
   submit payload, and each start is a reservation.
7. **Role enforcement in two places** — API middleware and database policies.
8. **Device cap bound to the signed GoTrue `session_id`**, not a client string.
9. **Auth hardening** — 30 req/min on `/api/auth`, password floor + HIBP check,
   opt-in TOTP MFA for staff, dual-mode refresh token (HttpOnly cookie on web,
   body on native).
10. **Audit trail** — every privileged call recorded in `audit_log`, retention
    enforced (90 days technical/security, 400 days admin trail).
11. **Copy guard** in the installed app, screen security on exam screens,
    proctoring violation tracking.
12. **Compliance** — DPDP breach detection and response, public privacy /
    guidelines / payment / refund / account-deletion pages, and a Play-compliant
    data-safety posture. `/delete-account` is public and needs no install, which
    is Google Play's User Data policy requirement.

---

## 19. Observability, audit, breach response

- **`requestLog`** writes an access log for every request and runs live 403 /
  429 / 5xx detectors. Mounted before the routes so it sees everything, and it
  reports on `finish` so `req.userId` is populated by then.
- **`securityAlerts`** pages a Telegram chat on unhandled exceptions (immediately
  on the first crash of a given route+error, not only when the 25-in-5-minutes
  spike threshold trips), DB statement timeouts, exhausted Supabase-fetch retries,
  infra degradation, and free 100%-coupon unlocks. If `SECURITY_ALERT_CHAT_ID` is
  unset the API logs a warning at boot: detectors still write to `audit_log`, but
  nobody is paged.
- **`/api/client-errors`** receives frontend crashes with the React component
  stack and feeds the same Telegram stream.
- **`startAuditRetention()`** runs on boot and enforces the retention the privacy
  policy states.
- **`docs/BREACH_RESPONSE.md`** is the DPDP playbook.
- **Analytics**: GTM + GA4, Meta Pixel, Microsoft Clarity. SPA page-views are
  reported **manually** on every route change (`trackPageView`) because GTM only
  fires once on the initial HTML load. GA4 User-ID is kept in sync with the
  signed-in user through an `authStore` subscription.

---

## 20. Known drift and gotchas

Things that are true but not obvious, and will cost time if rediscovered:

| Area | The gotcha |
|---|---|
| **`README.md`** | Predates most of the app. It still says an 80% attendance gate and a 15 s per-question minimum; the real values are **25%** and **7 s**, and premium is **180 days**, not 90. Trust the code. |
| **`supabase/schema.sql`** | Superseded by ~90 feature files. Production has drifted; `schema.sql`'s `create table` is the 2026-06 shape, not today's. |
| **Nginx** | The live config is certbot-drifted. `sed` on the box; never `cp` the repo copy over it. |
| **Bank reloads** | Never delete-and-reinsert. FKs are `CASCADE`/`SET NULL` and will eat user history. `UPDATE` by `external_id`. |
| **Figure crops** | Scanned crops can include the printed answer key. Look at every one before upload. |
| **Rate limits** | Per-process, and PM2 runs 4 instances — effective limits are up to 4× the configured `max`. |
| **`/topic-access`, `/subject-access`** | Vestigial. They always answer "no locks"; credits replaced them. |
| **Thirukkural + Daily CA** | Do **not** go through `submit_test`. Three graders exist. |
| **Older Android builds** | Have no OTA, so they never send `series` — which is exactly why `g1_marathon` is the server-side default. |
| **`questions_backup`** | Holds the retired `samacheer` and old `vettri` banks. The Samacheer route still exists for direct/admin access. |
| **Uncommitted work** | At the time of writing, the CA-WhatsApp feature (`server/src/routes/caWhatsapp.ts`, `src/components/Materials/CaWhatsappDialog.tsx`, `supabase/ca_whatsapp.sql`) is untracked, and `server/src/index.ts`, `src/lib/api.ts` and `src/pages/SuperAdminPage.tsx` are modified. |
| **Signup funnel** | Attempt volume fell ~90% through late August. The HIBP-check bug that caused the initial collapse is fixed and shipped; what remains is a traffic/funnel problem, not a code one. |

---

## 21. Where to look for what

| I want to change… | Start here |
|---|---|
| A route or the app shell | `src/App.tsx`, `src/components/Layout/AppLayout.tsx` |
| The API client / any endpoint call | `src/lib/api.ts` (one typed surface, ~100 KB) |
| Test state, timing, the attendance gate | `src/store/quizStore.ts`, `src/lib/submitTest.ts` |
| Which questions a test draws | `server/src/routes/questions.ts` + `supabase/secure.sql` (`get_quiz_questions`) |
| Grading | `supabase/secure.sql` → `submit_test` (nothing else grades) |
| The mock blueprint | `GROUP_SLOTS` in `server/src/routes/questions.ts` |
| Proctoring | `src/hooks/useProctoring.ts`, `src/lib/proctor.ts` |
| Credits | `server/src/lib/credits.ts`, `supabase/credits.sql` |
| Prices, validity windows, attempt caps | `server/src/pricing.ts` |
| Who has access to what | `server/src/lib/premium.ts` (`bundleAccess`) |
| Payments | `server/src/routes/payments.ts`, `routes/iap.ts`, `routes/coupons.ts` |
| Auth, devices, MFA | `server/src/routes/auth.ts`, `server/src/sessions.ts`, `src/store/authStore.ts` |
| Roles and gates | `server/src/middleware/auth.ts`, `src/components/Layout/ProtectedRoute.tsx` |
| Revision scheduling | `server/src/lib/revision.ts`, `supabase/revision_topics.sql` |
| Test-series products | `server/src/lib/testSeriesCatalog.ts` |
| Feature flags | `src/lib/features.ts` (compile-time), `app_settings` (runtime) |
| Translations | `src/lib/i18n.ts` |
| Design tokens / theme | `tailwind.config.js`, `src/index.css`, `design-system.md` |
| Native config | `capacitor.config.ts`, `android/`, `ios/` |
| OTA bundles | `server/src/lib/webBundles.ts`, `scripts/pack-web-bundle.mjs`, `docs/LIVE-UPDATES.md` |
| Deployment | `deploy/deploy.sh`, `deploy/nginx-tnpsc.conf`, `deploy/ecosystem.config.cjs` |
| Schema for a feature | `supabase/<feature>.sql` — **not** `schema.sql` |
| Applying a migration | `node server/run-migration.mjs supabase/<file>.sql` |
