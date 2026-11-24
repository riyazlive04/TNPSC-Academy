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

## roles / passwordStrength (2026-11-24)
- Long-failing `roles.test.ts > passwordStrength`: the TEST was stale. f3a0f01 raised the floor to 8 chars (server passwordPolicy MIN_LENGTH=8, Register form) and moved meter thresholds 6/10 → 8/12; the test kept the old ones. Updated with boundary cases (7 → 0, 8 → 1, 11 → 3, 12 → 4). Full suite 231/231 (PowerShell).

## web-light-only (2026-11-24)
- Full vitest on a clean HEAD worktree + this change: 230/231, only pre-existing `roles.test.ts > passwordStrength` fails; tsc clean. (Correction: the "all suites fail to load" errors — `reading 'on'` / `No test suite found` — come from running vitest under Git Bash in the agent shell, not from WIP; run tests from PowerShell.)

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

## web-pages-auth (2026-11-24)
| Test | Maps to | Result |
|---|---|---|
| Playwright `/login`: web 1280, native 1280, web 320 | shared AC | web: site header + footer around the split hero/form; native identical (corner controls, full-height split); no h-scroll |
| Regression: AppLayout footer after the SiteFooter move | web-shell AC1 | same footer rendered (PYQ + home shots unchanged) |
- Not checked: Google sign-in button, device-limit modal, WhatsApp check on Register (need backend).

## web-pages-admin (2026-11-24)
- Token swap only (AdminQuestions correct-option colours); `tsc` clean, vitest regression clean. Not visually checked (admin-only, needs an admin session).

## Signed-in local check (2026-11-24) — local build proxied to the LIVE API, real student account
| Page | Result |
|---|---|
| Dashboard (TA, dark, 1536) | real data: kural, G1-retired notice, G2 offer strip, practice cards, Keep going sidebar. Tour anchors mock/practice/progress/credits/lang all present + sized. No console errors. No h-scroll. |
| **Found + fixed:** Tamil desktop nav wrapped to 2 lines and then (nowrap) clipped Profile | web nav now uses short labels, one line, name label hidden ≥lg on web (Profile tab covers it), tighter padding; fits exactly at 1536 (708/708). <1200px Tamil: nav scrolls sideways (safe-center) instead of wrapping. |
| Subject practice, Test Series (2-col papers, premium locks), Insights, Materials (4-col) | correct at 6xl |
| `?native` dashboard + test series | unchanged vs before |
| Pre-existing, not ours: Group II/IIA offer sheet squeezes its Tamil card text into a narrow column — identical in `?native`. |
- Not checked here: phone width with real data (window resize unavailable in this browser; 320/390 covered by the earlier Playwright shots).

## fix(offer-cards) — Group II/IIA offer sheet squeeze (2026-11-24)
- Root cause: purchase cards switched to side-by-side on the VIEWPORT `sm:` breakpoint; inside the 576px offer sheet / upsell popup on a desktop the price+coupon column kept its width and crushed the text column (Tamil worst).
- Fix: `wide:` variant = `@container (min-width: 40rem)`; card root `[container-type:inline-size]`; every `sm:` in RankBooster/TargetG2/Vettri/Premium cards → `wide:`.
| Check (signed-in, local build → live API, Tamil dark 1536) | Result |
|---|---|
| /test-series offer sheet | card stacks, perks/bonus full width, price + coupon + full-width buy button |
| /profile Rank Booster card (736px) | still side by side (row) — unchanged |
| tsc / vitest | clean / only pre-existing roles failure |

## v2 web-look-revert (2026-11-24)
| Check | Result |
|---|---|
| Signed-in local (TA dark 1536) dashboard | app look back: plain greeting, unboxed lists, app GridCards; structure kept (header/footer/sidebar). |
| Header nav with icons (app look) | did NOT fit Tamil: 864px needed / 710px available → icons hidden on web only, app colours/weights kept → 710/710 |
| webPageKit.test (SectionBlock case removed with the component) | pass |

