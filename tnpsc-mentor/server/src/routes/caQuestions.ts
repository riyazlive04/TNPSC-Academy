import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { MATERIAL_COLS } from './materials.js'

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_TA: Record<string, string> = {
  January: 'ஜனவரி', February: 'பிப்ரவரி', March: 'மார்ச்', April: 'ஏப்ரல்',
  May: 'மே', June: 'ஜூன்', July: 'ஜூலை', August: 'ஆகஸ்ட்',
  September: 'செப்டம்பர்', October: 'அக்டோபர்', November: 'நவம்பர்', December: 'டிசம்பர்',
}

/** Bilingual card titles for a published question set. */
function setTitles(source: string, key: string) {
  if (source === 'daily') {
    const [y, mo, d] = key.split('-').map(Number)
    const monthEn = MONTHS_EN[(mo ?? 1) - 1] ?? ''
    const monthTa = MONTHS_TA[monthEn] ?? monthEn
    return {
      title: `Daily CA Questions — ${d} ${monthEn} ${y}`,
      title_ta: `தினசரி நடப்பு வினாக்கள் — ${d} ${monthTa} ${y}`,
    }
  }
  const [monthEn, y] = key.split(' ')
  const monthTa = MONTHS_TA[monthEn] ?? monthEn
  return {
    title: `Monthly CA Questions — ${key}`,
    title_ta: `மாதாந்திர நடப்பு வினாக்கள் — ${monthTa} ${y}`,
  }
}

// Read-only superadmin viewer for the CA questions the VPS pipeline generates:
//   • DAILY sets  → ca_daily_questions (day_wise, ~15/day, kept out of the
//     monthly banks). Grouped per day.
//   • MONTHLY banks → public.questions (category='current_affairs',
//     ca_type='month_wise', 240/month). Grouped per ca_month via the existing
//     ca_month_counts() RPC.
// Both tables are RLS-locked (service-role only); this route is the read path.

const QUESTION_COLS =
  'external_id, topic, question_type, difficulty, question_text, ' +
  'option_a, option_b, option_c, option_d, correct_answer, explanation, why_wrong, ' +
  'question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta, explanation_ta'

// Daily rows also carry the bigint PK + review state (the monthly `questions`
// table has neither) — returned so the superadmin can verify/edit/remove them.
const DAILY_COLS = `id, verified, verified_at, ${QUESTION_COLS}`

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^[A-Za-z]+ \d{4}$/
const ID_RE = /^\d+$/

const admin = [requireAuth, requireSuperadmin] as const

// The columns a superadmin may write on a daily question (everything except the
// pipeline/identity fields). `null`-able so a language twin can be cleared.
const TEXT_FIELDS = [
  'topic', 'question_type', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'explanation',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta', 'explanation_ta',
] as const

/** Normalize a correct-answer to a single 'A'–'D' (accepts a/b/c/d). */
function normAnswer(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase()
  return /^[ABCD]$/.test(s) ? s : null
}

// ─── GET /api/ca-questions/admin/sets ────────────────────────────────────────
// Daily sets (grouped per date) + monthly banks (grouped per ca_month).
router.get(
  '/admin/sets',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    // Daily: group in the app layer (small, admin-only, recent-first).
    const { data: dailyRows, error: dErr } = await supabaseAdmin
      .from('ca_daily_questions')
      .select('date, ca_month, ca_year')
      .order('date', { ascending: false })
      .limit(5000)
    if (dErr) return sendDbError(res, dErr)

    const byDate = new Map<string, { ca_month: string; ca_year: number | null; total: number }>()
    for (const r of dailyRows ?? []) {
      const key = String(r.date)
      const cur = byDate.get(key)
      if (cur) cur.total += 1
      else byDate.set(key, { ca_month: (r.ca_month as string) ?? '', ca_year: (r.ca_year as number) ?? null, total: 1 })
    }
    const daily = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, v]) => ({ source: 'daily' as const, key: date, date, ca_month: v.ca_month, ca_year: v.ca_year, total: v.total }))

    // Monthly: the same grouped counts the students' month picker uses.
    const { data: months, error: mErr } = await supabaseAdmin.rpc('ca_month_counts')
    if (mErr) return sendDbError(res, mErr)
    const monthly = (months ?? []).map(
      (m: { ca_month: string; ca_year: number | null; total: number | string }) => ({
        source: 'monthly' as const,
        key: m.ca_month,
        date: null,
        ca_month: m.ca_month,
        ca_year: m.ca_year,
        total: Number(m.total),
      })
    )

    // Which sets are published to students (kind='questions' materials rows).
    const { data: pubs, error: pErr } = await supabaseAdmin
      .from('materials')
      .select('id, active, downloadable, questions_source, questions_key')
      .eq('kind', 'questions')
    if (pErr) return sendDbError(res, pErr)
    const byKey = new Map(
      (pubs ?? []).map((p) => [
        `${p.questions_source}|${p.questions_key}`,
        { id: p.id as string, active: p.active as boolean, downloadable: p.downloadable as boolean },
      ])
    )
    const withMaterial = <T extends { source: string; key: string }>(s: T) => ({
      ...s,
      material: byKey.get(`${s.source}|${s.key}`) ?? null,
    })

    res.json({ daily: daily.map(withMaterial), monthly: monthly.map(withMaterial) })
  })
)

