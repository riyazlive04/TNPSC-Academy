#!/usr/bin/env bash
# Redeploy script — run ON THE VPS from the app directory after pulling code.
# Builds the SPA + API and (re)starts the API under PM2.
#
#   cd /var/www/tnpsc-app/tnpsc-mentor
#   git pull            # or however you sync code
#   bash deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # the tnpsc-mentor dir
WEB_ROOT="/var/www/tnpsc"

echo "==> Building frontend (Vite)…"
cd "$APP_DIR"
# --omit=optional skips the native mobile packages (@capacitor/android, the
# Capacitor CLI and asset generator). They live in optionalDependencies and are
# only needed to build the Android APK - the web/SPA build never imports them.
npm ci --omit=optional
npm run build                       # outputs to dist/

echo "==> Publishing SPA to $WEB_ROOT…"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"

echo "==> Building API server…"
cd "$APP_DIR/server"
npm ci
npm run build                       # tsc -> server/dist/

echo "==> Restarting API under PM2…"
pm2 reload tnpsc-api || pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
pm2 save

echo "==> Done. Health check:"
curl -fsS http://127.0.0.1:4000/api/health && echo
