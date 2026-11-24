# Changelog

## 2026-11-24
- feat(web-links): navigation renders real links (ListRow/ChoiceCard/GridCard `to` via shared `Tap`, header, dashboard, PYQ pickers, Profile rows, result/revision/insights CTAs); no route fade or press-scale on web. Uncommitted.
- feat(web-sidebar): answer-key sidebar boxes — dashboard Keep going + Practice sidebar on picker/practice pages (uncommitted, on hold).
- revert(web-look-revert): user 2026-11-24 — web follows the Group 1 Answer Key 2026 page (v1 website look restored); Android keeps the app look. Uncommitted, on hold.
- feat(web-menu): phone/tablet-width web gets a site menu drawer (links, language, theme) instead of the app bottom tab bar; tour skips the spotlight for hidden targets.
- feat(web-look-revert): web keeps the app's visual design (v1 archive styling removed from primitives, greeting, badges, header); structure kept. SectionBlock + WEB_EYEBROW deleted.
- feat(web-shell): browser-only website chrome — `html.is-web` + Tailwind `web:` variant, archive-style text nav, site footer with archive links; Android unchanged.
- feat(web-page-kit): PageGrid / Crumbs / SectionBlock + web variants on List, ListRow, SectionHeader, ChoiceGrid/Card, StatStrip.
- feat(web-home): dashboard on web — PageGrid, archive hero greeting, 3-col practice cards, Keep going in the sidebar.
- feat(web-practice): PickerPage on the kit (crumbs replace back link + badge on web) → PYQ/aptitude/samacheer/history/CA pickers; SubjectPractice + Thirukural on PageGrid; Daily widened; footer pinned to bottom on web.
- feat(web-pages-wide): Materials, Insights, TestSeries, Bookmarks widen to the website width on web.
- feat(web-auth): sign-in pages get the website header + footer on web; footer moved to shared SiteFooter.
- feat(web-admin): AdminQuestions correct-option colours on the theme token (dark-mode fix); admin consoles otherwise get the shell only.
- fix(web-shell): Tamil desktop nav kept on one line (found in the signed-in check) (3d183ba).
- deploy: 3d183ba live via deploy.sh (box was clean at 13de6b7); live check — admin home, student preview dashboard (sidebar, footer, nav fits), /, /questions/, /current-affairs/ all 200. Rollback = redeploy 13de6b7.
- fix(offer-cards): purchase cards lay out by their own width (container query), so the Group II/IIA offer sheet no longer squeezes its text on desktop.
- deploy: 429373f live (offer-card fix); live check — student-preview /test-series sheet stacks correctly, @container CSS served.
- skipped web-pages-public: landing/answer-key pages already website-style.

## 2026-11-18
- feat(qbank): committed reviewed WIP — self-hosted figures, explanation opening published, install bar, log-step pager (dcbe5b4).
- feat(ca-archive): public current-affairs archive at /current-affairs/ — day, month, topic and question pages; unlock endpoint covers CA questions; nav/footer link from the PYQ archive; nginx block; deploy.sh exclude; robots sitemap entry.
- deploy: server + SPA via deploy.sh; live nginx `location /current-affairs/` added in place (backup /root/tnpsc.conf.bak-20261118-134128); CA archive built on the box (3,887 pages, verify clean); PYQ archive rebuilt on the box (6,187 pages) to carry the nav link — its verify flagged 1 false positive (another question's stem), checked by hand.
