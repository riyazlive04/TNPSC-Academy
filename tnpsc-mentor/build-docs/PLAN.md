# Plan — Website look for every web page (2026-11-24) — BUILT 2026-11-24 (not yet deployed); see features/web-pages.md "As built"

## Goal and scope
- In a **browser**, every SPA page (all 54, admin consoles included) should read like the public website: the `/questions/` + `/current-affairs/` archive and the landing/answer-key pages. Same brand header with text nav, pill breadcrumbs, card tiles + section blocks, content + 300px sidebar on desktop, site footer.
- **Android (Capacitor) is unchanged**: its top bar, bottom tabs and list-led screens stay. Switch is runtime `Capacitor.isNativePlatform()`, so one bundle / one OTA serves both.
- Out of scope: the static archive's own HTML (`scripts/qbank`, `scripts/ca-archive`), dark mode for the archive, new features or copy, URL changes, `LandingPage.tsx` (unrouted since 2026-10-06).

## What already exists (don't rebuild)
- Colours + fonts are already identical: `render.mjs` CSS is copied from `src/index.css` tokens. The gap is **layout**, not theme.
- A React port of the website chrome exists: `src/components/landing/AnswerKeyChrome.tsx` (header, footer, sidebar box, FAQ, features, sticky bar), used by 3 pages. It gets generalised, not rewritten.
- `AppLayout` already has one chrome switch (`bare`), and shared primitives (`ListRow`, `SectionHeader`, `ChoiceCard`, `StatStrip`, `PillSection`) feed ~20 pages.

## Project memory respected / changed
- **Changes** the premium-redesign rule "de-cardify, list-led" — on web only. Native keeps it.
- Keeps: no mid-test answer reveal; Quiz/MockQuiz stay chrome-free (fullscreen proctoring); Tamil 2× width (`btn-wrap`, test at 320px in Tamil); `<a href="/">` for home (router doesn't own apex `/`); Tailwind v3, no v4 migration.

## Features (build order)
1. **web-shell** — platform class + Tailwind `web:` variant; `SiteHeader`/`SiteFooter` from AnswerKeyChrome; AppLayout picks web vs native chrome. `features/web-shell.md`
2. **web-page-kit** — `Crumbs`, `PageGrid` (main + sidebar), `SectionBlock`, `Tile`; web variants on the shared primitives. `features/web-page-kit.md`
3. **web-pages-public** — landing + answer-key pages onto the one shared chrome (proves the kit against pages already website-shaped).
4. **web-pages-home** — dashboard (TestArena).
5. **web-pages-practice** — subject practice, PYQ chooser/group/section/aptitude, aptitude, samacheer, history periods, daily, thirukural quiz.
6. **web-pages-ca** — CA hub, CA questions, magazine/test link pages, materials, flashcards.
7. **web-pages-tests** — mock test, instructions, test series, vettri, result; quiz/mock-quiz get archive question styling only.
8. **web-pages-account** — profile, insights, history, revision, bookmarks, messages, payment success, policy.
9. **web-pages-auth** — login, register, forgot/reset, complete profile, language, welcome, setup.
10. **web-pages-admin** — admin questions/reports, superadmin, CRM, SDUI: shell + tokens; tables stay dense.
- Features 3–10 share one doc (`features/web-pages.md`), one section per group; each still ships as its own commit.

## Per-feature loop
Design → impact check → implement → vitest (shell/kit) + Playwright screenshots at 320 / 768 / 1280 px, EN + TA, light + dark, web + forced-native → fix → regression → local run → commit `feat(web-<group>): …` → push → deploy web → re-check live → OTA bundle only after the native screenshots prove nothing moved.

## Decisions (2026-11-24, user accepted recommendations)
1. Phone-width web keeps the bottom tab bar; website header on top.
2. Dark mode toggle stays on web.
3. Admin consoles: shell + tokens only; tables stay tables.

---

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
