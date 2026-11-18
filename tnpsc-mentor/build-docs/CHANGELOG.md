# Changelog

## 2026-11-18
- feat(qbank): committed reviewed WIP — self-hosted figures, explanation opening published, install bar, log-step pager (dcbe5b4).
- feat(ca-archive): public current-affairs archive at /current-affairs/ — day, month, topic and question pages; unlock endpoint covers CA questions; nav/footer link from the PYQ archive; nginx block; deploy.sh exclude; robots sitemap entry.
- deploy: server + SPA via deploy.sh; live nginx `location /current-affairs/` added in place (backup /root/tnpsc.conf.bak-20261118-134128); CA archive built on the box (3,887 pages, verify clean); PYQ archive rebuilt on the box (6,187 pages) to carry the nav link — its verify flagged 1 false positive (another question's stem), checked by hand.
