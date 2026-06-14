# Deploy — Frontend on Vercel, Backend on Render

Architecture: **Vercel (React/Vite SPA)** → **Render (Express API)** → **Supabase Cloud** (Postgres/Auth/RLS).
The browser only ever talks to the Render API; Supabase keys live only on Render.

Repo root for both = this folder (`TNPSC-Academy/tnpsc-mentor`). The frontend is
the root; the backend is the `server/` subfolder. Config files are already in place:
`vercel.json` (SPA rewrites), `render.yaml` (API blueprint).

---

## 0. One-time: push to GitHub

Vercel and Render both deploy from a Git repo. From this folder:

```bash
git init
git add -A
git commit -m "TNPSC Mentor — deploy"
git branch -M main
git remote add origin https://github.com/<you>/tnpsc-mentor.git
git push -u origin main
```

`.env` files are gitignored — secrets are entered in each platform's dashboard, not committed.

---

## 1. Backend → Render (do this first; the frontend needs its URL)

**Option A — Blueprint (uses `render.yaml`):**
1. Render Dashboard → **New → Blueprint** → connect the repo.
2. Render detects `render.yaml` and proposes the `tnpsc-mentor-api` web service.
3. When prompted, fill the secret env vars (all `sync: false`):
   - `SUPABASE_URL` — `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN` — leave as a placeholder for now (e.g. `https://example.vercel.app`); update in step 3 once you have the real Vercel URL.
4. Create → wait for the build. Health check: `GET /api/health` → `{"status":"ok"}`.

**Option B — Manual web service:** New → Web Service → repo →
- **Root Directory:** `server`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- Add the 4 env vars above. (Do **not** set `PORT` — Render injects it.)

Note your API URL, e.g. `https://tnpsc-mentor-api.onrender.com`.

> Render Free tier sleeps after ~15 min idle; the first request then takes ~30–50s to wake. Upgrade to a paid instance for always-on.

---

## 2. Frontend → Vercel

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** `TNPSC-Academy/tnpsc-mentor` (or repo root if you pushed only this folder). Framework auto-detects as **Vite** (build `npm run build`, output `dist` — already in `vercel.json`).
3. **Environment Variables** → add:
   - `VITE_API_URL` = your Render URL from step 1 (e.g. `https://tnpsc-mentor-api.onrender.com`) — **no trailing slash, no `/api`**.
   - (Vite env vars are baked in at build time, so a change here requires a redeploy.)
4. Deploy. Note your URL, e.g. `https://tnpsc-mentor.vercel.app`.

---

## 3. Wire the two together (CORS) + Supabase Auth

1. **Render** → service → Environment → set `CORS_ORIGIN` to the exact Vercel URL
   (`https://tnpsc-mentor.vercel.app`). For PR previews, add them comma-separated.
   Save → Render redeploys.
2. **Supabase** → Authentication → URL Configuration:
   - **Site URL:** `https://tnpsc-mentor.vercel.app`
   - **Redirect URLs:** add the same (and any preview domains). This makes
     email-confirmation / password-reset links land back on the live app.

---

## 4. Smoke test

- `https://<render-url>/api/health` → `{"status":"ok"}`.
- Open the Vercel URL → register/login works (no CORS errors in the browser console).
- Test Arena → **Subject Practice** → pick a subject → topic → question type → take a test → submit → result.
- Current Affairs flow still works.
- Deep-link a route (e.g. `…/test-arena/subjects`) and refresh → loads (SPA rewrite OK).

---

## Redeploys & data

- **Code:** push to `main` → both platforms auto-deploy.
- **Env change:** Render redeploys on save; Vercel needs a redeploy for `VITE_API_URL` to take effect.
- **Data/DB migrations** are run from your machine (not the deployed server) using the
  `SUPABASE_DB_*` vars in `server/.env`: `node server/run-migration.mjs <file.sql>`,
  `load-subjects.mjs`, `backup-and-purge.mjs`. The deployed API never needs those.
