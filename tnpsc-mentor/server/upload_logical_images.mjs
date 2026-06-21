import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute, basename } from 'node:path'
import { buildImageIndex, resolveRef, publicUrl, mimeFor, BUCKET } from './logical_images.mjs'

/**
 * Uploads every figure referenced by the logical/ bank to the Supabase Storage
 * `question-images` bucket (idempotent via x-upsert). Object names match the
 * loader's resolver, so import_logical.mjs can rewrite refs → public URLs.
 *
 * Usage:
 *   node upload_logical_images.mjs            # DRY RUN (lists what would upload)
 *   APPLY=1 node upload_logical_images.mjs    # actually upload
 *   node upload_logical_images.mjs <dir>      # override source dir
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = join(__dirname, '..', '..', '..', 'logical')
const argDir = process.argv[2]
const SRC_DIR = argDir ? (isAbsolute(argDir) ? argDir : join(process.cwd(), argDir)) : DEFAULT_DIR
const APPLY = process.env.APPLY === '1'

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in env.')
  process.exit(2)
}

// Collect every unique (objectName → localPath) across all files.
const index = buildImageIndex(SRC_DIR)
const objects = new Map() // objectName -> localPath
const unresolved = []
for (const f of readdirSync(SRC_DIR).filter((f) => /\.json$/i.test(f))) {
  const o = JSON.parse(readFileSync(join(SRC_DIR, f), 'utf8'))
  // Flat ({questions:[]}) or nested ({topics:[{questions:[]}]}, e.g. GOV.json).
  const qs = Array.isArray(o?.questions) ? o.questions
    : Array.isArray(o?.topics) ? o.topics.flatMap((t) => t.questions ?? [])
    : []
  for (const q of qs) {
    for (const ref of q.images ?? []) {
      const r = resolveRef(ref, SRC_DIR, index)
      if (!r) { unresolved.push(`${f} q${q.q_num}: ${ref}`); continue }
      const prev = objects.get(r.objectName)
      if (prev && prev !== r.localPath) {
        console.error(`COLLISION: object "${r.objectName}" from two files:\n  ${prev}\n  ${r.localPath}`)
        process.exit(1)
      }
      objects.set(r.objectName, r.localPath)
    }
  }
}

console.log(`Unique image objects to host: ${objects.size}`)
if (unresolved.length) {
  console.error(`UNRESOLVED refs: ${unresolved.length}`)
  unresolved.slice(0, 10).forEach((u) => console.error('  ' + u))
  process.exit(1)
}

if (!APPLY) {
  console.log('\nDRY RUN — no uploads. Sample:')
  ;[...objects.entries()].slice(0, 5).forEach(([n, p]) => console.log(`  ${n}  <-  ${basename(p)}`))
  console.log(`\nPublic URL pattern: ${publicUrl('<object>')}`)
  console.log('Re-run with APPLY=1 to upload.')
  process.exit(0)
}

let ok = 0, fail = 0
for (const [objectName, localPath] of objects) {
  const body = readFileSync(localPath)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(objectName)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': mimeFor(objectName),
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body,
  })
  if (res.ok) { ok++ }
  else { fail++; console.error(`  FAIL ${objectName}: ${res.status} ${await res.text()}`) }
  if ((ok + fail) % 25 === 0) console.log(`  ...${ok + fail}/${objects.size}`)
}
console.log(`\nUploaded ${ok} / ${objects.size} (failed: ${fail})`)
process.exit(fail ? 1 : 0)
