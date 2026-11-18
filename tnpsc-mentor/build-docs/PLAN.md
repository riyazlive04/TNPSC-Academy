# Plan — Public current-affairs archive (2026-11-18)

## Goal and scope
- Publish approved current affairs on the open web at `tnpscmentors.in/current-affairs/`, in the PYQ archive's structure and design, for search traffic → app sign-ups.
- Out of scope: per-news-item pages (items are 2–4 bullets — thin pages; day + section pages cover them via anchors), the monthly compilation as a second copy, Google News sitemap, changing in-app share links.

## Project memory respected
- PYQ archive decisions carry over: allow-list, explanation withheld from HTML (not blurred), build on the VPS from committed scripts, `deploy.sh` must not wipe the static tree.
- CA rules: publication = superadmin approval; no "The Hindu" credit; `TNPSC BITS` → `TNPSC CABITS` display; know level NULL = unreviewed.
- Existing docs live in `docs/` + Claude memory; this `build-docs/` starts with this feature.

## Features (build order)
1. **ca-archive build** — export (published-only) → build → verify, locally against a fixture. Doc: `features/public-current-affairs.md`.
2. **Explanation unlock** — extend archive-explanation with a source key + published re-check.
3. **Wiring** — SPA route, hub link, robots/sitemap, `deploy.sh` exclude.
4. **Ship** — on-box nginx block, first build, cron, Search Console note.

Each: tests → regression on PYQ archive (`verify.mjs`, `test-stems.mjs`) → commit `feat(ca-archive): …` → push.
