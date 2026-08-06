# TNPSC Mentors — What the Application Does

_A complete functional description of the product: every surface a user can reach,
every rule the system enforces, and what runs behind each one._

_Written 2026-08-06 against the current working tree. Bank sizes are live counts
pulled from the production database on that date._

> Companion docs: [`PROJECT-OVERVIEW.md`](PROJECT-OVERVIEW.md) (mental model),
> [`APPLICATION-STRUCTURE.md`](APPLICATION-STRUCTURE.md) (code layout),
> [`ARCHITECTURE.md`](ARCHITECTURE.md), [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md),
> [`MOBILE_RELEASE.md`](MOBILE_RELEASE.md), [`DEPLOY-HOSTINGER.md`](DEPLOY-HOSTINGER.md).

---

## 1. In one paragraph

**TNPSC Mentors** is a bilingual (English / Tamil) exam-preparation platform for
candidates sitting the Tamil Nadu Public Service Commission exams (Group 1,
Group 2/2A, Group 4 & VAO). It ships as a web app (`tnpscmentors.in`) and as a
Capacitor-wrapped Android/iOS app from the same codebase. A learner picks a
practice scope — subject, topic, previous-year paper, current affairs, aptitude,
a full mock exam or a scheduled test-series paper — takes a **timed, server-graded
test**, and gets back a result page with the correct answer, a per-option
"why your answer was wrong" note, a written bilingual explanation, an optional
YouTube walkthrough, and a downloadable explanation PDF. Layered on top: a
credit-based free tier with two paid plans, spaced revision, a daily
current-affairs magazine and daily CA test, study materials, streaks and
achievements, push/in-app notifications, and a full admin + superadmin back
office for content, users, revenue and publishing.

---

## 2. Who uses it

| Role | What they get |
|------|---------------|
| **Aspirant** (`user`) | The whole learning product: practice, mocks, revision, insights, materials, purchases. |
| **Admin** (`admin`) | Same navigation, but every category lands on the **question bank with answers and explanations revealed** — browse, search, edit, bulk-import, and triage student-reported question errors. No aspirant gamification. |
| **Superadmin** (`superadmin`) | Everything an admin has, plus the platform console: metrics, revenue, users, coupons, notifications, alerts, feedback, exam catalogues, materials, CA publishing, and app releases. |

