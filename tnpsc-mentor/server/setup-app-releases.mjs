import 'dotenv/config'

/**
 * One-time, idempotent setup of the public `app-releases` Storage bucket that
 * holds the uploaded Android APKs (see src/lib/appReleases.ts). Re-running is
 * safe — an existing bucket is left untouched.
 *
 *   node setup-app-releases.mjs
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

const BUCKET = 'app-releases'

const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    public: true,
    file_size_limit: 50 * 1024 * 1024, // 50 MB — ample for a ~5 MB build, within the project default
    allowed_mime_types: ['application/vnd.android.package-archive', 'application/octet-stream'],
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
