import express, { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { MATERIAL_COLS } from './materials.js'

const router = Router()

// The VPS pipeline pushes magazine items into ca_magazine (RLS on, no
// policies — service-role only). Students never read that table directly:
// a superadmin reviews an issue here and APPROVES it, which inserts a
// materials row (kind='magazine') referencing the issue by
// (magazine_ca_type, magazine_date). The user-facing read below is gated on
// that row being present AND active, so hide/delete in the Materials tab
// unpublishes instantly while the ca_magazine rows stay untouched.

const ITEM_COLS = 'id, external_id, ca_type, date, ca_month, topic, title, title_ta, content, content_ta'

const CA_TYPES = new Set(['day_wise', 'month_wise'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/** 'July 2026' label for a date, used when an issue has no rows to copy from. */
function deriveMonth(date: string): { ca_month: string; ca_year: number } {
  const [y, mo] = date.split('-').map(Number)
  return { ca_month: `${MONTHS_EN[(mo ?? 1) - 1] ?? ''} ${y}`.trim(), ca_year: y }
}

// Every issue is named the same — the date is a separate line, not part of the
// name — and no source publication is credited anywhere a student can see.
// The app renders both lines from (magazine_ca_type, magazine_date), so these
// stored values only back the admin lists.
const MAGAZINE_NAME_EN = 'Current Affair'
const MAGAZINE_NAME_TA = 'நடப்பு நிகழ்வுகள்'

/** '9 July 2026' (daily) / 'July 2026' (monthly) — the issue's date line. */
function issueDateLabel(caType: string, date: string, caMonth: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const monthEn = MONTHS_EN[(mo ?? 1) - 1] ?? caMonth.split(' ')[0]
  return caType === 'day_wise' ? `${d} ${monthEn} ${y}` : `${monthEn} ${y}`
}

// ─── News image (the issue's thumbnail) ──────────────────────────────────────
// Two sources, in priority order:
//   1. an image a superadmin uploaded for this issue (any ca_type), and
//   2. the one the CA pipeline drops for each DAILY issue.
// Neither is recorded in the DB — both paths are derived from the issue's date,
// so we just try to sign them in turn. A missing object is NORMAL (a holiday,
// before the ~06:00 IST push, or simply no custom image): the sign call 400/404s
// and we report "no image" rather than an error.
//
// Keeping the admin upload on its OWN path is what makes the two safe together:
// the morning push can never overwrite a hand-picked thumbnail, and removing the
// custom one falls straight back to the pipeline's image.
const CA_DELIVERABLES_BUCKET = 'ca-deliverables'
const NEWS_IMAGE_TTL_SECONDS = 3600
/** A thumbnail is displayed a few hundred pixels wide — this is already generous. */
const MAX_THUMB_MB = 8
const ALLOWED_THUMB_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

/** '2026-07-09' → '2026-07/daily/newsimage_2026-07-09.jpg' (pipeline). */
function newsImagePath(date: string): string {
  return `${date.slice(0, 7)}/daily/newsimage_${date}.jpg`
}

/** The superadmin-uploaded thumbnail for an issue. Extension-less: the object's
 * stored content-type is what the browser renders it by, so one path serves a
 * JPEG, PNG or WebP and a replacement never leaves an orphan behind. */
function customThumbPath(caType: string, date: string): string {
  const kind = caType === 'day_wise' ? 'daily' : 'monthly'
  return `${date.slice(0, 7)}/${kind}/custom-thumb_${date}`
}

/** Sign one object, or null when it isn't there. */
async function signObject(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(CA_DELIVERABLES_BUCKET)
    .createSignedUrl(path, NEWS_IMAGE_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** A 1-hour signed URL for an issue's thumbnail: the custom one if a superadmin
 * uploaded it, else the pipeline's daily image, else null. */
async function signNewsImage(caType: string, date: string): Promise<string | null> {
  if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) return null
  const custom = await signObject(customThumbPath(caType, date))
  if (custom) return custom
  if (caType !== 'day_wise') return null
  return signObject(newsImagePath(date))
}

const admin = [requireAuth, requireSuperadmin] as const

// ─── GET /api/ca-magazine/admin/issues ────────────────────────────────────────
// Every pushed issue (grouped per day / per month) with its item count and,
// when approved, the materials row that publishes it.
router.get(
  '/admin/issues',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data: issues, error } = await supabaseAdmin.rpc('ca_magazine_issues')
    if (error) return sendDbError(res, error)

    const { data: pubs, error: pubErr } = await supabaseAdmin
      .from('materials')
      .select('id, active, downloadable, magazine_ca_type, magazine_date')
      .eq('kind', 'magazine')
    if (pubErr) return sendDbError(res, pubErr)

    const byIssue = new Map(
      (pubs ?? []).map((p) => [
        `${p.magazine_ca_type}|${p.magazine_date}`,
        { id: p.id as string, active: p.active as boolean, downloadable: p.downloadable as boolean },
      ])
    )
    res.json({
      issues: (issues ?? []).map((i: { ca_type: string; date: string; ca_month: string; ca_year: number | null; items: number }) => ({
        ...i,
        material: byIssue.get(`${i.ca_type}|${i.date}`) ?? null,
      })),
    })
  })
)

// ─── GET /api/ca-magazine/admin/items?ca_type=&date= ─────────────────────────
// Full item list of one issue — the superadmin preview before approving.
router.get(
  '/admin/items',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    const { data, error } = await supabaseAdmin
      .from('ca_magazine')
      .select(ITEM_COLS)
      .eq('ca_type', caType)
      .eq('date', date)
      .order('external_id', { ascending: true })
      .limit(1000)
    if (error) return sendDbError(res, error)
    res.json({ items: data ?? [] })
  })
)

