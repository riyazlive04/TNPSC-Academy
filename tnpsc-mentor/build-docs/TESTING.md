# Testing

## Public current-affairs archive (2026-11-18)
| Test | Maps to | Result |
|---|---|---|
| `scripts/ca-archive/test.mjs` (8 cases, fixture) | AC1 publication gate, AC2 explanation gate, AC3 stable URLs on later approval, AC4 day-page rendering, AC6 own stylesheet | 8/8 pass |
| `scripts/ca-archive/verify.mjs` on live dump | AC1, AC2, AC7 (canonical, one h1, links, sitemap) | pass — 3,887 pages, 5,427 explanation + 850 unpublished-note probes |
| `src/__tests__/caArchiveSections.test.ts` | AC4 labels/echo/bullets match the app | 5/5 pass |
| Regression: PYQ `build.mjs` + `verify.mjs` + `test-stems.mjs` | AC6 | pass, 0 stem failures |
| Regression: `npx vitest run` | AC6 | 220/221; `roles.test.ts > passwordStrength` fails — pre-existing, unrelated |
| `server` `tsc --noEmit` | unlock endpoint | clean |

Failures found and fixed:
- verify flagged 114 "leaks" on live data — all false positives: the same fact is public through another row (a story repeated across days, a monthly question on an unapproved day's news, two questions sharing an opening). verify now skips probes found in any public row's text.
- verify stripped `<…>` over concatenated raw text, so a stray `<` in one row and `>` in another erased everything between → strip per row.
- verify assumed the English excerpt length for Tamil; renderer cuts Tamil at 240 → verify now uses the same.
- shareMeta test: new `/current-affairs/*` route added to the default-preview allow-list (static pages carry their own OG tags).

Not covered by automated tests: the unlock endpoint's DB path (route handlers have no test harness here) — checked by typecheck + live curl after deploy.
