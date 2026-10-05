#!/usr/bin/env bash
# Publish the built question archive to the VPS.
#
#   bash scripts/qbank/deploy.sh                # root@srv1778326.hstgr.cloud
#   bash scripts/qbank/deploy.sh user@other.host
#
# Run it from the repo root AFTER build.mjs has run; it re-runs verify.mjs
# itself and stops on any problem. It never touches anything outside
# /var/www/tnpsc/questions/, so it cannot disturb the SPA that lives beside it.
set -euo pipefail

HOST="${1:-root@srv1778326.hstgr.cloud}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$ROOT/qbank-dist"
WEB="/var/www/tnpsc/questions"

[ -f "$DIST/index.html" ] || { echo "no build at $DIST — run: node scripts/qbank/build.mjs" >&2; exit 1; }

echo "==> Verifying the build before it goes anywhere…"
node "$ROOT/scripts/qbank/verify.mjs"

# The dev machine is Windows/Git Bash with no rsync, so the upload is a tar
# stream over ssh (about 3 minutes for ~270 MB). It lands in /tmp first so the
# live tree is only ever replaced by one complete, verified copy — never left
# half-written if the connection drops.
echo "==> Uploading to $HOST:/tmp/qbank/ …"
tar -czf - -C "$DIST" . | ssh "$HOST" 'rm -rf /tmp/qbank && mkdir -p /tmp/qbank && tar -xzf - -C /tmp/qbank'

echo "==> Installing into $WEB …"
# Ownership and modes copy the SPA next door (root:root, 755/644); nginx runs as
# www-data and only needs to read. deploy/deploy.sh excludes /questions/ from
# its own --delete, so this is the only thing that ever prunes the archive.
# nginx already gzips on the fly (≈4.4× on these pages), so no .gz pre-build.
ssh "$HOST" "set -e
test -f /tmp/qbank/index.html
mkdir -p $WEB
rsync -a --delete /tmp/qbank/ $WEB/
chown -R root:root $WEB
find $WEB -type d -exec chmod 755 {} +
find $WEB -type f -exec chmod 644 {} +
rm -rf /tmp/qbank
echo \"installed: \$(find $WEB -type f | wc -l) files, \$(du -sh $WEB | cut -f1)\""

echo "==> Live checks (through DNS + TLS + nginx, not from the box):"
for p in /questions/ /questions/past-papers/ /questions/logo-mark.png /questions/social.png /questions/sitemap.xml; do
  printf '  %-32s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://tnpscmentors.in$p")"
done

cat <<'NEXT'

Done. If this is a first deploy or robots.txt/sitemap.xml changed, make sure the
LIVE copies list the archive (the SPA deploy ships public/, but only when it runs):
  curl -s https://tnpscmentors.in/robots.txt | grep questions
Then in Search Console submit https://tnpscmentors.in/questions/sitemap.xml
NEXT