// ─── GET /api/ca-magazine/admin/news-image?ca_type=&date= ────────────────────
// The issue's news image for the superadmin preview (works before the issue is
// approved). `url: null` = no image for that date, which is not an error.
// Declared among /admin/* so it wins over /:materialId/news-image.
router.get(
  '/admin/news-image',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    res.json({ url: await signNewsImage(caType, date) })
  })
)

// ─── POST /api/ca-magazine/admin/news-image?ca_type=&date= ───────────────────
// Replace the issue's thumbnail with an uploaded image. The binary is the raw
// body (Content-Type = the image's mime), mirroring the materials/APK uploads so
// the global JSON parser skips it. Upserted onto the fixed custom path, so
// re-uploading simply replaces it. Responds with the new signed URL.
router.post(
  '/admin/news-image',
  ...admin,
  express.raw({ type: () => true, limit: `${MAX_THUMB_MB + 1}mb` }),
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    const mime = String(req.headers['content-type'] ?? '')
    if (!ALLOWED_THUMB_MIME.has(mime)) {
      return res.status(415).json({ error: 'Use a JPG, PNG or WebP image.' })
    }
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'No image was uploaded.' })
    }
    if (body.length > MAX_THUMB_MB * 1024 * 1024) {
      return res.status(413).json({ error: `That image is too large (max ${MAX_THUMB_MB} MB).` })
    }

    const { error } = await supabaseAdmin.storage
      .from(CA_DELIVERABLES_BUCKET)
      .upload(customThumbPath(caType, date), body, {
        contentType: mime,
        upsert: true,
        // Short: a replacement should reach students in about a minute, not an
        // hour — these are small files and read through signed URLs anyway.
        cacheControl: '60',
      })
    if (error) {
      console.error('[ca-magazine thumb upload]', error)
      return res.status(502).json({ error: 'Could not store the image. Please try again.' })
    }
    res.status(201).json({ url: await signNewsImage(caType, date) })
  })
)

// ─── DELETE /api/ca-magazine/admin/news-image?ca_type=&date= ─────────────────
// Drop the custom thumbnail. The response carries whatever the issue falls back
// to — the pipeline's own image for a daily issue, or null.
router.delete(
  '/admin/news-image',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.query.ca_type ?? '')
    const date = String(req.query.date ?? '')
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    const { error } = await supabaseAdmin.storage
      .from(CA_DELIVERABLES_BUCKET)
      .remove([customThumbPath(caType, date)])
    // Removing something that was never there is not a failure.
    if (error) console.error('[ca-magazine thumb remove]', error)
    res.json({ url: await signNewsImage(caType, date) })
  })
)

// ─── POST /api/ca-magazine/admin/publish {ca_type, date} ─────────────────────
// Approve an issue: insert the kind='magazine' materials row. The partial
// unique index (magazine_ca_type, magazine_date) makes a double-approve a 409.
router.post(
  '/admin/publish',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const caType = String(req.body?.ca_type ?? '')
    const date = String(req.body?.date ?? '')
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }

    const { data: sample, error: cntErr, count } = await supabaseAdmin
      .from('ca_magazine')
      .select('ca_month', { count: 'exact' })
      .eq('ca_type', caType)
      .eq('date', date)
      .limit(1)
    if (cntErr) return sendDbError(res, cntErr)
    if (!count || !sample?.length) {
      return res.status(404).json({ error: 'No magazine items exist for that issue.' })
    }

    const caMonth = sample[0].ca_month as string
    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({
        kind: 'magazine',
        placement: 'materials',
        title: MAGAZINE_NAME_EN,
        title_ta: MAGAZINE_NAME_TA,
        description: issueDateLabel(caType, date, caMonth),
        magazine_ca_type: caType,
        magazine_date: date,
        created_by: req.userId,
      })
      .select(MATERIAL_COLS)
      .single()
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This issue is already published.' })
      }
      return sendDbError(res, error)
    }
    res.status(201).json({ material: data })
  })
)

