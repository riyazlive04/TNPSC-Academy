#!/usr/bin/env bash
# ─── Deep-link association files ────────────────────────────────────────────
# Fills in the two placeholders that App Links / Universal Links verification
# needs, and prints the finished files.
#
# TWO fingerprints matter on Android, and getting this wrong is the single most
# common reason App Links silently fail to verify:
#
#   1. The LOCAL release keystore (tnpsc-release-2026.keystore) — signs the AAB
#      you upload, and signs any APK you sideload for testing.
#   2. The PLAY APP SIGNING key — Google re-signs the app with its own key before
#      shipping it to users. Play Console → Setup → App signing → "SHA-256
#      certificate fingerprint". Installs from the Play Store carry THIS one, so
#      omitting it means links work in your test APK and break in production.
#
# Both must be listed. Usage:
#   ./deploy/make-assetlinks.sh                 # reads android/keystore.properties
#   ./deploy/make-assetlinks.sh <TEAM_ID>       # also fills the Apple file
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROPS="$ROOT/android/keystore.properties"
OUT_DIR="$ROOT/public/.well-known"

if [[ ! -f "$PROPS" ]]; then
  echo "error: $PROPS not found — cannot read the release keystore." >&2
  exit 1
fi

prop() { grep -E "^$1=" "$PROPS" | head -1 | cut -d= -f2- | tr -d '\r'; }

STORE_FILE="$(prop storeFile)"
STORE_PASS="$(prop storePassword)"
KEY_ALIAS="$(prop keyAlias)"

# storeFile is written relative to android/ in build.gradle.
[[ "$STORE_FILE" = /* ]] || STORE_FILE="$ROOT/android/$STORE_FILE"

echo "Reading release fingerprint from: $STORE_FILE"
LOCAL_SHA="$(keytool -list -v \
  -keystore "$STORE_FILE" \
  -alias "$KEY_ALIAS" \
  -storepass "$STORE_PASS" 2>/dev/null \
  | grep -E 'SHA256:' | head -1 | sed 's/.*SHA256: *//' | tr -d ' \r')"

if [[ -z "$LOCAL_SHA" ]]; then
  echo "error: could not read a SHA-256 fingerprint (wrong alias or password?)." >&2
  exit 1
fi

echo
echo "Local release SHA-256: $LOCAL_SHA"
echo
echo "Now copy the PLAY APP SIGNING fingerprint from:"
echo "  Play Console → your app → Setup → App signing → App signing key certificate"
read -r -p "Paste it here (or press Enter to skip for now): " PLAY_SHA
PLAY_SHA="$(echo "${PLAY_SHA:-}" | tr -d ' \r')"

FPS="\"$LOCAL_SHA\""
if [[ -n "$PLAY_SHA" ]]; then
  FPS="$FPS,
        \"$PLAY_SHA\""
else
  echo "warning: no Play signing fingerprint — links will NOT verify for Play Store installs." >&2
fi

mkdir -p "$OUT_DIR"
cat > "$OUT_DIR/assetlinks.json" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tnpscmentor.app",
      "sha256_cert_fingerprints": [
        $FPS
      ]
    }
  }
]
EOF
echo "wrote $OUT_DIR/assetlinks.json"

TEAM_ID="${1:-}"
if [[ -n "$TEAM_ID" ]]; then
  sed -i.bak "s/REPLACE_TEAM_ID/$TEAM_ID/" "$OUT_DIR/apple-app-site-association"
  rm -f "$OUT_DIR/apple-app-site-association.bak"
  echo "wrote $OUT_DIR/apple-app-site-association (team $TEAM_ID)"
else
  echo "note: pass your Apple Team ID as \$1 to fill apple-app-site-association."
fi

cat <<'NOTES'

Serving requirements — both files must be reachable over HTTPS with NO redirect:
  https://app.tnpscmentors.in/.well-known/assetlinks.json
  https://app.tnpscmentors.in/.well-known/apple-app-site-association

  • apple-app-site-association has NO .json extension and must be served as
    Content-Type: application/json. Add to the nginx server block:

      location = /.well-known/apple-app-site-association {
          default_type application/json;
      }

  • The SPA's catch-all `try_files ... /index.html` will happily swallow these and
    return HTML instead. Make sure /.well-known/ is matched BEFORE it.

Verify afterwards:
  Android: adb shell pm verify-app-links --re-verify com.tnpscmentor.app
           adb shell pm get-app-links com.tnpscmentor.app
  Apple:   https://app-site-association.cdn-apple.com/a/v1/app.tnpscmentors.in
NOTES
