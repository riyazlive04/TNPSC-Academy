import express, { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

// Private Storage bucket for uploaded files (images/PDFs/documents). Created
// once by server/setup-materials-bucket.mjs. Videos are YouTube links and never
// touch storage. Private → access only via short-lived signed URLs below.
const MATERIALS_BUCKET = 'materials'
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB, matches the bucket limit

// Metadata returned to clients. No file URLs — those are minted on demand by
// GET /:id/file so the per-item download gate can't be bypassed. Shared with
// the CA-magazine publish route, which inserts kind='magazine' rows here.
export const MATERIAL_COLS =
  'id, kind, placement, title, title_ta, description, youtube_id, file_name, file_size, mime_type, magazine_ca_type, magazine_date, downloadable, active, sort_order, created_at'
const COLS = MATERIAL_COLS

type Placement = 'materials' | 'profile'
type Kind = 'video' | 'image' | 'pdf' | 'document'

/** Extract the 11-char YouTube id from any URL form, or accept a bare id. */
function parseYouTubeId(input: string): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/live\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}

/** Classify an uploaded file into a material kind from its mime/extension. */
function kindFromFile(mime: string, name: string): Exclude<Kind, 'video'> {
  if (/^image\//i.test(mime)) return 'image'
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  return 'document'
}

// ─── GET /api/materials?placement=materials|profile ──────────────────────────
// Active items for a placement, shown to every signed-in user. Metadata only —
// the client builds YouTube thumbnails from youtube_id and fetches a signed URL
// for files only when an item is opened/downloaded.
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const placement: Placement = req.query.placement === 'profile' ? 'profile' : 'materials'
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select(COLS)
      .eq('active', true)
      .eq('placement', placement)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) return sendDbError(res, error)
    res.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')
    res.json({ materials: data ?? [] })
  })
)

// ─── GET /api/materials/:id/file?mode=view|download ──────────────────────────
// A short-lived signed URL for an uploaded file. mode=download forces an
// attachment download and is REFUSED unless the item is flagged downloadable —
// the gate the superadmin controls. Videos don't use this endpoint.
router.get(
  '/:id/file',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const mode = req.query.mode === 'download' ? 'download' : 'view'
    const { data: row, error } = await supabaseAdmin
      .from('materials')
      .select('kind, storage_path, file_name, downloadable, active')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!row || !row.active) return res.status(404).json({ error: 'Material not found.' })
    if (row.kind === 'video' || !row.storage_path) {
      return res.status(400).json({ error: 'This material has no downloadable file.' })
    }
    if (mode === 'download' && !row.downloadable) {
      return res.status(403).json({ error: 'Downloading is disabled for this material.' })
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(MATERIALS_BUCKET)
      .createSignedUrl(
        row.storage_path as string,
        mode === 'download' ? 120 : 300,
        mode === 'download' ? { download: (row.file_name as string) || true } : {}
      )
    if (signErr || !signed?.signedUrl) {
      return res.status(502).json({ error: 'Could not prepare the file. Please try again.' })
    }
    res.json({ url: signed.signedUrl })
  })
)

// ─── Superadmin: manage the catalogue ────────────────────────────────────────
const admin = [requireAuth, requireSuperadmin] as const

// GET /api/materials/admin — every item (active or hidden), all placements.
router.get(
  '/admin',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select(COLS)
      .order('placement', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return sendDbError(res, error)
    res.json({ materials: data ?? [] })
  })
)

// POST /api/materials/video — add a YouTube video (placement: profile|materials).
router.post(
  '/video',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const title = String(req.body?.title ?? '').trim()
    const titleTa = req.body?.title_ta ? String(req.body.title_ta).trim() : null
    const description = req.body?.description ? String(req.body.description).trim() : null
    const placement: Placement = req.body?.placement === 'profile' ? 'profile' : 'materials'
    const youtubeId = parseYouTubeId(String(req.body?.url ?? ''))
    const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Math.trunc(Number(req.body.sort_order)) : 0

    if (!title) return res.status(400).json({ error: 'A title is required.' })
    if (!youtubeId) return res.status(400).json({ error: 'Could not read a YouTube video id from that link.' })

    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({
        kind: 'video',
        placement,
        title,
        title_ta: titleTa,
        description,
        youtube_id: youtubeId,
        sort_order: sortOrder,
        created_by: req.userId,
      })
      .select(COLS)
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ material: data })
  })
)

