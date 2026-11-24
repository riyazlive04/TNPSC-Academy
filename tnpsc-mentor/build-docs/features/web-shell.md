# web-shell — website chrome in the browser, app chrome on Android

## Purpose
Browser users get the public website's header and footer around every app page, so the app reads as part of tnpscmentors.in. The Android app keeps its native top bar and bottom tabs.

## Architecture (as built)
- **Platform flag**: `src/lib/platform.ts` → `IS_WEB = !Capacitor.isNativePlatform()`; `main.tsx` adds `html.is-web` before first render. Dev-only `?native` forces the app look for screenshots.
- **Tailwind variant**: inline plugin `addVariant('web', 'html.is-web &')` in `tailwind.config.js`. Pages write `web:…`; native ignores it.
- **Header**: AppLayout's existing header, web-styled with `web:` classes (archive text nav: bold ink links, no icons; translucent blur bar). No separate SiteHeader — it would duplicate the credits/bell/preview/workspace logic.
- **Footer**: `AnswerKeyFooter` (`components/Landing/AnswerKeyChrome.tsx`) reused, with a new optional `links` row. AppLayout renders it on web only, with the archive footer's destinations (absolute `https://tnpscmentors.in/...` — archive trees exist only on the apex host).
- **Bottom tabs**: kept below `lg` on web too (decision 2026-11-24); footer wrapper pads `pb-20` to clear them.
- **Nav list**: existing `LEARNER_NAV` / `MOBILE_LEARNER_NAV` / `ADMIN_NAV` arrays stay the single source; no `siteNav.ts`.
- `bare` still wins (no header/footer).

## Impact map
- `AppLayout.tsx` (all signed-in pages) — header slots move; WorkspaceSwitch, preview-as-student bar, BackToTop, AlertPopup must stay.
- `AnswerKeyChrome.tsx` users: `AnswerKeyPage`, `PastAnswerKeyPage`, `Group4NotificationPage` — visual change.
- `App.tsx` route tree — unchanged; no URL moves (OAuth, Razorpay callback, App Links safe).
- `tailwind.config.js` — new variant only.
- Android: must render byte-identical chrome. OTA bundle (Capgo) carries the change, so a regression there ships to phones without Play review.
- Static archive (`render.mjs`) — not touched; its footer links are mirrored in AppLayout `FOOTER_HREFS` and may drift (known issue).

## Edge cases / failure modes
- `Capacitor` undefined in a plain browser → treat as web (default).
- Feature-flag nav items (test series, flashcards, materials) must hide in BOTH chromes, and role items (admin, superadmin, telecaller) must stay role-gated.
- Tamil labels ~2× wider: nav must wrap or collapse, never overflow at 980–1280px.
- Header + sticky banners (install bar, offline, group1-retired, preview-as-student) must not stack past one screen on 320px.
- Sign-out / session expiry while on a page: header flips to signed-out without a reload.
- Keyboard: nav reachable by Tab, visible focus ring, `aria-current="page"` on the active link.

## Acceptance criteria
- AC1 In a browser, every AppLayout page shows the web-styled header + site footer; no bottom tab bar ≥1024px.
- AC2 With the native flag, AppLayout output is unchanged (Playwright screenshot diff = 0 on 5 sample pages).
- AC3 Quiz and MockQuiz show no header/footer on either platform.
- AC4 Nav items per role/flag unchanged (same arrays/filters; untouched code).
- AC5 No horizontal scroll at 320px in EN and TA.
- AC6 Answer-key pages still render (existing tests pass).
