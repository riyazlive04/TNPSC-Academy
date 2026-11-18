# Public current-affairs archive

Status: LIVE 2026-11-18 — 3,887 pages; sitemap https://tnpscmentors.in/current-affairs/sitemap.xml (submit in Search Console)

## Purpose
- Same job as the PYQ archive (`scripts/qbank/`): win searches like "TNPSC current affairs 17 November 2026", "current affairs November 2026 Tamil", or a pasted CA question — and offer the app.
- CA is searched **by date**, not by paper/subject, so the tree is date-led.

## Live data (prod, 2026-11-18)
| Source | Rows | Published in app |
|---|---|---|
| `ca_magazine` day_wise | 3,368 items / 135 days (Jul 1 – Nov 18) | 105 days (`materials` kind=magazine) |
| `ca_magazine` month_wise | 2,156 items / 4 months | 4 |
| `ca_daily_questions` | 1,987 Qs / 135 days, 100% Tamil + explanation | 78 days (`materials` kind=questions, source=daily) |
| `questions` category=current_affairs | 2,550 Qs, Jul 2025 – Oct 2026 | served in-app, no materials row |

## Rules that make it logically correct
1. **Publication is the gate.** A day/set is public only if its `materials` row is `active`. 30 pushed-but-unapproved days stay private. Hide/remove in the console → page is gone at the next rebuild.
2. **Allow-list, like the PYQ build.** Only the sources chosen below are exported; anything else is off by default.
3. **Explanation past its opening never ships in HTML** (same policy as PYQ since dcbe5b4: the opening is given away). Unlock via the existing archive-explanation endpoint: a UUID id → `questions` (allow-list now incl. `current_affairs`), an integer id → `ca_daily_questions`, served only while that day's set is published. The two id shapes never overlap, so no source param.
4. **No The Hindu imagery** on public pages (pipeline `newsimage_*.jpg` are e-paper crops). Our own OG card only. No "The Hindu" credit anywhere (existing de-branding rule).
5. **Section echo items** (`TNPSC BITS` round-up whose title == section) render without the duplicate heading; `TNPSC BITS` displays as `TNPSC CABITS`. Same logic as `src/lib/caMagazine.ts` (`isSectionEcho`, `sectionLabel`) — reused, not re-invented.
6. **Know level**: show the badge when set; NULL renders nothing (unreviewed ≠ "good").
7. **Dates are the paper's date** (`date` column, IST); no timezone arithmetic at render.
8. **No duplicate content**: day pages are canonical for news items. The monthly compilation is a re-cut of the same items, so it is NOT published as a second copy (it stays the in-app PDF product).
9. **URL space**: `/questions/current-affairs/` is already the PYQ subject page; the SPA's CA hub is `/test-arena/current-affairs`. So the new tree is apex **`/current-affairs/`** — free in both.

## Decisions (user, 2026-11-18)
- Questions public: **daily (published sets) + the whole monthly bank** (active rows).
- Rebuild: **manual** (`scripts/ca-archive/rebuild.sh` on the VPS). Consequence: a newly approved day is not public, and a hidden one stays public, until someone runs it.

