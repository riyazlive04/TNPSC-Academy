// One-off: shrink the CA magazine thumbnails already in Storage.
//
// They were uploaded at full resolution (25 objects, averaging 2.3 MB) and are
// displayed in a 160px card, so every reader paid for a full-size image on every
// visit. This downloads each one, writes the ORIGINAL to server/_thumb_backup/
// (nothing is destroyed), and re-uploads a downscaled WebP to the same path.
//
//   node _thumb_reencode.mjs            # download + report only, uploads nothing
//   node _thumb_reencode.mjs --apply    # actually replace the objects
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const APPLY = process.argv.includes('--apply')
const BUCKET = 'ca-deliverables'
const BACKUP = '_thumb_backup'
const CACHE_SECONDS = 3600

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Storage.list() is per-prefix, so walk the month/kind folders the thumbnails live in.
async function listThumbs() {
  const out = []
  const { data: months, error } = await sb.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) throw error
  for (const m of months ?? []) {
    if (m.id) continue // a file at the root, not a folder
    for (const kind of ['daily', 'monthly']) {
      const prefix = `${m.name}/${kind}`
      const { data: files } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 })
      for (const f of files ?? []) {
        if (f.name.startsWith('custom-thumb_')) {
          out.push({ path: `${prefix}/${f.name}`, size: f.metadata?.size ?? 0 })
        }
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

const thumbs = await listThumbs()
console.log(`${thumbs.length} custom thumbnails\n`)

let before = 0
let after = 0
const rows = []

for (const t of thumbs) {
  const localName = t.path.replace(/[\/]/g, '_')
  const origPath = `${BACKUP}/${localName}.orig`
  if (!existsSync(origPath)) {
    const { data, error } = await sb.storage.from(BUCKET).download(t.path)
    if (error) {
      console.log(`  SKIP ${t.path} — ${error.message}`)
      continue
    }
    writeFileSync(origPath, Buffer.from(await data.arrayBuffer()))
  }
  const orig = readFileSync(origPath)
  const outPath = `${BACKUP}/${localName}.webp`
  // Resize in Pillow (same 800px / q82 target as the browser-side downscale).
  const meta = JSON.parse(
    execFileSync('python', ['_thumb_resize.py', origPath, outPath], { encoding: 'utf-8' })
  )
  const small = readFileSync(outPath)
  before += orig.length
  after += small.length
  rows.push({
    path: t.path,
    from: `${(orig.length / 1024).toFixed(0)} KB`,
    to: `${(small.length / 1024).toFixed(0)} KB`,
    dims: `${meta.w}x${meta.h} → ${meta.nw}x${meta.nh}`,
    cut: `${(100 - (small.length / orig.length) * 100).toFixed(1)}%`,
  })

  if (APPLY) {
    const { error } = await sb.storage.from(BUCKET).upload(t.path, small, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: String(CACHE_SECONDS),
    })
    if (error) console.log(`  UPLOAD FAILED ${t.path} — ${error.message}`)
  }
}

console.table(rows)
console.log(
  `\ntotal ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB ` +
    `(${(100 - (after / before) * 100).toFixed(1)}% smaller)`
)
console.log(APPLY ? 'Objects REPLACED in Storage.' : 'Dry run — nothing uploaded. Re-run with --apply.')
