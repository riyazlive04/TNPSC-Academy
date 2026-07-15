import 'dotenv/config'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pushes the Group 4 figure crops to Supabase Storage. The DB `images` column is
 * set by import_pyq4.mjs from the SAME path the source JSON carries, so this
 * script only uploads the files to the bucket.
 *
 *   Content_materials/Group_4/figures/<year>/<year>_Q<no>.png   (stem figure)
 *
 * Uploaded to `question-images/pyq4/<year>/<filename>` (idempotent x-upsert).
 * Group 4 has no per-option figures, unlike Group 2.
 *
 *   node upload_pyq4_images.mjs            # DRY RUN (lists files)
 *   APPLY=1 node upload_pyq4_images.mjs    # upload
 */

const IMG_ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/Group_4/figures'
const BUCKET = 'question-images'
const APPLY = process.env.APPLY === '1'
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}
if (!existsSync(IMG_ROOT)) {
  console.error(`FATAL: figures dir not found: ${IMG_ROOT}`)
  process.exit(2)
}

const NAME_RE = /^\d{4}_Q\d+\.(png|jpe?g|webp)$/i
const mimeFor = (n) => (/\.(jpe?g)$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : 'image/png')

const items = []
for (const year of readdirSync(IMG_ROOT).filter((d) => /^\d{4}$/.test(d))) {
  const dir = join(IMG_ROOT, year)
  if (!statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    if (!NAME_RE.test(f)) {
      if (/\.(png|jpe?g|webp)$/i.test(f)) console.warn(`  ! ignoring non-conforming file: ${year}/${f}`)
      continue
    }
    items.push({ object: `pyq4/${year}/${f}`, localPath: join(dir, f) })
  }
}

console.log(`Found ${items.length} crops to upload to ${BUCKET}/pyq4/...`)
if (!APPLY) {
  items.forEach((it) => console.log(`  ${it.object}`))
  console.log('\nDRY RUN — re-run with APPLY=1 to upload.')
  process.exit(0)
}

let ok = 0, fail = 0
for (const it of items) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${it.object}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': mimeFor(it.object),
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: readFileSync(it.localPath),
  })
  if (res.ok) ok++
  else { fail++; console.error(`  FAIL ${it.object}: ${res.status} ${await res.text()}`) }
}
console.log(`\nUploaded ${ok}/${items.length} (failed: ${fail})`)
process.exit(fail ? 1 : 0)