## Architecture
```
/current-affairs/                     hub: latest day hero, month list, sections, latest Qs
/current-affairs/2026/11/             month: day calendar (published days linked), section counts, Must-know list
/current-affairs/2026-11-17/          day ("paper" analog): every item in full by section + that day's Qs in full w/ answers, prev/next day
/current-affairs/topic/tamil-nadu/    section ("subject" analog): items across days, newest first, 25/page
/current-affairs/q/<slug>/            question page: same section run as PYQ (answer, locked explanation, details, more from this day, FAQ)
/current-affairs/sitemap.xml          lastmod = day date
```
- **Code**: `scripts/ca-archive/{export.sql, build.mjs, verify.mjs, rebuild.sh}`; imports page chrome + `questionCard/answerSection/explanationSection/miniQuestion/questionJsonLd/pager` from `scripts/qbank/render.mjs` (one public face, no second design).
- **Data flow**: on the VPS, `psql -At` dumps published rows as NDJSON → `build.mjs` → `verify.mjs` (must pass) → `rsync -a --delete` into `/var/www/tnpsc/current-affairs/`. Built on the box from committed scripts (PYQ lesson: local DB env is dead, local tree carries WIP).
- **Freshness**: manual (decision above). Full build: 3,889 files in ~11 s; verify ~2 min.
- **nginx** (on-box edit, certbot-drifted): `location /current-affairs/ { try_files $uri $uri/index.html $uri/ =404; }` + the security headers restated. Ends `=404` → no soft 404 for this tree.
- **SPA**: `/current-affairs/*` → `LeaveToStaticSite` (same as `/questions/*`), so a client-side link isn't swallowed by NotFound.
- **Hub `/`**: header link + one card into `/current-affairs/`.
- **robots/sitemap**: `/current-affairs/sitemap.xml` added to `public/robots.txt`.

## Impact map
| Touches | Risk |
|---|---|
| `scripts/qbank/render.mjs` (import + hub nav link) | carries ~370 lines uncommitted WIP — see decisions |
| `server` archive-explanation route | widening scope could unlock non-public rows → source allow-list + published re-check |
| `deploy/nginx-tnpsc.conf` + live conf | wrong edit takes the site down → `nginx -t` before reload, backup kept |
| `src/App.tsx` | `/current-affairs/*` route; must not shadow `/test-arena/current-affairs` |
| `deploy/deploy.sh` | `rsync --delete` must exclude `/current-affairs/` or an app deploy wipes it |
| `public/robots.txt`, `public/sitemap.xml` | add the CA sitemap |
| VPS crontab | sits beside `ca-generator-managed` lines; must not edit those |
| In-app CA share links (`/ca/magazine/:date`) | untouched (out of scope) |

## Run
- Local (needs a dump in `server/_ca/ca.ndjson`): `node scripts/ca-archive/build.mjs && node scripts/ca-archive/verify.mjs`; preview with `node scripts/qbank/serve.mjs` (mounts `ca-dist` at /current-affairs/).
- Tests: `node scripts/ca-archive/test.mjs` (fixture), `npx vitest run src/__tests__/caArchiveSections.test.ts` (parity with caMagazine.ts).
- Live: `bash scripts/ca-archive/rebuild.sh` on the VPS.

## Edge cases
- Day with magazine but no published question set (and vice versa) → render what exists; no empty section headers.
- Day with 0 items after echo filtering → not built.
- Issue hidden after being indexed → 404 on next rebuild, dropped from sitemap.
- Pipeline still pushing during a build → snapshot is one psql transaction; next run catches up.
- Build/verify fails → live tree untouched (rsync only after verify passes); failure logged.
- Tamil missing on an item (2 rows) → English only, no empty Tamil block.
- Markdown in `content` (`- **bold**`) → parsed to list + `<strong>`, everything escaped.
- Unlock: anonymous → 401; unpublished set / wrong source / unknown id → 404; explanation never in HTML (verify probe).

## Acceptance criteria
1. Every built day/question page maps to an active `materials` row; zero pages for the 30 unapproved days.
2. No explanation text from any source appears anywhere in the built HTML.
3. Hiding an issue in the console removes its page and sitemap entry within one rebuild.
4. Day page shows all items grouped by section in display order, echo items once, Tamil when present, know badge when set.
5. Signed-in reader unlocks a CA question's explanation; anonymous cannot; a `questions.id` cannot be used to read a `ca_daily_questions` row or vice versa.
6. `/questions/*`, `/` hub and `/test-arena/current-affairs` behave exactly as before.
7. Sitemap lists exactly the built pages; every page has a self canonical.
8. Pages read without JavaScript, at 320 px, in Tamil.