// ─── POST /api/ca-magazine/admin/items ───────────────────────────────────────
// Add a new item to an issue. Manual items get an external_id the pipeline can
// never emit (`ca-mag-<date>-m<epoch>`) so a later daily push (insert-only on
// external_id) never touches or duplicates them.
router.post(
  '/admin/items',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const caType = String(b.ca_type ?? '')
    const date = String(b.date ?? '')
    const topic = String(b.topic ?? '').trim().toUpperCase()
    const title = String(b.title ?? '').trim()
    const content = String(b.content ?? '').trim()
    if (!CA_TYPES.has(caType) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Invalid issue reference.' })
    }
    if (!topic || !title || !content) {
      return res.status(400).json({ error: 'Section, title and content are all required.' })
    }

    // Keep ca_month/ca_year consistent with the rest of the issue.
    const { data: sample } = await supabaseAdmin
      .from('ca_magazine')
      .select('ca_month, ca_year')
      .eq('ca_type', caType)
      .eq('date', date)
      .limit(1)
    const meta = sample?.length
      ? { ca_month: sample[0].ca_month as string, ca_year: sample[0].ca_year as number }
      : deriveMonth(date)

    const { data, error } = await supabaseAdmin
      .from('ca_magazine')
      .insert({
        external_id: `ca-mag-${date}-m${Date.now()}`,
        category: 'current_affairs',
        ca_type: caType,
        date,
        ca_month: meta.ca_month,
        ca_year: meta.ca_year,
        topic,
        title,
        title_ta: b.title_ta ? String(b.title_ta).trim() : null,
        content,
        content_ta: b.content_ta ? String(b.content_ta).trim() : null,
        source_url: 'admin-added',
      })
      .select(ITEM_COLS)
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ item: data })
  })
)

// ─── PATCH /api/ca-magazine/admin/items/:id ──────────────────────────────────
// Edit an item's section/title/content (either language). Only keys present in
// the body are touched. Safe against the pipeline: it never UPDATEs existing
// external_ids, so an edited row is not overwritten by a re-push.
router.patch(
  '/admin/items/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Item not found.' })
    const b = req.body ?? {}
    const patch: Record<string, unknown> = {}
    if (typeof b.topic === 'string') patch.topic = b.topic.trim().toUpperCase()
    if (typeof b.title === 'string') patch.title = b.title.trim()
    if ('title_ta' in b) patch.title_ta = b.title_ta ? String(b.title_ta).trim() : null
    if (typeof b.content === 'string') patch.content = b.content.trim()
    if ('content_ta' in b) patch.content_ta = b.content_ta ? String(b.content_ta).trim() : null
    if (patch.topic === '') return res.status(400).json({ error: 'Section cannot be empty.' })
    if (patch.title === '') return res.status(400).json({ error: 'A title is required.' })
    if (patch.content === '') return res.status(400).json({ error: 'Content is required.' })
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('ca_magazine')
      .update(patch)
      .eq('id', req.params.id)
      .select(ITEM_COLS)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!data) return res.status(404).json({ error: 'Item not found.' })
    res.json({ item: data })
  })
)

// ─── DELETE /api/ca-magazine/admin/items/:id ─────────────────────────────────
router.delete(
  '/admin/items/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Item not found.' })
    const { error } = await supabaseAdmin.from('ca_magazine').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── GET /api/ca-magazine/recent?limit=7 ─────────────────────────────────────
// The most recent PUBLISHED daily issues for the dashboard carousel, each with
// its signed news-image URL — one round trip instead of a sign call per card.
// Publication-driven: only active kind='magazine' day_wise rows appear, so the
// superadmin's approve/hide is the only control. Declared before /:materialId/*.
router.get(
  '/recent',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 7, 1), 14)
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('id, downloadable, magazine_date')
      .eq('kind', 'magazine')
      .eq('active', true)
      .eq('magazine_ca_type', 'day_wise')
      .not('magazine_date', 'is', null)
      .order('magazine_date', { ascending: false })
      .limit(limit)
    if (error) return sendDbError(res, error)

    const issues = await Promise.all(
      (data ?? []).map(async (r) => ({
        id: r.id as string,
        date: r.magazine_date as string,
        downloadable: r.downloadable as boolean,
        newsImage: await signNewsImage('day_wise', r.magazine_date as string),
      }))
    )
    // Well inside the signed URLs' 1-hour lifetime, and short enough that a
    // replaced thumbnail shows up on the dashboard within minutes.
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ issues })
  })
)

