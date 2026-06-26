import 'dotenv/config'

/**
 * One-time, idempotent setup of the PRIVATE `materials` Storage bucket that
 * holds uploaded study material (images / PDFs / documents). Videos are YouTube
 * links, so they never touch storage. Private so downloads can only happen via
 * short-lived signed URLs the server issues — honouring the per-item download
 * gate. Re-running is safe; an existing bucket is left untouched.
 *
 *   node setup-materials-bucket.mjs
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

const BUCKET = 'materials'

const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    public: false, // private — access only via server-issued signed URLs
    file_size_limit: 50 * 1024 * 1024, // 50 MB per file
    allowed_mime_types: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/octet-stream',
    ],
  }),
})

const text = await res.text()
if (res.ok) {
  console.log(`Created private bucket "${BUCKET}".`)
} else if (res.status === 409 || /already exists|duplicate/i.test(text)) {
  console.log(`Bucket "${BUCKET}" already exists — nothing to do.`)
} else {
  console.error(`FAILED (${res.status}): ${text}`)
  process.exit(1)
}
