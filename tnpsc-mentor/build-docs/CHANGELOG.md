# Changelog

## 2026-11-24
- feat(web-shell): browser-only website chrome — `html.is-web` + Tailwind `web:` variant, archive-style text nav, site footer with archive links; Android unchanged.
- feat(web-page-kit): PageGrid / Crumbs / SectionBlock + web variants on List, ListRow, SectionHeader, ChoiceGrid/Card, StatStrip.
- feat(web-home): dashboard on web — PageGrid, archive hero greeting, 3-col practice cards, Keep going in the sidebar.
- feat(web-practice): PickerPage on the kit (crumbs replace back link + badge on web) → PYQ/aptitude/samacheer/history/CA pickers; SubjectPractice + Thirukural on PageGrid; Daily widened; footer pinned to bottom on web.
- feat(web-pages-wide): Materials, Insights, TestSeries, Bookmarks widen to the website width on web.
- skipped web-pages-public: landing/answer-key pages already website-style.

## 2026-11-18
- feat(qbank): committed reviewed WIP — self-hosted figures, explanation opening published, install bar, log-step pager (dcbe5b4).
- feat(ca-archive): public current-affairs archive at /current-affairs/ — day, month, topic and question pages; unlock endpoint covers CA questions; nav/footer link from the PYQ archive; nginx block; deploy.sh exclude; robots sitemap entry.
- deploy: server + SPA via deploy.sh; live nginx `location /current-affairs/` added in place (backup /root/tnpsc.conf.bak-20261118-134128); CA archive built on the box (3,887 pages, verify clean); PYQ archive rebuilt on the box (6,187 pages) to carry the nav link — its verify flagged 1 false positive (another question's stem), checked by hand.