// ─── GET /api/ca-questions/admin/items?source=&date=|ca_month= ────────────────
// Every question in one set, bilingual, for the superadmin preview.
router.get(
  '/admin/items',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const source = String(req.query.source ?? '')
    if (source === 'daily') {
      const date = String(req.query.date ?? '')
      if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date.' })
      const { data, error } = await supabaseAdmin
        .from('ca_daily_questions')
        .select(DAILY_COLS)
        .eq('date', date)
        .order('external_id', { ascending: true })
        .limit(1000)
      if (error) return sendDbError(res, error)
      return res.json({ items: data ?? [] })
    }
    if (source === 'monthly') {
      const caMonth = String(req.query.ca_month ?? '')
      if (!MONTH_RE.test(caMonth)) return res.status(400).json({ error: 'Invalid month.' })
      const { data, error } = await supabaseAdmin
        .from('questions')
        .select(QUESTION_COLS)
        .eq('category', 'current_affairs')
        .eq('ca_type', 'month_wise')
        .eq('ca_month', caMonth)
        .order('external_id', { ascending: true })
        .limit(1000)
      if (error) return sendDbError(res, error)
      return res.json({ items: data ?? [] })
    }
    res.status(400).json({ error: 'Invalid source.' })
  })
)

// ─── Superadmin curation of DAILY questions (ca_daily_questions only) ─────────
// The monthly bank (public.questions) stays read-only here — it's the
// student-served bank, corrected via server/update-ca.mjs. These endpoints are
// scoped to ca_daily_questions, which nothing serves yet.

// ─── POST /api/ca-questions/admin/daily/items ────────────────────────────────
// Add a question to a day. Admin-added rows get an external_id the pipeline can
// never emit (`ca-daily-<date>-m<epoch>`) so a later push (insert-only on
// external_id) never touches or duplicates them.
router.post(
  '/admin/daily/items',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const b = req.body ?? {}
    const date = String(b.date ?? '')
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date.' })
    const answer = normAnswer(b.correct_answer)
    const qt = String(b.question_text ?? '').trim()
    const missing = ['option_a', 'option_b', 'option_c', 'option_d'].filter((k) => !String(b[k] ?? '').trim())
    if (!qt) return res.status(400).json({ error: 'Question text is required.' })
    if (missing.length) return res.status(400).json({ error: 'All four options are required.' })
    if (!answer) return res.status(400).json({ error: 'Correct answer must be A, B, C or D.' })

    // Keep ca_month/ca_year consistent with the rest of that day's set.
    const { data: sample } = await supabaseAdmin
      .from('ca_daily_questions')
      .select('ca_month, ca_year')
      .eq('date', date)
      .limit(1)
    const meta = sample?.length
      ? { ca_month: sample[0].ca_month as string | null, ca_year: sample[0].ca_year as number | null }
      : { ca_month: null, ca_year: null }

    const row: Record<string, unknown> = {
      external_id: `ca-daily-${date}-m${Date.now()}`,
      category: 'current_affairs',
      ca_type: 'day_wise',
      date,
      ca_month: meta.ca_month,
      ca_year: meta.ca_year,
      correct_answer: answer,
      source_url: 'admin-added',
      verified: true, // a hand-authored question is reviewed by definition
      verified_at: new Date().toISOString(),
      verified_by: req.userId,
    }
    for (const f of TEXT_FIELDS) {
      if (f in b) row[f] = b[f] == null || b[f] === '' ? null : String(b[f]).trim()
    }
    row.question_text = qt

    const { data, error } = await supabaseAdmin
      .from('ca_daily_questions')
      .insert(row)
      .select(DAILY_COLS)
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ item: data })
  })
)

