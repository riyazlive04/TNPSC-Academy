import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

/**
 * Shared image resolver for the logical/ aptitude bank. Maps each question
 * `images[]` reference to a local file + a deterministic Storage object name, so
 * the uploader and the loader agree on bucket names / public URLs.
 *
 * Two ref shapes occur in the data:
 *   • local  — "images/<name>.png"               (original, pre-named files)
 *   • remote — "https://www.indiabix.com/_files/images/<a>/<b>/<c>.png"
 *              whose downloaded copy lives at images/<sub>/<a>__<b>__<c>.png
 *
 * Object name = the local file's basename (unique across the set).
 */

export const BUCKET = 'question-images'

/** Recursively index every file under <SRC_DIR>/images by basename → full path. */
export function buildImageIndex(srcDir) {
  const root = join(srcDir, 'images')
  const byName = new Map()
  if (!existsSync(root)) return byName
  ;(function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else byName.set(e, p) // basenames are unique across the tree
    }
  })(root)
  return byName
}

/** Resolve one image ref → { localPath, objectName } or null if not found. */
export function resolveRef(ref, srcDir, index) {
  if (/^https?:/i.test(ref)) {
    const m = ref.match(/_files\/images\/(.+)$/i)
    if (!m) return null
    const flat = m[1].replace(/\//g, '__')
    const localPath = index.get(flat)
    return localPath ? { localPath, objectName: flat } : null
  }
  const name = basename(ref)
  const direct = join(srcDir, ref)
  const localPath = existsSync(direct) ? direct : index.get(name)
  return localPath ? { localPath, objectName: name } : null
}

/** Public URL for a bucket object. Requires SUPABASE_URL in env. */
export function publicUrl(objectName) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${objectName}`
}

export function mimeFor(name) {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'application/octet-stream'
}
