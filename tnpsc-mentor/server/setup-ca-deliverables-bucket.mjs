import 'dotenv/config'

/**
 * One-time, idempotent setup of the PRIVATE `ca-deliverables` Storage bucket
 * the CA-generator pipeline uploads its monthly artefacts into (see
 * work/TNPSC/APP_INTEGRATION.md): the inserted-rows JSON audit files, the
 * bilingual question-review docx and the Thervupettagam magazine docx pair,
 * under <YYYY-MM>/… paths. Private so nothing is exposed by URL; the pipeline
 * writes with the service_role key and any future admin UI reads via
 * server-issued signed URLs. Re-running is safe; an existing bucket is left
 * untouched.
 *
 *   node setup-ca-deliverables-bucket.mjs
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

const BUCKET = 'ca-deliverables'

const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    public: false, // private — pipeline writes via service_role; reads via signed URLs
    file_size_limit: 50 * 1024 * 1024, // 50 MB (project global cap rejects more)
    allowed_mime_types: [
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
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