## v2 web-menu (2026-11-24) — signed-in local, 400px same-origin iframes (web vs `?native`)
| AC | Result |
|---|---|
| web <lg: no bottom tab bar, menu button present; native keeps tab bar, no menu button | pass |
| drawer: focus on close button, body scroll locked, links = real hrefs (/test-arena /test-series /revision /materials /insights /profile) | pass |
| following a link navigates + closes + restores scroll; Esc closes; focus returns to the menu button | pass |
| no horizontal scroll at 400px (scrollWidth 390) | pass |
| Tour: hidden target (lang button on phone web) now falls back to the centred card (0x0 rect treated as missing) | code change; not run through the tour |
- Note: a frozen tab after several HMR edits to AppLayout was a stale hot reload — a fresh tab loaded fine.

## v3 answer-key look (2026-11-24) — signed-in local, Tamil dark
| Check | Result |
|---|---|
| Dashboard 1536 | v1 look back; Keep going as answer-key SidebarBox (Revision, Insights, Question bank); nav 708/708 |
| /test-arena/pyq 1536 | crumbs + main + Practice sidebar (current section highlighted) |
| /test-arena/pyq at 400px (iframe) web vs `?native` | web: menu + crumbs, Practice sidebar stacked below the content, no h-scroll (390); native: back button, badge, bottom tabs, no aside |

## v2 web-links (2026-11-24) — signed-in local
| Check | Result |
|---|---|
| `webPageKit.test` "web-links": ListRow with `to` → `<a href>`; disabled / action-only → `<button>` | pass (6/6) |
| Dashboard: 20 real links (header nav, mock hero, practice cards, sidebar, footer) | pass |
| Clicking a link is SPA navigation (no reload); PYQ group cards + group-2 section cards are links; empty section stays a disabled button | pass |
| `?native` dashboard | visually unchanged (links render the same classes) |
- Web: route cross-fade and press-scale off (lib/motion.ts), no App.tsx edit.
- Not converted yet: step pickers (Subject practice, aptitude, Thirukkural) — they become links with feature 4's URL steps; back buttons → crumbs (feature 4).

## v2 web-crumbs + URL steps (2026-11-24) — signed-in local, Tamil
| Check | Result |
|---|---|
| Subject practice: pick subject → topic → URL `?subject=&topic=`; crumbs Home › Subject practice › Physics › topic, every earlier level a link | pass |
| Browser back steps topic → subject → first step; back button hidden on web | pass |
| Deep link `?subject=Physics&topic=__all__` opens the type step with full crumbs | pass |
| Bad deep links: unknown subject → first step (params cleared, replace); unknown Thirukkural chapter → chapter step | found broken, fixed (validation added), re-checked pass |
| Thirukkural `?chapter=`, Current affairs `?month=` (crumbs + section crumb links back) | pass |
| Aptitude / PYQ aptitude `?type=`, Samacheer `?subject=&std=` | tsc only; not clicked through |
| Crumbs on Daily, Insights, MockTest, Profile, Revision, TestSeries, Vettri, Messages (back button web:hidden) | tsc only |
- Android: steps now live in the URL there too (user decision A) — the hardware back button steps back one level.

## v2 web-sheets-to-pages (2026-11-24) — signed-in local
| Check | Result |
|---|---|
| Dashboard CA card is a link → /test-arena/current-affairs, no sheet | pass |
| CA page (web): Daily CA test section inline (DailyCaSheet `inline`), sidebar boxes Current affairs (topic practice / CA questions) + Practice | pass |
| /test-series web: no offer pop-up, Group II/IIA card inline above the papers | pass |
| /test-series `?native`: offer sheet still auto-opens | pass |
| No render loop on the CA page (0 DOM mutations in 3s) | pass |
- Kept as dialogs by decision: upsell popup (user), Thirukkural reference modal (a /thirukural page would need an App.tsx route; App.tsx carries someone else's WIP).
