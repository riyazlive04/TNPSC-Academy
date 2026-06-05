# ✳ TNPSC MENTOR

A production-grade TNPSC exam-preparation web app: authentication, a multi-category
timed test engine, score tracking, and gated PDF explanation downloads.

## Tech stack

- **React 18 + Vite + TypeScript**
- **Tailwind CSS** (strict TNPSC palette — navy `#0D47A1`, yellow `#FFC107`)
- **Supabase** for auth + Postgres (self-hosted compatible)
- **Zustand** state, **React Router v6**, **jsPDF**, **Lucide** icons
- Fonts: Rajdhani (headings), Inter (body), Noto Sans Tamil (Tamil)

## Getting started

```bash
cd tnpsc-mentor
npm install

# Configure Supabase
cp .env.example .env
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...

npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Database

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It
creates `questions`, `test_sessions`, `test_answers`, `profiles`, RLS policies,
the `handle_new_user` trigger, and a `role` column (`user` | `admin`).

Promote an admin:

```sql
update public.profiles set role = 'admin' where email = 'admin@tnpsc.app';
```

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

## Deployment (Hostinger VPS)

- `npm run build` → serve `dist/` with Nginx as static files.
- Self-hosted Supabase via Docker; point `VITE_SUPABASE_URL` at the Kong gateway
  (e.g. `https://api.yourdomain.com`).
