# TNPSC Mentor — File Structure & Architecture

> A bilingual (English / Tamil) TNPSC exam-preparation app. React + TypeScript SPA
> on the frontend, an Express API in the middle, and Supabase (Postgres + Auth) as
> the data layer. The same web build is wrapped with Capacitor to ship an Android APK.

---

## 1. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                    │
│                                                                        │
│   Browser (Vite SPA)            Android app (Capacitor wraps dist/)    │
│         │                                  │                           │
│         └──────────────┬───────────────────┘                          │
│                        │  HTTPS, Authorization: Bearer <access token>  │
└────────────────────────┼──────────────────────────────────────────────┘
                         │
                ┌────────▼─────────┐
                │   Express API     │   server/  (Node ≥20, TypeScript)
                │   /api/*          │   - auth, rate limiting, CORS, helmet
                │                   │   - owns the Supabase service-role key
                └────────┬─────────┘
                         │  supabase-js (service role) + RPCs
                ┌────────▼─────────┐
                │     Supabase      │   Postgres + Auth + Row Level Security
                │  (cloud)          │   tables, SQL RPC functions
                └───────────────────┘
```

Key decisions:

- **The browser never talks to Supabase directly.** `src/lib/api.ts` is the only
  data gateway; it owns access/refresh tokens, token refresh, and every call. This
  keeps the Supabase service-role key server-side only.
- **Auth** is JWT bearer tokens (no cookies → smaller CSRF/attack surface). Email/
  password + Google sign-in (web and native).
- **Deployment:** push to `main` → Vercel auto-deploys the frontend, Render
  auto-deploys the API. The API runs on Render's free tier, so the app pings
  `/api/health` on boot (and a GitHub Actions cron keeps it warm) to dodge cold starts.

---

## 2. Repository layout (monorepo root)

The git repo is `TNPSC-Academy/`; the app lives in `tnpsc-mentor/`. The outer
`TNPSC/` workspace folder also holds raw question-bank source data used by scrapers.

```
TNPSC/                                # workspace root (data + tooling, not the app)
├── AllYears/  pyq_all/  rewritten/   # raw / processed question banks (source PDFs, JSON)
├── Current_affairs_10Months/         # current-affairs source material
├── Thirukural/  solutions/  schema/  # reference data + worked solutions + DB schema notes
├── by_topic/  history/  latest/      # topic-sliced and dated question dumps
├── design-system.md                  # product design language (de-cardified, list-led)
└── TNPSC-Academy/                    # ← the git repository
    ├── render.yaml  vercel.json      # deploy configs (root-level)
    ├── context.md                    # project brief / context
    └── tnpsc-mentor/                 # ← the application (frontend + server)
```

---

## 3. Application root — `tnpsc-mentor/`

```
tnpsc-mentor/
├── src/                  # React SPA source (see §4)
├── server/               # Express API source (see §5)
├── supabase/             # SQL migrations & RPC definitions (see §6)
├── android/              # Capacitor-generated native Android project
├── dist/                 # Vite build output (also the Capacitor webDir)
├── public/               # static assets served as-is (favicon.svg, sw.js service worker)
├── assets/               # app icons / logo source for capacitor-assets
├── scrapers/             # Python question-bank scrapers & data tooling (see §7)
├── docs/                 # handover docs, deploy guides, import formats (this file lives here)
├── legal/                # privacy policy / terms pages
│
├── index.html            # SPA entry HTML
├── vite.config.ts        # Vite + React build config
├── tailwind.config.js    # design tokens (violet accent, light/dark CSS vars)
├── postcss.config.js
├── tsconfig.json / tsconfig.node.json
├── capacitor.config.ts   # appId com.tnpscmentor.app, webDir=dist, Google auth plugin
├── package.json          # frontend deps (React 18, react-router 6, zustand, motion, lucide)
├── .env / .env.example / .env.production   # VITE_API_URL, VITE_GOOGLE_CLIENT_ID, etc.
├── render.yaml / vercel.json
└── tnpsc-release.keystore # Android release signing key
```

**Frontend stack:** React 18 + TypeScript, Vite 5, React Router 6, Zustand (state),
Motion (animations), Lenis (smooth scroll), Tailwind CSS, lucide-react (icons),
jsPDF + html2canvas (PDF export), Capacitor 6 (Android wrapper).

---

## 4. Frontend source — `src/`

```
src/
├── main.tsx              # ReactDOM root: ErrorBoundary → BrowserRouter → App
├── App.tsx               # route table, lazy code-splitting, page transitions, boot
├── index.css             # global styles + Tailwind layers
├── vite-env.d.ts
│
├── pages/                # one component per route (lazy-loaded chunks)
├── components/           # reusable UI, grouped by domain
├── store/                # Zustand stores (global client state)
├── hooks/                # custom React hooks
├── lib/                  # framework-agnostic logic & the API client
├── types/index.ts        # shared TypeScript domain types
└── __tests__/            # Vitest unit tests
```

### 4.1 Routing & bootstrapping (`App.tsx`)

- **Route-based code splitting:** every page is `lazy()`-imported so the initial
  download stays small (~30 pages otherwise). Likely-next pages are prefetched
  during browser idle.
- **`PROTECTED_ROUTES`** table maps each authenticated path to its component and an
  optional required `role` (`admin` / `superadmin`), all wrapped in `<ProtectedRoute>`.
- On mount: init theme store, `warmApi()` (wake the sleeping API), and `init()` the
  auth session.
- `RootRedirect` sends logged-in users to `/test-arena`, others to `/login`.
- Cross-fade page transitions via Motion's `AnimatePresence` (honours
  `prefers-reduced-motion`).

### 4.2 `pages/` — screens (each = one route)

| Area | Pages |
|------|-------|
| **Auth / onboarding** | `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `CompleteProfilePage`, `LanguageScreen`, `LandingPage`, `SetupPage` |
| **Test selection** | `TestArenaPage` (home), `PreviousYearPage`, `HistoryPeriodsPage`, `PyqAptitudePage`, `SamacheerPage`, `SubjectPracticePage`, `CurrentAffairsPage`, `AptitudePage` |
| **Quiz flow** | `QuizInstructionsPage` → `QuizPage` → `ResultPage` |
| **Mock tests** | `MockTestPage` → `MockInstructionsPage` → `MockQuizPage` |
| **Study tools** | `DailyPage`, `RevisionPage`, `BookmarksPage`, `InsightsPage` |
| **Account** | `ProfilePage` |
| **Admin** | `AdminQuestionsPage`, `AdminReportsPage` (role: admin) |
| **Superadmin** | `SuperAdminPage` (role: superadmin) — metrics, users, feedback |

### 4.3 `components/` — UI building blocks (grouped by domain)

```
components/
├── UI/          # primitives: PillButton, ListRow, PremiumCard, ProgressBar,
│                #   CircularProgress, ConfirmDialog, Spinner, Timer, Toaster,
│                #   StatStrip, SectionHeader, IconTile, PasswordInput, …
├── Layout/      # AppLayout, ProtectedRoute, NotificationBell, PickerPage
├── Auth/        # AuthShell, GoogleSignInButton, DeviceLimitModal, AuthDivider
├── Quiz/        # QuestionCard, QuestionStem/Figures, OmrBubbles, OmrOptions,
│                #   OptionButton, WorkedSolution, ResultCard, ScreenGuard (proctoring),
│                #   QuizDialogs, ReportQuestionModal
├── Admin/       # BulkImportPanel, QuestionEditor, ReportedQuestions
├── revision/    # RevisionCard, TopicRevisionSection, RevisionAnalyticsPanel
├── Feedback/    # FeedbackModal
├── Thirukural/  # ThirukuralModal (1330-kural reference popup)
└── (root)       # ErrorBoundary, Mascot, RewardOverlay, StreakCalendar,
                 #   ScrollToTop, SmoothScroll, badgeIcons
```

### 4.4 `store/` — Zustand global state

| Store | Responsibility |
|-------|----------------|
| `authStore` | session, user, role, login/logout, session bootstrap |
| `languageStore` | EN / Tamil / bilingual display preference |
| `themeStore` | light/dark theme, OS sync |
| `quizStore` | active practice-quiz state |
| `mockQuizStore` | active mock-test state (OMR, proctoring) |
| `progressStore` | streaks, daily activity, gamification |
| `premiumStore` | premium/feature-gating flags |
| `notificationStore` | in-app notification feed / bell |
| `toastStore` | transient toast messages |

### 4.5 `hooks/`

- `useAuth` — auth state convenience hook
- `useQuiz` — quiz session orchestration
- `useStartTest` — builds quiz config and navigates into a test
- `useProctoring` — fullscreen + visibility/violation tracking for mock tests

### 4.6 `lib/` — logic & integrations

- **`api.ts`** — the single API client. Token store (`tnpsc_access_token` /
  `tnpsc_refresh_token` in localStorage), refresh logic, `warmApi()`, typed
  request helpers. **Supabase is not imported here or anywhere in the frontend.**
- **Domain logic:** `fetchQuestions`, `submitTest`, `abandonTest`, `srs` (spaced
  repetition), `revisionTime`, `achievements`, `game`, `habit`, `bookmarks`,
  `proctor`, `seen`-handling.
- **Integrations / platform:** `nativeAuth` (Capacitor Google), `razorpay`,
  `push` (Web Push), `device` (device id for the 2-device login cap), `safeStorage`.
- **Content / export:** `pdfGenerator`, `explanationPdf`, `aptitudeSolution`,
  `thirukural`, `i18n`, `assets`, `constants`, `features`, `motion`, `analytics`,
  `importQuestions`, `authRouting`, `authValidation`.

### 4.7 `types/index.ts` — shared domain model

Core entities: `Question`, `Profile`, `TestSession`, `TestAnswer`, `QuizConfig`,
`SubmitResult`, `GradedResult`, `ResultPayload`, `MockBlueprint`/`MockSlot`,
`RevisionTopic`/`RevisionAnalytics`, `Kural`, match/assertion question shapes.

Key unions: `Category` (`pyq | samacheer | current_affairs | aptitude | outer |
subject`), `UserRole` (`user | admin | superadmin`), `Difficulty`, `DisplayLang`
(`en | ta | both`), `GroupType`, `SubjectQType`, `RevisionStatus`, `AnswerLetter`.

---

## 5. Backend API — `server/`

```
server/
├── src/
│   ├── index.ts            # Express app: helmet, CORS, rate limits, route mounting
│   ├── config.ts           # env loading + isAllowedOrigin() wildcard CORS matcher
│   ├── supabase.ts         # supabase-js client (service-role key)
│   ├── sessions.ts         # device-session / 2-device-limit logic
│   ├── notify.ts           # Web Push (VAPID) sender
│   ├── pricing.ts          # payment/pricing helpers
│   ├── util.ts             # shared helpers
│   ├── middleware/
│   │   └── auth.ts         # bearer-token verification, role gating
│   ├── lib/
│   │   ├── revision.ts     # revision-topic scheduling logic
│   │   └── seen.ts         # seen-questions (no-repeat) sampling
│   └── routes/             # one router per /api/* namespace (see table)
├── dist/                   # compiled JS (tsc output, what Render runs)
├── *.mjs                   # one-off data ops: import_*, load-*, run-migration,
│                           #   backfill, backup-and-purge, restore, etc.
├── package.json / tsconfig.json
└── .env / .env.example
```

### 5.1 API surface (`index.ts`)

Global middleware: `trust proxy = 1` (Render edge), `helmet`, CORS via
`isAllowedOrigin` (supports `*` Vercel preview wildcards, no credentials),
`express.json({ limit: '2mb' })`, rate limits (300/min global, 30/min on `/api/auth`).

| Mount | Router | Purpose |
|-------|--------|---------|
| `/api/health` | — | liveness ping (used to warm the container) |
| `/api/auth` | `auth.ts` | email/password, Google, refresh, device sessions |
| `/api/questions` | `questions.ts` | fetch quiz questions, RPC-backed sampling |
| `/api/tests` | `tests.ts` | start / submit / abandon test sessions |
| `/api/reviews` | `reviews.ts` | SRS review items |
| `/api/revisions` | `revisions.ts` | topic-revision scheduling |
| `/api/bookmarks` | `bookmarks.ts` | saved questions |
| `/api/profile` | `profile.ts` | user profile CRUD |
| `/api/analytics` | `analytics.ts` | insights / progress data |
| `/api/admin` | `admin.ts` | question management, bulk import (role: admin) |
| `/api/superadmin` | `superadmin.ts` | metrics, users, feedback (role: superadmin) |
| `/api/feedback` | `feedback.ts` | app feedback + question error reports |
| `/api/payments` | `payments.ts` | Razorpay order/verify/ledger (503 if unconfigured) |
| `/api/coupons` | `coupons.ts` | coupon codes |
| `/api/notifications` | `notifications.ts` | Web Push subscribe + in-app feed |
| `/api/thirukural` | `thirukural.ts` | 1330-kural reference data |

Feature flags from env gate optional capabilities: `razorpayEnabled`,
`googleEnabled`, `pushEnabled` (each returns 503 when its keys are absent so the
server still boots).

**Backend stack:** Express, `@supabase/supabase-js` (service role), helmet,
express-rate-limit, cors, web-push, dotenv.

---

## 6. Data layer — `supabase/`

Plain `.sql` files applied via `server/run-migration.mjs` (direct Postgres pooler).
`schema.sql` is the base; the rest are incremental migrations / RPC definitions.

**Core tables:** `profiles`, `questions`, `test_sessions`, `test_answers`,
`review_items`, `daily_activity`.

**Feature tables:** `bookmarks`, `revision_topics`, `seen_questions`,
`user_sessions` (device limit), `notifications` / `notification_reads` /
`push_subscriptions`, `payments`, `coupons`, `app_feedback`,
`question_reports` / `question_report_status`, `explanation_feedback`.

**Notable SQL:** `mock_rpcs.sql` (mock-test slot sampling), `subject_bank.sql`
(Subject→Topic→Type flow), `secure.sql` / RLS policies, `superadmin.sql`
(role hierarchy), `seen_questions.sql` (unseen-first sampling), `revision_topics.sql`.

Question bank is partitioned by `category`: `pyq` (previous-year), `subject`
(restructured practice bank), `current_affairs`, `aptitude`, `outer` (admin-only),
`samacheer` (legacy, in `questions_backup`).

---

## 7. Tooling & native

- **`scrapers/`** — Python pipeline that builds the question bank: source scrapers
  (`pyq_scraper`, `current_affairs_scraper`, `samacheer_scraper`, `aptitude_scraper`,
  several site-specific ones), processors (`dedupe`, `consolidate`, `paraphrase`,
  `translate_to_tamil`, `generate_explanations`, `build_why_wrong`), and uploaders
  (`upload_to_supabase`, `export_questions`, `make_pdfs`). Run independently of the app.
- **`android/`** — Capacitor-generated Gradle project. The web `dist/` is the
  `webDir`; build produces `TNPSC-Mentor-{debug,release}.apk`. Google auth via
  `@codetrix-studio/capacitor-google-auth`. Signed with `tnpsc-release.keystore`.
- **`public/sw.js`** — service worker (Web Push / offline shell).
- **`docs/`** — `HANDOVER-CLIENT.md`, `HANDOVER-DEVELOPER.md`, `DEPLOY-*.md`,
  `IMPORT-FORMAT.md`, `PROJECT-OVERVIEW.md`, `APPLICATION-STRUCTURE.md`.

---

## 8. Request lifecycle (example: taking a practice test)

1. User picks a category/subject on `TestArenaPage` → `useStartTest` builds a
   `QuizConfig` and navigates to `/quiz/instructions` → `/quiz`.
2. `QuizPage` (via `quizStore` / `fetchQuestions` / `lib/api.ts`) calls
   `GET /api/questions` with a bearer token.
3. The API's `auth` middleware verifies the token, then `questions.ts` calls a
   Supabase RPC (`get_quiz_questions`) that applies **unseen-first** sampling
   (`seen.ts` + `seen_questions` table) and returns the slice.
4. User answers; on submit `submitTest` → `POST /api/tests` writes `test_sessions`
   + `test_answers`, updates SRS (`review_items`), streaks (`daily_activity`), and
   may queue a low-score topic for revision (`revision_topics`).
5. `ResultPage` renders the graded result; PDF export available via `lib/pdfGenerator`.

---

## 9. Build & deploy

| Concern | Frontend | Backend |
|---------|----------|---------|
| Build | `npm run build` (`tsc && vite build` → `dist/`) | `tsc` → `server/dist/` |
| Host | Vercel (auto-deploy on push to `main`) | Render (auto-deploy on push to `main`) |
| Config | `vercel.json`, `vite.config.ts` | `render.yaml`, env vars on Render |
| Mobile | `npx cap sync` → Android Studio / Gradle → signed APK | n/a |

Live URLs are dashboard-only; there are no deploy CLIs. The API's free-tier cold
start is mitigated by `warmApi()` on boot plus a keep-alive GitHub Actions cron.
