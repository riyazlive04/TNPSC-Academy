import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { bundleAccess } from '../lib/premium.js'
import { chargeTestStart, FIRST_TEST_BONUS, grantFirstTestBonus } from '../lib/credits.js'
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

/** Fisher-Yates shuffle (non-mutating). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

// ─── Student daily-CA TEST surface ───────────────────────────────────────────
// The same superadmin-published daily sets the PDF cards expose, playable as a
// short timed test. `ca_daily_questions` is deliberately outside
// `public.questions` (see APP_INTEGRATION.md §D), so these rows can never be
// drawn by get_quiz_questions / the mock samplers — which also means the generic
// /quiz + submit_test pipeline can't serve or grade them. Hence this dedicated
// pair: a safe-columns draw (answers stripped, credits charged at start, exactly
// like /api/questions/quiz) and a server-side grader that writes the same
// test_sessions row every other test writes, so a daily drill counts towards
// history, streaks and the daily goal.

/** Columns safe to hand a student mid-test (no answer/explanation). */
const DAILY_QUIZ_COLS =
  'id, topic, question_type, difficulty, ca_month, ca_year, ' +
  'question_text, option_a, option_b, option_c, option_d, ' +
  'question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta'

/** Attendance gate shared with submit_test: explanations unlock at 25% attempted. */
const ATTENDANCE_GATE = 0.25

/** Upper bound on one submission's answers[] — a daily set is ~15 questions. */
const MAX_DAILY_ANSWERS = 200

/** The answer-side columns the grader reads for one daily question. */
interface GradableDaily {
  id: number | string
  ca_month: string | null
  correct_answer: string | null
  explanation: string | null
  explanation_ta: string | null
  why_wrong: Record<string, string> | null
}
/** One submitted answer resolved against its question. */
interface GradedDaily {
  q: GradableDaily
  selected: string | null
  correct: boolean
}

/** premium OR vettri OR rankBooster OR staff → the test is free of credit charge. */
async function isUnlimited(req: AuthedRequest): Promise<boolean> {
  const role = await roleOf(req.userId!)
  if (role === 'admin' || role === 'superadmin') return true
  try {
    return (await bundleAccess(req.db!)).creditsUnlimited
  } catch {
    return false // fail closed: treat as a free learner (the gate applies)
  }
}

/**
 * The date behind a PUBLISHED daily question set, or null when the material is
 * not a live daily card. `downloadable` gates the PDF (answers + explanations)
 * only — a test needs nothing beyond the set being published and active.
 */
async function publishedDailyDate(materialId: string): Promise<string | null> {
  if (!UUID_RE.test(materialId)) return null
  const { data } = await supabaseAdmin
    .from('materials')
    .select('kind, active, questions_source, questions_key')
    .eq('id', materialId)
    .maybeSingle()
  if (!data || data.kind !== 'questions' || !data.active) return null
  if (data.questions_source !== 'daily') return null
  const key = String(data.questions_key ?? '')
  return DATE_RE.test(key) ? key : null
}

// ─── GET /api/ca-questions/daily/published?limit=14 ──────────────────────────
// The recent PUBLISHED daily sets for the dashboard strip — newest first, each
// with its question count. Publication-driven: only sets the superadmin has
// approved (active) appear, so nothing is exposed before it has been reviewed.
// Declared before /:materialId/* so the literal path wins the match.
router.get(
  '/daily/published',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 7, 1), 30)
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('id, downloadable, questions_key')
      .eq('kind', 'questions')
      .eq('active', true)
      .eq('questions_source', 'daily')
      .not('questions_key', 'is', null)
      .order('questions_key', { ascending: false })
      .limit(limit)
    if (error) return sendDbError(res, error)

    const rows = (data ?? []).filter((r) => DATE_RE.test(String(r.questions_key)))
    const dates = rows.map((r) => String(r.questions_key))
    // One grouped count for the whole strip rather than a HEAD count per card.
    const counts = new Map<string, number>()
    if (dates.length) {
      const { data: qs, error: qErr } = await supabaseAdmin
        .from('ca_daily_questions')
        .select('date')
        .in('date', dates)
        .eq('active', true)
        .limit(5000)
      if (qErr) return sendDbError(res, qErr)
      for (const q of qs ?? []) {
        const d = String(q.date)
        counts.set(d, (counts.get(d) ?? 0) + 1)
      }
    }

    res.set('Cache-Control', 'private, max-age=300')
    res.json({
      sets: rows
        .map((r) => ({
          id: r.id as string,
          date: String(r.questions_key),
          downloadable: r.downloadable as boolean,
          total: counts.get(String(r.questions_key)) ?? 0,
        }))
        .filter((s) => s.total > 0),
    })
  })
)

