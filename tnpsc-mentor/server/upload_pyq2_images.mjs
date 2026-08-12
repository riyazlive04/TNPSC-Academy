import 'dotenv/config'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pushes the Group 2 figure crops to Supabase Storage. The DB columns (images /
 * option_images) are set by import_pyq2.mjs from the SAME filename convention,
 * so this script only uploads the files to the bucket.
 *
 *   Group_2/_img/<year>/q<no>.png          → stem figure        (images)
 *   Group_2/_img/<year>/q<no>_<a|b|c|d>.png → per-option figure  (option_images)
 *
 * Uploaded to `question-images/pyq2/<year>/<filename>` (idempotent x-upsert).
 * Files not matching q<digits>[_<letter>].<ext> are ignored (e.g. "q154 copy.png").
 *
 *   node upload_pyq2_images.mjs            # DRY RUN (lists files)
 *   APPLY=1 node upload_pyq2_images.mjs    # upload
 */

const IMG_ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/Group_2/_img'
const BUCKET = 'question-images'
const APPLY = process.env.APPLY === '1'
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

const NAME_RE = /^q\d+(_[a-d])?\.(png|jpe?g|webp)$/i
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
    items.push({ object: `pyq2/${year}/${f}`, localPath: join(dir, f) })
  }
}

console.log(`Found ${items.length} crops to upload to ${BUCKET}/pyq2/...`)
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
