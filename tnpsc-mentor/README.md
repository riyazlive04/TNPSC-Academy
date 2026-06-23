# ✳ TNPSC MENTOR

A production-grade TNPSC exam-preparation web app: authentication, a multi-category
timed test engine, score tracking, and gated PDF explanation downloads.

## Tech stack

- **React 18 + Vite + TypeScript** (SPA frontend)
- **Express API** (`server/`) — the only client that talks to Supabase
- **Tailwind CSS** (strict TNPSC palette — navy `#0D47A1`, yellow `#FFC107`)
- **Supabase** for auth + Postgres (reached server-side only)
- **Zustand** state, **React Router v6**, **jsPDF**, **Lucide** icons
- Fonts: Rajdhani (headings), Inter (body), Noto Sans Tamil (Tamil)

## Architecture

The browser never holds Supabase keys. The SPA talks **only** to the Express
API, which in turn talks to Supabase:

```
SPA (React/Vite)  →  Express API (server/)  →  Supabase (auth + Postgres)
```

The frontend needs a single env var, `VITE_API_URL`, pointing at the Express
server. All Supabase credentials (URL, anon key, service-role key) live
exclusively in the server's environment.

## Getting started

```bash
cd tnpsc-mentor
npm install

# Configure the frontend: only VITE_API_URL is needed (see .env.example).
cp .env.example .env
#   VITE_API_URL=http://localhost:4000

npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

Then start the backend separately (its env lives in `server/.env` — see
[`server/.env.example`](server/.env.example)):

```bash
cd server
npm install
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGIN
npm run dev            # http://localhost:4000
```

## Database

Run these in the Supabase SQL editor, **in order**:

1. [`supabase/schema.sql`](supabase/schema.sql) — creates `questions`,
   `test_sessions`, `test_answers`, `profiles`, `review_items`,
   `daily_activity`, RLS policies, the `handle_new_user` trigger, and the
   `role` column (`user` | `admin`).
2. [`supabase/payments.sql`](supabase/payments.sql) — optional, for Razorpay.
   Creates the `payments` ledger (server-written, RLS-read). Run it before
   enabling payments; needs only the Razorpay env vars below to go live.
3. [`supabase/secure.sql`](supabase/secure.sql) — **required.** Hides the answer
   columns from the client (column-level grants) and adds the SECURITY DEFINER
   RPCs that are the only way to fetch quiz questions, grade a submission, run
   spaced revision, and read the admin bank. **Until this runs, the app's
   quiz/submit/revision flows will not work** (they call these RPCs), and answers
   would otherwise be readable in the browser.

Promote an admin:

```sql
update public.profiles set role = 'admin' where email = 'admin@tnpsc.app';
```

### Security model

Grading is server-side: the browser never receives `correct_answer` /
`explanation` during a test, and scores are computed by `submit_test` (they
can't be forged from the client). Explanations are returned only once the 80%
attendance gate is met.

## Payments (Razorpay)

Optional, and deliberately **model-agnostic** — it records payments without
granting any entitlement yet, so it can later become a one-time unlock, a
subscription, or per-item purchases with no change to the recording layer.

- **Flow:** SPA → `POST /api/payments/order` (server creates a Razorpay order +
  a `created` ledger row, returns the order and the *public* key id) → Razorpay
  Checkout opens in the browser → on success the SPA calls
  `POST /api/payments/verify`, where the server HMAC-verifies the signature and
  flips the row to `paid`. `GET /api/payments` lists the user's history.
- **Keys:** set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `server/.env`
  (see [`server/.env.example`](server/.env.example)). The secret never leaves
  the server; the browser only ever receives the public key id. With the keys
  unset, the `/api/payments/*` routes return `503` and the app runs normally.
- **Try it:** the Profile page has a "Support TNPSC Mentors" button that runs the
  full flow. Use Razorpay's test card `4111 1111 1111 1111`, any future expiry,
  any CVV.

## Roles

- **Aspirant (`user`)** — takes timed tests. Time = `questions × 45s`, a 15s
  minimum per question, and an 80% attendance gate that unlocks the explanation
  PDF.
- **Admin (`admin`)** — follows the *same* selection flow (Test Arena → category
  → subject/topic) but instead of attending the test lands on the full question
  bank with correct answers and explanations revealed (`/admin/questions`),
  with search.

## Routes

| Path | Page | Access |
|------|------|--------|
| `/` | → `/login` | public |
| `/login` | Login | public |
| `/register` | Register | public |
| `/forgot-password` | Forgot password | public |
| `/test-arena` | Test Arena (home) | protected |
| `/test-arena/pyq` | Previous Year (3 groups · 10 subjects) | protected |
| `/test-arena/samacheer` | Samacheer (subject → standard → topic) | protected |
| `/test-arena/current-affairs` | Current Affairs (month / topic) | protected |
| `/test-arena/aptitude` | Aptitude (numerics / reasoning) | protected |
| `/quiz` | Quiz engine | protected (users) |
| `/admin/questions` | Question bank | protected (admins) |
| `/result` | Result + PDF | protected |

## Content scrapers

```bash
cd scrapers
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt

python aptitude_scraper.py          # -> aptitude_questions.json
python current_affairs_scraper.py   # -> current_affairs_questions.json
python pyq_scraper.py               # -> pyq_questions.json

cp .env.example .env                # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
python upload_to_supabase.py        # bulk insert into the questions table
```

## Deployment (Vercel + Render)

- **Frontend → Vercel.** Build the SPA (`npm run build` → `dist/`) and deploy
  via [`vercel.json`](vercel.json). Set `VITE_API_URL` to your Render service URL.
- **Backend → Render.** Deploy the Express API in `server/` via
  [`render.yaml`](render.yaml); set its Supabase + `CORS_ORIGIN` env vars there.

See [`docs/DEPLOY-VERCEL-RENDER.md`](docs/DEPLOY-VERCEL-RENDER.md) for the
step-by-step walkthrough.
