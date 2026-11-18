# Project memory

Long-form history lives in Claude memory + `docs/`. This file records decisions for work tracked in `build-docs/`.

## Public current-affairs archive (2026-11-18)
- Tree at apex `/current-affairs/` — `/questions/current-affairs/` is the PYQ subject page, SPA CA hub is `/test-arena/current-affairs`.
- Public only if the `materials` publish row is active (30 of 135 pushed days are unapproved).
- Unlock endpoint picks the table by id shape (UUID → questions, integer → ca_daily_questions); no source param needed.
- Monthly compilation not published (duplicates day items; stays the in-app PDF).
- User chose: daily + monthly-bank questions public; MANUAL rebuild (I recommended hourly cron — hidden issues stay public until a rebuild); qbank WIP reviewed + committed first (dcbe5b4).
- Question slugs assigned over ALL exported rows in created_at order, so approving a day later never moves an existing URL.
- Section names/echo logic duplicated in scripts/ca-archive/sections.mjs (caMagazine.ts can't load outside Vite); a vitest parity test guards drift.
- Lock card text changed from "free on every previous-year question" → "free on every question here" (shared by both archives).
