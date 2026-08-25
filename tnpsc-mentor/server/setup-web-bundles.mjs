import 'dotenv/config'

/**
 * One-time, idempotent setup of the public `web-bundles` Storage bucket that
 * holds the uploaded live-update zips (see src/lib/webBundles.ts). Re-running is
 * safe — an existing bucket is left untouched.
 *
 *   node setup-web-bundles.mjs
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

const BUCKET = 'web-bundles'

const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    // Public so the plugin's native downloader needs no auth header — the
    // bucket only ever holds the same web assets already shipped in the store
    // build, and the plugin verifies the sha256 we advertise before applying.
    public: true,
    file_size_limit: 50 * 1024 * 1024, // 50 MB — a dist zip is ~2-4 MB
    allowed_mime_types: ['application/zip', 'application/octet-stream'],
  }),
})

const text = await res.text()
if (res.ok) {
  console.log(`Created public bucket "${BUCKET}".`)
} else if (res.status === 409 || /already exists|duplicate/i.test(text)) {
  console.log(`Bucket "${BUCKET}" already exists — nothing to do.`)
} else {
  console.error(`FAILED (${res.status}): ${text}`)
  process.exit(1)
}
