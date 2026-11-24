# Project memory

Long-form history lives in Claude memory + `docs/`. This file records decisions for work tracked in `build-docs/`.

## Web app as web pages v2 (2026-11-24, plan awaiting approval)
- User: revert the v1 archive LOOK on web (keep the app's visual design); convert STRUCTURE to web pages — phone menu instead of bottom tabs, sheets → pages, buttons → real links, back buttons → breadcrumbs. Reverses v1 "Both" reference + "phone web keeps tabs".

## Website look for web pages (2026-11-24, deployed 3d183ba)
- User: reference = archive AND landing pages; web only (Android keeps native chrome); all 54 pages incl. admin.
- Switch = runtime `Capacitor.isNativePlatform()` → `html.is-web` + Tailwind `web:` variant (one bundle/OTA for both).
- Tokens already shared with `render.mjs`; work is layout. Footer = `AnswerKeyFooter` from `AnswerKeyChrome.tsx`.
- Web reverses the "de-cardify" premium-redesign rule; native keeps it.
- User approved my recommendations: phone-width web KEEPS the bottom tab bar; dark mode toggle kept on web; admin consoles get shell + tokens only (tables stay tables).
- No separate SiteHeader/siteNav.ts: AppLayout's header is web-styled with `web:` classes; `AnswerKeyFooter` reused with a `links` row. Avoids duplicating credits/bell/preview logic.
- Web desktop nav uses the SHORT tab labels (Tamil long labels wrap); the name label is hidden ≥lg on web. <1200px Tamil scrolls the nav sideways.
- Purchase cards (RankBooster/TargetG2/Vettri/Premium) use the `wide:` container variant, never viewport `sm:` — they render in pages AND in the narrow offer sheet / upsell popup.
- Folder is `components/Landing/` (capital L) in git — Windows hides wrong-case imports; tsc catches them.

## Public current-affairs archive (2026-11-18)
- Tree at apex `/current-affairs/` — `/questions/current-affairs/` is the PYQ subject page, SPA CA hub is `/test-arena/current-affairs`.
- Public only if the `materials` publish row is active (30 of 135 pushed days are unapproved).
- Unlock endpoint picks the table by id shape (UUID → questions, integer → ca_daily_questions); no source param needed.
- Monthly compilation not published (duplicates day items; stays the in-app PDF).
- User chose: daily + monthly-bank questions public; MANUAL rebuild (I recommended hourly cron — hidden issues stay public until a rebuild); qbank WIP reviewed + committed first (dcbe5b4).
- Question slugs assigned over ALL exported rows in created_at order, so approving a day later never moves an existing URL.
- Section names/echo logic duplicated in scripts/ca-archive/sections.mjs (caMagazine.ts can't load outside Vite); a vitest parity test guards drift.
- Lock card text changed from "free on every previous-year question" → "free on every question here" (shared by both archives).