// ─── POST /api/ca-questions/daily/:materialId/quiz ───────────────────────────
// That day's paper, answers stripped. An optional `count` trims the (shuffled)
// set for aspirants who lower the slider. Charged 1 credit/question at START,
// atomically, exactly like every other test; premium/Vettri/staff bypass.
router.post(
  '/daily/:materialId/quiz',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const date = await publishedDailyDate(req.params.materialId)
    if (!date) return res.status(404).json({ error: 'Question set not found.' })

    const { data, error } = await supabaseAdmin
      .from('ca_daily_questions')
      .select(DAILY_QUIZ_COLS)
      .eq('date', date)
      .eq('active', true)
      .order('external_id', { ascending: true })
      .limit(1000)
    if (error) return sendDbError(res, error)

    const all = ((data ?? []) as unknown as Record<string, unknown>[]).map((q) => ({
      ...q,
      // The client keys everything on a string id; these rows are bigint-keyed.
      id: String(q.id),
      category: 'current_affairs',
      ca_type: 'day_wise',
    }))
    const requested = Math.trunc(Number((req.body ?? {}).count)) || all.length
    const n = Math.min(Math.max(requested, 1), all.length)
    // Trim from a shuffled copy so a shortened run isn't always the same first N.
    const questions = n === all.length ? all : shuffle(all).slice(0, n)

    if (questions.length > 0 && !(await isUnlimited(req))) {
      const gate = await chargeTestStart(req.db!, req.userId!, 'ca_daily', questions.length)
      if (gate) return res.status(402).json(gate)
    }
    res.json({ questions })
  })
)

// ─── POST /api/ca-questions/daily/:materialId/submit ─────────────────────────
// Server-side grader for a daily set — the browser never holds the answers. It
// mirrors submit_test: a completed test_sessions row (so the drill shows in
// history and analytics) plus the IST-day activity bump that drives streaks and
// the daily goal. It writes NO test_answers / review_items rows: both key on
// public.questions(id), which these rows deliberately are not.
router.post(
  '/daily/:materialId/submit',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const date = await publishedDailyDate(req.params.materialId)
    if (!date) return res.status(404).json({ error: 'Question set not found.' })

    const body = req.body ?? {}
    const answers = Array.isArray(body.answers) ? body.answers : null
    if (!answers) return res.status(400).json({ error: 'answers[] is required' })
    if (answers.length > MAX_DAILY_ANSWERS) {
      return res.status(400).json({ error: `Too many answers (max ${MAX_DAILY_ANSWERS}).` })
    }

    const { data, error } = await supabaseAdmin
      .from('ca_daily_questions')
      .select('id, ca_month, correct_answer, explanation, explanation_ta, why_wrong')
      .eq('date', date)
      .eq('active', true)
      .limit(1000)
    if (error) return sendDbError(res, error)
    const rows = (data ?? []) as GradableDaily[]
    const byId = new Map(rows.map((q) => [String(q.id), q]))

    // Only answers naming a question from THIS day count — same as submit_test's
    // inner join, so a padded payload can't inflate the score.
    const graded = (answers as { question_id?: unknown; selected_answer?: unknown }[])
      .map((a) => {
        const q = byId.get(String(a.question_id ?? ''))
        if (!q) return null
        const selected = normAnswer(a.selected_answer)
        return { q, selected, correct: !!selected && selected === q.correct_answer }
      })
      .filter((g): g is GradedDaily => !!g)

    const total = graded.length
    const attempted = graded.filter((g) => g.selected).length
    const correct = graded.filter((g) => g.correct).length
    const score = total > 0 ? Math.round((100 * correct) / total) : 0
    const unlocked = total > 0 && attempted / total >= ATTENDANCE_GATE

    const { data: session, error: sErr } = await supabaseAdmin
      .from('test_sessions')
      .insert({
        user_id: req.userId!,
        category: 'current_affairs',
        ca_type: 'day_wise',
        ca_month: graded[0]?.q.ca_month ?? null,
        total_questions: total,
        attempted,
        correct,
        score_percentage: score,
        pdf_unlocked: unlocked,
        passed_80_percent: unlocked,
        time_limit_seconds: Math.max(0, Math.trunc(Number(body.time_limit_seconds)) || 0),
        time_taken_seconds: Math.max(0, Math.trunc(Number(body.time_taken_seconds)) || 0),
        completed_at: new Date().toISOString(),
        status: 'completed',
      })
      .select('id')
      .single()
    if (sErr) return sendDbError(res, sErr)

    // Habit layer: the same IST-day bump submit_test makes. Best-effort — a
    // failure here must never cost the learner their graded result.
    const { error: aErr } = await req
      .db!.rpc('increment_activity', { p_questions: attempted, p_tests: 1 })
    if (aErr) console.error('[ca-daily] activity bump failed', aErr.code, aErr.message)

    // First-test bonus. The RPC only fires when EXACTLY one completed session
    // exists, so it has to run here too: if a daily drill is someone's first
    // test, skipping this would push their session count past one and lose them
    // the bonus for good. Best-effort, exactly as in POST /api/tests/submit.
    const bonus = await grantFirstTestBonus(req.db!).catch((e) => {
      console.error('[ca-daily] first-test-bonus grant failed', e)
      return null
    })

    res.json({
      ...(bonus?.granted
        ? { first_test_bonus: { amount: FIRST_TEST_BONUS, balance: bonus.balance } }
        : {}),
      session_id: session?.id ?? null,
      total,
      attempted,
      correct,
      score_percentage: score,
      passed_80: unlocked,
      unlocked,
      results: graded.map((g) => ({
        question_id: String(g.q.id),
        selected_answer: g.selected,
        is_correct: g.correct,
        correct_answer: unlocked ? g.q.correct_answer : null,
        explanation: unlocked ? g.q.explanation : null,
        explanation_ta: unlocked ? g.q.explanation_ta : null,
        explanation_video_url: null,
        why_wrong: unlocked ? g.q.why_wrong : null,
      })),
    })
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
