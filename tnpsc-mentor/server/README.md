# TNPSC Mentors — API server

The Express + TypeScript API layer. It is now the **single trusted client** in
front of the Supabase Postgres database: the browser talks only to this server,
and the Supabase keys live exclusively here.

## Why this layer exists

The frontend used to call Supabase directly from the browser. It now calls this
API, which:

- **Owns auth** — `/api/auth/*` wraps Supabase Auth (GoTrue), issuing the access
  + refresh tokens the SPA stores.
- **Forwards the user's identity** — every data route builds a request-scoped
  Supabase client carrying the caller's access token, so the existing
  Row-Level-Security policies and `auth.uid()`-based SECURITY DEFINER RPCs work
  **unchanged**. No SQL was rewritten.
- **Hides the service-role key** from the browser.

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in the values below
npm run dev               # http://localhost:4000
```

`.env`:

| Var | What |
| --- | --- |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Vite dev origin, e.g. `http://localhost:5174` (comma-sep for multiple) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Project anon key (used for the auth flows) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **server only**, never the browser |

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` `/register` `/refresh` `/forgot-password` `/logout` | Auth |
| GET | `/api/auth/me` | Re-hydrate session from a stored token |
| POST | `/api/questions/quiz` | Safe quiz questions (no answers) |
| POST | `/api/questions/topics` | Distinct Samacheer/Current-Affairs topics |
| POST | `/api/tests/submit` | Server-graded test submission |
| GET/POST | `/api/reviews/due` `/count` `/enqueue` `/grade` | Spaced revision |
| GET/POST/DELETE | `/api/bookmarks` … | Saved questions |
| GET/PATCH/POST | `/api/profile` `/percentile` `/activity` | Profile + streaks |
| GET | `/api/analytics` | Insights data |
| POST/DELETE | `/api/admin/questions…` | Admin question bank (is_admin gated) |

## Scripts

- `npm run dev` — watch-mode dev server (tsx)
- `npm run build` — compile to `dist/`
- `npm start` — run the compiled server
- `npm run typecheck` — type-only check