// ─── GET /api/ca-magazine/thumbnails ─────────────────────────────────────────
// Every PUBLISHED issue's thumbnail, keyed by the materials row id, so the
// Materials grid can show the issues as covers instead of a wall of identical
// newspaper icons. One batch sign call per candidate path set (not two per
// card), and the same custom → pipeline priority signNewsImage applies.
// Declared before /:materialId/* so this literal path wins the match.
router.get(
  '/thumbnails',
  requireAuth,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('id, magazine_ca_type, magazine_date')
      .eq('kind', 'magazine')
      .eq('active', true)
      .not('magazine_date', 'is', null)
      .order('magazine_date', { ascending: false })
      .limit(300)
    if (error) return sendDbError(res, error)

    const rows = (data ?? []).filter(
      (r) => CA_TYPES.has(String(r.magazine_ca_type)) && DATE_RE.test(String(r.magazine_date))
    ) as { id: string; magazine_ca_type: string; magazine_date: string }[]

    /** Batch-sign a path list; missing objects simply don't land in the map. */
    const signMany = async (paths: string[]): Promise<Map<string, string>> => {
      const out = new Map<string, string>()
      if (paths.length === 0) return out
      const { data: signed } = await supabaseAdmin.storage
        .from(CA_DELIVERABLES_BUCKET)
        .createSignedUrls(paths, NEWS_IMAGE_TTL_SECONDS)
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) out.set(s.path, s.signedUrl)
      }
      return out
    }

    const [customs, pipeline] = await Promise.all([
      signMany(rows.map((r) => customThumbPath(r.magazine_ca_type, r.magazine_date))),
      signMany(
        rows
          .filter((r) => r.magazine_ca_type === 'day_wise')
          .map((r) => newsImagePath(r.magazine_date))
      ),
    ])

    const thumbs: Record<string, string> = {}
    for (const r of rows) {
      const url =
        customs.get(customThumbPath(r.magazine_ca_type, r.magazine_date)) ??
        (r.magazine_ca_type === 'day_wise' ? pipeline.get(newsImagePath(r.magazine_date)) : null)
      if (url) thumbs[r.id] = url
    }

    // Half the signed URLs' lifetime, so a cached response always has time left
    // on its URLs, and a replaced thumbnail still reaches readers within minutes.
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ thumbs })
  })
)

// ─── GET /api/ca-magazine/:materialId/items ──────────────────────────────────
// Student read: the items of a PUBLISHED (active) issue, addressed by the
// materials row users see in the Materials tab. Declared after /admin/* so
// those literal paths win the match.
router.get(
  '/:materialId/items',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const id = req.params.materialId
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Magazine not found.' })

    const { data: mat, error } = await supabaseAdmin
      .from('materials')
      .select('kind, active, magazine_ca_type, magazine_date')
      .eq('id', id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!mat || mat.kind !== 'magazine' || !mat.active || !mat.magazine_ca_type || !mat.magazine_date) {
      return res.status(404).json({ error: 'Magazine not found.' })
    }

    const { data, error: itemsErr } = await supabaseAdmin
      .from('ca_magazine')
      .select(ITEM_COLS)
      .eq('ca_type', mat.magazine_ca_type)
      .eq('date', mat.magazine_date)
      .order('external_id', { ascending: true })
      .limit(1000)
    if (itemsErr) return sendDbError(res, itemsErr)
    // Items are immutable once pushed (insert-only pipeline) — cache briefly.
    res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    res.json({ items: data ?? [] })
  })
)

// ─── GET /api/ca-magazine/:materialId/news-image ─────────────────────────────
// The news image of a PUBLISHED (active) daily issue, gated exactly like the
// items read above. `url: null` = no image for that date — the client just
// renders no image. Cached for half the signed URL's lifetime so a cached URL
// always has time left on it.
router.get(
  '/:materialId/news-image',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const id = req.params.materialId
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Magazine not found.' })

    const { data: mat, error } = await supabaseAdmin
      .from('materials')
      .select('kind, active, magazine_ca_type, magazine_date')
      .eq('id', id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!mat || mat.kind !== 'magazine' || !mat.active || !mat.magazine_ca_type || !mat.magazine_date) {
      return res.status(404).json({ error: 'Magazine not found.' })
    }

    const url = await signNewsImage(mat.magazine_ca_type as string, mat.magazine_date as string)
    // Short enough that a thumbnail a superadmin just replaced reaches readers
    // within minutes, and still well inside the signed URL's 1-hour lifetime.
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ url })
  })
)

export default router