Roles nest — a superadmin inherits admin rights (enforced both in the API
middleware and in the database's `is_admin()`). An admin can flip a header
toggle to **preview the app as a student** without changing their real role.

---

## 3. Getting in

- **Email + password** sign-up and login, with a completion step for missing
  profile fields.
- **Google sign-in** — web OAuth, and native Google sign-in in the mobile apps.
  An email already registered with Google is routed back to the Google button
  instead of failing at the password step.
- **Phone OTP** login (MSG91) and **WhatsApp signup OTP** (AiSensy, official
  WABA) exist as alternate paths behind feature flags.
- **One account = one email = one phone.** Duplicate phone or email is rejected
  at signup.
- **Two-device cap.** A third login is blocked with a list of the active devices
  and a one-tap "sign that device out and continue".
- Sessions use short-lived Bearer access tokens with transparent refresh; the
  web client keeps its refresh token in an HttpOnly cookie, the native app in
  secure storage.
- Password reset by email; account deletion is requestable from a **public**
  `/delete-account` page (Google Play Data-safety requirement).

New accounts are armed with a first-run sequence: a **Starter Challenge**
prompt (an 18-question hard mixed paper), then a **guided spotlight tour** of the
dashboard, then a one-time "Test Marathon Paper 1 is free" promo.

---

## 4. The dashboard

The home screen (`/test-arena`) is the hub:

- Time-of-day greeting, first name, and a day-streak flame.
- **Kural of the day** — a rotating Thirukkural couplet in Tamil with the English
  meaning; tapping it opens the full 1,330-kural browser.
- **Current-affairs magazine carousel** — the last seven published daily issues.
- A **Starter Challenge hero** while the account has zero completed tests.
- One gradient hero card for **Mock Tests**, then a grid of practice entries:
  Daily CA Test, Vettri Nichayam, Test Marathon, Subject Practice, Previous Year
  Questions, Current Affairs, Aptitude, CA Questions, Thirukkural Quiz.
- A **credit wall** that appears only when the balance actually starts blocking
  practice — a quiet strip while low, the full plan cards at zero.
- "Keep going" shortcuts to Revision and Insights.

Bottom/side navigation: Home · Vettri · Test Marathon · Revision · Materials ·
Insights · Profile, plus a header credit pill, notification bell, language
switch (EN / தமிழ் / both) and light-dark theme toggle.

---

## 5. Practice modes

### 5.1 Subject Practice
Subject → Topic → Question type (five testable styles, plus "Mixed"). This is the
main study bank — the rewritten, topic-tagged content. Free users get one test per
subject before the premium lock; a 180-question cooldown stops recently-seen
questions coming back.

### 5.2 Previous Year Questions (PYQ)
A group chooser leads to three separate banks:

- **Group 1** — subject-wise (History & INM, Polity, Geography, TN History &
  Culture, TN Administration, Biology, Physics, Chemistry, Indian Economy,
  Aptitude), with History further split by period (Ancient / Medieval / Modern)
  and a dedicated aptitude entry.
- **Group 2 / 2A** — section-wise (Aptitude, English, Tamil, General Studies)
  → sub-type, with a year filter (2025, 2024, 2022, 2018, 2017, 2016, 2014).
- **Group 4 & VAO** — section-wise (Tamil, General Studies, Aptitude) with years
  2025, 2024, 2022, 2019, 2018.

Group 2 and Group 4 are driven by one generic page pair off a `PYQ_GROUPS`
registry, so adding a group is a data change. Scanned figures and option images
are served from storage where the original paper had them.

### 5.3 Current Affairs
Month-wise and topic-wise sets. Months come from the database, so a month pushed
by the CA generator pipeline appears without a redeploy. Free tier: one CA test
per topic.

### 5.4 Aptitude & Reasoning
Numerics and Reasoning sub-categories, each with its own topic list and live
per-topic counts. "Area and Volume" drills two levels deeper — section
(Perimeter / 2D / 3D) then shape (circle, square, sphere…). Aptitude explanations
are KaTeX-typeset, in the app and in the PDF.

### 5.5 Thirukkural Quiz
A self-contained bilingual bank: pick an adhigaram (chapter) and a question type,
then run the standard test flow.

### 5.6 Daily CA Test
A day-picker popup listing today's paper and every earlier published day. Each
day's set is played as a real graded test through its own quiz/grade pipeline.

### 5.7 CA Questions
Superadmin-published daily and monthly current-affairs sets in two tabs — **Quiz**
(played as a graded test) and **PDF** (one-tap download with answers and
explanations, watermarked with the downloader's identity).

---

## 6. The test engine

**Practice tests** (`/quiz/instructions` → `/quiz` → `/result`):

- Time budget = **45 seconds × question count** (per-mode overrides allowed);
  the clock is recomputed from the start timestamp, so closing the tab does not
  pause it, and an in-progress test survives a refresh.
- Answer, flag for review, jump between questions freely.
- **Answers and explanations are never in the browser during a test.**
- Submitting sends the answers to the server; the database function `submit_test`
  is the sole grader.
- **Attendance gate: 25%.** Attempt at least a quarter of the paper and the
  result reveals correct answers, explanations and the PDF; below that, the score
  only.
- Leaving mid-test records an `abandoned` session rather than vanishing.

**Result page:** score, accuracy, time, a per-question review with the correct
letter, the bilingual explanation, the per-wrong-option `why_wrong` rationale, an
embedded YouTube walkthrough where one exists, a bookmark toggle, a
"report an error in this question" action, and the explanation PDF.

**Mock exams** (`/mock` → `/mock/instructions` → `/mock/quiz`) use a separate
OMR-style engine:

- **Group Exam** — the TNPSC 2024/2025 blueprint (Group 1 Prelims: 100 questions,
  90 minutes, subject-wise slots pulled server-side).
- **Subject / Topic drill** — configurable count and difficulty.
- **Full Mock Exams** — six fixed 200-question bilingual papers.
- OMR bubble palette, fixed duration, optional negative marking, countdown
  warnings, and **proctoring**: fullscreen enforcement, screen-guard, and
  tab-switch / focus-loss violation tracking.
- Two attempts per fixed paper, enforced server-side.

---

## 7. Study loop features

| Feature | What it does |
|---|---|
| **Spaced revision (SRS)** | Wrong and bookmarked questions enter a review queue; the due deck is graded and rescheduled by the SRS algorithm. |
| **Topic revision** | Any topic test scoring ≤ 40% is auto-flagged. The re-test unlocks after 12 hours of *awake* time (IST sleep hours skipped) and uses similar, not identical, questions. Scoring above 40% clears the flag. |
| **Bookmarks** | Save any question and revisit it as a list. |
| **Seen questions** | A per-user ledger; sampling prefers unseen questions across quiz, subject-mock and mock-slot fetches — a soft de-prioritisation that never shortens a paper. |
| **Insights** | Accuracy ring, trend chart, per-subject and per-question-type breakdowns, streak stats, percentile against other users. |
| **Streaks & goals** | Daily-activity tracking on IST boundaries, a 7-day calendar, a daily question goal and exam-date countdown, editable from Profile. |
| **Achievements** | XP, levels and badges with a reward overlay on unlock. |
| **Question reports** | A student flags a wrong or unclear question; it lands in an admin triage queue, and resolving it notifies the reporters with superadmin-editable copy. |

---

## 8. Content beyond tests

- **Materials hub** — superadmin-curated videos, images, PDFs and documents in a
  private bucket served via signed URLs, with per-item download gating and
  placement control (materials page / profile).
- **CA magazine** — a daily current-affairs magazine with an in-app reader,
  bilingual, produced by an external VPS pipeline and published through a
  superadmin approve → Materials flow.
- **CA slides** — any magazine issue can be turned into a bilingual class deck
  (PPTX + PDF), generated browser-side from a shared layout model.
- **CA Telegram broadcast** — an issue can be pushed to the public channel as
  English and Tamil PDFs with editable captions and a brand watermark.
- **Study notes** — a superadmin-managed notes surface.
- **Explanation PDFs** — generated client-side with jsPDF, KaTeX-aware for
  aptitude, watermarked per downloader.

---

## 9. Monetisation

### Credits (the free tier)
- **50 credits** on signup, **+10 each IST day you log in** (the daily 10 expire
  at IST end-of-day), **+25** one-time when your first test is graded.
- **1 credit per question** — so a test costs its question count, which makes a
  full 200-question mock unaffordable on the free tier by design.
- Credits are **charged at test start**, atomically and server-side, so the gate
  cannot be dodged by a forged submit.
- A bilingual confirm popup shows the cost before every test; running out opens
  the upsell modal.
- Free users also get **1 mock exam ever** and **3 explanation-PDF downloads**.

### Paid plans
| Plan | Price | Window | What it unlocks |
|---|---|---|---|
| **Premium** | ₹1,699 | 90 days | Unlimited practice — no credits, no gates, unlimited PDFs. |
| **Vettri Nichayam (full)** | ₹899 | 60 days | The full flagship programme: the 13 Test-Marathon papers, unlimited PYQ and current affairs. |
| **Vettri Nichayam (monthly)** | ₹499 | 30 days | Half the programme; pay again to extend. |

- **Web payments: Razorpay.** Order → HMAC-verified signature → ledger row flips
  to `paid`. Prices live on the server, so a client cannot send a cheaper amount.
- **Mobile payments: Play Store / App Store IAP**, receipt-verified server-side,
  with the plan re-derived from the product id inside the verified receipt.
- **Coupons**, including a 100%-free path, validated server-side with exact
  matching.
- Entitlements are **derived from paid ledger rows** against each plan's own
  validity window — nothing is stored as a mutable "is premium" flag.
- A pre-payment confirmation popup runs on both plan cards; a forced upsell
  modal opens on out-of-credits, a locked mock, or a locked series paper.

### Test Marathon (Test Series)
A scheduled 13-paper Group 1 programme. Papers unlock by date, any paid bundle
grants access, superadmin can override the schedule, and each paper allows two
attempts. It has its own analytics tab: attempt score history, weak-area
breakdown by subject and derived question type, and practice deep-links.

---

## 10. Notifications and messaging

- **Web Push** (VAPID) and **native push** (FCM/APNs) for announcements and
  targeted messages, with a dashboard opt-in nudge.
- **In-app bell + feed** with read tracking, bilingual copy, and audience
  targeting (all / premium / a single user).
- **Popup alerts** — superadmin modal announcements shown once per account,
  typed as info / alert / update / success.
- Targeted nudges fire automatically for events like hitting the subject free
  gate, or 24 hours after signup without a first test.

---

## 11. Admin back office

**`/admin/questions`** — the question bank with answers and explanations visible:
search, filter by category and scope, inline edit, activate/deactivate, delete,
and bulk import from CSV/JSON (see [`IMPORT-FORMAT.md`](IMPORT-FORMAT.md)).

**`/admin/reports`** — the student question-report triage queue.

**`/superadmin`** — sixteen tabs:

| Tab | Purpose |
|---|---|
| Overview | Users, active today / 7-day, tests completed and abandoned, bank size, average rating, feedback count. |
| Revenue | Week / month / year / all-time revenue, paying customers, active premium, conversion, average order value, coupon orders, discounts, failed payments. |
| Users | Search and paging, user detail popup with per-user insights, plan badges, role changes, plan grant/revoke (a comped grant writes a ₹0 paid row), device-session listing and revocation, account deletion. |
| Coupons | Create, edit, copy, delete, with redemption stats. |
| Notifications | Compose and send push + in-app notifications by audience. |
| Feedback | The student feedback inbox. |
| Reports | Question-error reports and the editable "resolved" message. |
| Notes | Study-notes management. |
| Mock Exams | Enable/disable the fixed 200-question papers. |
| Test Series | The Test Marathon schedule and paper catalogue. |
| Vettri | The Vettri exam catalogue. |
| Materials | Upload and place videos, images, PDFs and documents. |
| CA Magazine | Review, edit and publish daily/monthly issues; Telegram broadcast. |
| CA Slides | Generate bilingual PPTX/PDF decks from an issue. |
| CA Questions | Publish daily and monthly question sets. |
| App | Android APK releases and the update prompt. |

Runtime feature flags (`mock_group_enabled`, `mock_subject_enabled`,
`test_series_enabled`, `vettri_enabled`, …) are superadmin-controlled rows, so
whole sections appear and disappear without a deploy.

---

## 12. The question bank

Live counts, production database, 2026-08-06:

| Bank | `category` | Rows |
|---|---|---:|
| Subject Practice (main study bank) | `subject` | 8,373 |
| Admin-only provenance bank (not served to students) | `outer` | 28,620 |
| Group 2 / 2A previous-year | `pyq2` | 2,099 |
| Test Marathon papers | `testseries` | 1,600 |
| Current Affairs | `current_affairs` | 1,710 |
| Aptitude & Reasoning | `aptitude` | 1,092 |
| Full mock exam papers (6 × 200) | `mock` | 1,200 |
| Group 4 & VAO previous-year | `pyq4` | 1,000 |
| Group 1 previous-year | `pyq` | 989 |
| **Total** | | **46,683** |

Plus 1,330 Thirukkural entries, 1,534 CA-magazine items and 56 published
materials. Legacy `samacheer` and the old `vettri` bank are retired to
`questions_backup` (the Samacheer route is kept for direct/admin access).

Every row carries: four options, the verified answer, a written explanation, a
per-wrong-option `why_wrong` map, difficulty, optional figure/option images, an
optional YouTube explanation URL, provenance (`source_tag`, `source_url`), and a
Tamil mirror of every text field. PYQ questions are stored **once** and surface
under any group whose syllabus includes that subject — membership by subject, not
a stored group.

---

## 13. How it is built

```
┌────────────────────┐   HTTPS + Bearer JWT   ┌──────────────────┐   service role   ┌──────────────────┐
│ SPA (React 18/Vite)│ ─────────────────────► │ Express API      │ ───────────────► │ Supabase Cloud   │
│ + Capacitor shell  │ ◄───────────────────── │ (TypeScript/ESM) │ ◄─────────────── │ Postgres·Auth·   │
│ VITE_API_URL only  │      JSON              │ holds all secrets│  SECURITY DEFINER│ Storage          │
└────────────────────┘                        └──────────────────┘  RPCs / RLS      └──────────────────┘
```

- **Frontend:** React 18 + Vite + TypeScript, React Router v6 with per-route code
  splitting and idle-time prefetch, Zustand stores (auth, quiz, mock quiz,
  credits, entitlements, theme, language, notifications, onboarding, upsell,
  progress, toast), Tailwind with CSS-variable design tokens and light/dark
  themes, `motion` for transitions, KaTeX for maths, jsPDF for PDFs, Vitest for
  unit tests.
- **Backend:** Express with helmet, an origin allow-list CORS policy, 300 req/min
  global and 30 req/min auth rate limits, request logging with live
  403/429/5xx detectors, and an audit-log middleware wrapping every admin and
  superadmin route.
- **API surface:** `/api/auth`, `/questions`, `/tests`, `/reviews`, `/revisions`,
  `/bookmarks`, `/profile`, `/analytics`, `/admin`, `/superadmin`, `/feedback`,
  `/payments`, `/iap`, `/coupons`, `/notifications`, `/alerts`, `/thirukural`,
  `/materials`, `/ca-magazine`, `/ca-questions`, `/ca-telegram`, `/credits`,
  `/app`, `/telegram`.
- **Mobile:** one Capacitor project (`com.tnpscmentor.app`) producing the Android
  and iOS builds from the same `dist/` — native Google sign-in, store billing,
  push, deep links, edge-to-edge chrome and screen-security.
- **Deployment:** a single Hostinger VPS — Nginx serves the built SPA and
  reverse-proxies `/api` to the Express API under PM2; the database stays on
  Supabase Cloud. Redeploy on-box with `git pull && bash deploy/deploy.sh`.
- **Analytics:** GTM + GA4, Meta Pixel and Microsoft Clarity, with SPA page-views
  reported manually on every route change.

---

## 14. Security posture

1. **No Supabase keys in the browser.** The SPA knows one env var, `VITE_API_URL`.
2. **Column-level grants** hide `correct_answer` and `explanation` from the client
   role entirely.
3. **SECURITY DEFINER RPCs** are the only route to quiz questions, grading,
   revision and the admin bank; the delivered quiz pool has the answer fields
   stripped.
4. **Server-side grading** — scores cannot be forged from the client.
5. **Server-side pricing and entitlements** — a tampered client cannot buy cheap
   or claim a plan; the plan is re-derived from verified receipts.
6. **Charge-at-start credits** — the free gate cannot be bypassed with a forged
   submit payload.
7. **Role enforcement in two places** — API middleware and database policies.
8. **Audit trail** — every privileged call is recorded in `audit_log`, with
   retention enforced at 90 days for technical/security logs and 400 for the
   admin trail, plus Telegram security alerts.
9. **Copy guard** in the installed app, screen-security on exam screens, and
   proctoring violation tracking during mocks.
10. **Compliance:** DPDP breach detection and response, public privacy /
    guidelines / payment / refund / account-deletion pages, cookie consent, and
    a Play-compliant data-safety posture.

---

## 15. Content pipeline

Raw sources (previous-year papers, textbooks, current-affairs feeds) are turned
into bank rows by Python scrapers and Node import scripts in `server/`
(`import_*.mjs`, `load-*.mjs`), which bulk-insert through the service-role client.
Explanations are model-authored through an author → verify pipeline and then
fact-checked; flagged defects are tracked in the `FLAGGED_*.md` files at the
project root. Schema changes run through `server/run-migration.mjs` against the
direct pg pooler, applying the SQL files in `supabase/`. A separate VPS pipeline
generates the daily current-affairs magazine and monthly CA question banks and
pushes them into the app for superadmin approval.
