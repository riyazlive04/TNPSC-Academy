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

## web-shell (2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| `src/__tests__/webShell.test.ts` (4) | AC1/AC2 `IS_WEB` web vs native + dev override; AC1 footer link row; AC6 answer-key footer unchanged | 4/4 pass |
| Playwright screenshots via temp `_preview.html` harness: web 1280, web 320 EN, web 320 TA, native 1280 | AC1, AC2, AC5 | web shows text nav + footer; native identical to before (icons, no footer); scrollWidth = viewport at 320 EN/TA |
| `tsc --noEmit` | — | clean (caught a `landing/` vs `Landing/` import case bug that would break the Linux build) |
| Regression: `npx vitest run` | answer-key pages, all | 228/229; `roles.test.ts > passwordStrength` fails — pre-existing (fails with these changes stashed) |
- Not checked: a real signed-in session (shell routes are auth-gated; local DB env is dead) — harness renders AppLayout with an empty body instead.

## web-page-kit (2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| `src/__tests__/webPageKit.test.ts` (5) | AC1 PageGrid web/native + no empty aside, AC3 Crumbs a11y + native null, SectionBlock native plain, AC2 primitives' native classes unchanged | 5/5 pass |
| Playwright on kit demo harness: web 1280, web 390, native 390, web 320 TA | AC4 2-col ≥1024 / stacked below; native list-led look intact | pass; no horizontal scroll |
| Regression: `npx vitest run` | all | first run: AC2 kit test flaked (timed out re-importing `motion` after `vi.resetModules()` under the parallel suite) — d72aaef was pushed with it red by mistake. Fixed: primitives imported once at file top. Two full runs after: only the pre-existing `roles.test.ts > passwordStrength` failure |

## web-pages-home (2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| Playwright via `_preview.html` (TestArenaPage in AppLayout, no backend): web 1280, web 390, native 390, web 320 TA | shared AC: web layout, native unchanged, no h-scroll | web: eyebrow greeting, 3-col cards, Keep going in sidebar; native identical (cards at foot); scrollWidth = viewport |
| `webPageKit.test.ts` AC2 updated for SectionHeader `web:px-0` | native classes unchanged | pass |
- Not checked: SDUI slots, CA carousel, tour spotlight on `data-tour="progress"` in the sidebar, credit wall — need a signed-in session + backend.

## web-pages-practice (2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| Playwright via `_preview.html`: PYQ chooser web 1280 + native 390/1280, SubjectPractice web 1280, Aptitude web 320 TA, Daily web 1280 | shared AC | web: crumbs (Home › section) replace back link + badge, 3-col tiles, footer pinned to bottom on short pages; native: back link + centered badge unchanged, canvas below content unchanged; no h-scroll |
| `tsc --noEmit` | — | clean |
- Not checked: data-filled states, free-gate lock chips, CreditConfirmPopup (need backend + session). In-page step back buttons (Aptitude, PyqAptitude, SubjectPractice, Thirukural) kept on web — they step internal state, not history.

## web-pages-wide (groups 6–8, 2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| Playwright via `_preview.html`: TestSeries web 1280 + native 390, Insights web 1280 | shared AC | web container aligns with header/footer at 6xl; native unchanged; no h-scroll |
- Not checked: these pages WITH data (paper lists, analytics charts, materials grid at 6xl) — need backend + session.
