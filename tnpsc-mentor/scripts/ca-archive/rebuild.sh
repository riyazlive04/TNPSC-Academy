#!/usr/bin/env bash
# Rebuild the public current-affairs archive ON THE VPS and swap it in.
#   cd /var/www/tnpsc-app/tnpsc-mentor && git pull --ff-only && bash scripts/ca-archive/rebuild.sh
# Dump → build → verify → rsync. The live tree is only touched after verify
# passes, so a failed run leaves yesterday's pages up. Run it after approving
# (or hiding) issues in the superadmin console; nothing runs it automatically.
set -euo pipefail
cd "$(dirname "$0")/../.."

LIVE=/var/www/tnpsc/current-affairs
mkdir -p server/_ca

docker cp scripts/ca-archive/export.sql supabase-db:/tmp/ca-export.sql
docker exec supabase-db psql -U supabase_admin -d postgres -qAt -f /tmp/ca-export.sql > server/_ca/ca.ndjson.tmp
mv server/_ca/ca.ndjson.tmp server/_ca/ca.ndjson

node scripts/ca-archive/build.mjs
node scripts/ca-archive/verify.mjs

mkdir -p "$LIVE"
rsync -a --delete ca-dist/ "$LIVE/"
chown -R root:root "$LIVE"
find "$LIVE" -type d -exec chmod 755 {} +
find "$LIVE" -type f -exec chmod 644 {} +
echo "current-affairs archive live: $(find "$LIVE" -name index.html | wc -l) pages"