// POST /api/materials/file — upload an image/PDF/document (always placement
// 'materials'). The binary is the raw body (Content-Type = the file's mime);
// title/description/downloadable/sort_order ride in the query string, filename
// in x-file-name. Mirrors the APK upload so the global JSON parser skips it.
router.post(
  '/file',
  ...admin,
  express.raw({ type: () => true, limit: '55mb' }),
  asyncH(async (req: AuthedRequest, res) => {
    const title = String(req.query.title ?? '').trim()
    const titleTa = req.query.title_ta ? String(req.query.title_ta).trim() : null
    const description = req.query.description ? String(req.query.description).trim() : null
    const downloadable = req.query.downloadable === 'true'
    const sortOrder = Number.isFinite(Number(req.query.sort_order)) ? Math.trunc(Number(req.query.sort_order)) : 0
    const rawName = String(req.headers['x-file-name'] ?? '').trim() || 'file'
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')

    if (!title) return res.status(400).json({ error: 'A title is required.' })
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'No file was uploaded.' })
    }
    if (body.length > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'That file is too large (max 50 MB).' })
    }

    const kind = kindFromFile(mime, rawName)
    const safeName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '-').slice(0, 120)
    const storagePath = `${kind}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabaseAdmin.storage
      .from(MATERIALS_BUCKET)
      .upload(storagePath, body, { contentType: mime, upsert: false })
    if (upErr) {
      console.error('[materials upload]', upErr)
      return res.status(502).json({ error: 'Upload to storage failed. Please try again.' })
    }

    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({
        kind,
        placement: 'materials',
        title,
        title_ta: titleTa,
        description,
        storage_path: storagePath,
        file_name: rawName,
        file_size: body.length,
        mime_type: mime,
        downloadable,
        sort_order: sortOrder,
        created_by: req.userId,
      })
      .select(COLS)
      .single()
    if (error) {
      // Roll back the orphaned object so a failed insert leaves no dangling file.
      await supabaseAdmin.storage.from(MATERIALS_BUCKET).remove([storagePath])
      return sendDbError(res, error)
    }
    res.status(201).json({ material: data })
  })
)

// PATCH /api/materials/:id — edit text / placement / toggle active+downloadable
// / reorder. Only keys present in the body are touched. Files aren't re-uploaded
// here (delete + re-add to replace a file).
router.patch(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const patch: Record<string, unknown> = {}
    if (typeof b.title === 'string') patch.title = b.title.trim()
    if ('title_ta' in b) patch.title_ta = b.title_ta ? String(b.title_ta).trim() : null
    if ('description' in b) patch.description = b.description ? String(b.description).trim() : null
    if (b.placement === 'profile' || b.placement === 'materials') patch.placement = b.placement
    if (typeof b.active === 'boolean') patch.active = b.active
    if (typeof b.downloadable === 'boolean') patch.downloadable = b.downloadable
    if (b.sort_order != null && Number.isFinite(Number(b.sort_order))) patch.sort_order = Math.trunc(Number(b.sort_order))
    if (b.url != null) {
      const youtubeId = parseYouTubeId(String(b.url))
      if (!youtubeId) return res.status(400).json({ error: 'Could not read a YouTube video id from that link.' })
      patch.youtube_id = youtubeId
    }
    if (typeof patch.title === 'string' && !patch.title) {
      return res.status(400).json({ error: 'A title is required.' })
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('materials')
      .update(patch)
      .eq('id', req.params.id)
      .select(COLS)
      .single()
    if (error) return sendDbError(res, error)
    res.json({ material: data })
  })
)

// DELETE /api/materials/:id — remove the row (and its stored file, if any).
router.delete(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from('materials')
      .select('storage_path')
      .eq('id', req.params.id)
      .maybeSingle()
    if (lookupErr) return sendDbError(res, lookupErr)
    if (row?.storage_path) {
      await supabaseAdmin.storage.from(MATERIALS_BUCKET).remove([row.storage_path as string])
    }
    const { error } = await supabaseAdmin.from('materials').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

export default router