// ─── PATCH /api/ca-questions/admin/daily/items/:id ───────────────────────────
// Edit fields and/or toggle `verified`. Only keys present in the body are
// touched. Safe against the pipeline (never UPDATEs existing external_ids).
router.patch(
  '/admin/daily/items/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'Question not found.' })
    const b = req.body ?? {}
    const patch: Record<string, unknown> = {}

    for (const f of TEXT_FIELDS) {
      if (f in b) {
        const v = b[f] == null ? null : String(b[f]).trim()
        // Core EN fields must not be blanked; language twins may be cleared.
        if (!f.endsWith('_ta') && !v) {
          return res.status(400).json({ error: `${f.replace(/_/g, ' ')} cannot be empty.` })
        }
        patch[f] = v || null
      }
    }
    if ('correct_answer' in b) {
      const a = normAnswer(b.correct_answer)
      if (!a) return res.status(400).json({ error: 'Correct answer must be A, B, C or D.' })
      patch.correct_answer = a
    }
    if ('verified' in b) {
      const on = Boolean(b.verified)
      patch.verified = on
      patch.verified_at = on ? new Date().toISOString() : null
      patch.verified_by = on ? req.userId : null
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('ca_daily_questions')
      .update(patch)
      .eq('id', Number(req.params.id))
      .select(DAILY_COLS)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!data) return res.status(404).json({ error: 'Question not found.' })
    res.json({ item: data })
  })
)

// ─── DELETE /api/ca-questions/admin/daily/items/:id ──────────────────────────
router.delete(
  '/admin/daily/items/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'Question not found.' })
    const { error } = await supabaseAdmin
      .from('ca_daily_questions')
      .delete()
      .eq('id', Number(req.params.id))
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── POST /api/ca-questions/admin/publish {source, key} ──────────────────────
// Turn ON the student PDF for a set: insert the kind='questions' materials row
// (active + downloadable). Toggling off later is a PATCH via /api/materials.
// The partial unique index makes a double-publish a 409.
router.post(
  '/admin/publish',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const source = String(req.body?.source ?? '')
    const key = String(req.body?.key ?? '')
    const validKey = source === 'daily' ? DATE_RE.test(key) : source === 'monthly' && MONTH_RE.test(key)
    if (!validKey) return res.status(400).json({ error: 'Invalid set reference.' })

    // Confirm the set actually has questions before exposing a card for it.
    const table = source === 'daily' ? 'ca_daily_questions' : 'questions'
    let q = supabaseAdmin.from(table).select('external_id', { count: 'exact', head: true })
    q = source === 'daily'
      ? q.eq('date', key)
      : q.eq('category', 'current_affairs').eq('ca_type', 'month_wise').eq('ca_month', key)
    const { count, error: cErr } = await q
    if (cErr) return sendDbError(res, cErr)
    if (!count) return res.status(404).json({ error: 'That set has no questions.' })

    const { title, title_ta } = setTitles(source, key)
    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert({
        kind: 'questions',
        placement: 'materials',
        title,
        title_ta,
        description: `${count} questions with answers and explanations`,
        questions_source: source,
        questions_key: key,
        active: true,
        downloadable: true,
        created_by: req.userId,
      })
      .select(MATERIAL_COLS)
      .single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This set is already published.' })
      return sendDbError(res, error)
    }
    res.status(201).json({ material: data })
  })
)

// ─── GET /api/ca-questions/:materialId/items ─────────────────────────────────
// Student read for a PUBLISHED set — the source rows the client turns into a
// PDF. Requires the materials row to be BOTH active AND downloadable, so the
// superadmin's toggle is the only thing that exposes answers/explanations.
// Declared after /admin/* so those literal paths win the match.
router.get(
  '/:materialId/items',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const id = req.params.materialId
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Question set not found.' })

    const { data: mat, error } = await supabaseAdmin
      .from('materials')
      .select('kind, active, downloadable, questions_source, questions_key')
      .eq('id', id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (
      !mat ||
      mat.kind !== 'questions' ||
      !mat.active ||
      !mat.downloadable ||
      !mat.questions_source ||
      !mat.questions_key
    ) {
      return res.status(404).json({ error: 'Question set not found.' })
    }

    const source = mat.questions_source as string
    const key = mat.questions_key as string
    if (source === 'daily') {
      const { data, error: e } = await supabaseAdmin
        .from('ca_daily_questions')
        .select(QUESTION_COLS)
        .eq('date', key)
        .order('external_id', { ascending: true })
        .limit(1000)
      if (e) return sendDbError(res, e)
      res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
      return res.json({ items: data ?? [] })
    }
    const { data, error: e } = await supabaseAdmin
      .from('questions')
      .select(QUESTION_COLS)
      .eq('category', 'current_affairs')
      .eq('ca_type', 'month_wise')
      .eq('ca_month', key)
      .order('external_id', { ascending: true })
      .limit(1000)
    if (e) return sendDbError(res, e)
    res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    res.json({ items: data ?? [] })
  })
)

export default router
