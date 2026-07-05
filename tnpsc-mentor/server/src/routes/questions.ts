import { Router } from 'express'
import { asyncH, sendDbError, isMissingFunction } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { recordSeen } from '../lib/seen.js'
import { premiumEntitlement, bundleAccess } from '../lib/premium.js'
import { chargeTestStart, FREE_MOCK_LIMIT } from '../lib/credits.js'
import { MAX_MOCK_EXAM_ATTEMPTS, MAX_TEST_SERIES_ATTEMPTS } from '../pricing.js'

const router = Router()

// Columns safe to return to the client during a quiz (answer/explanation columns
// are stripped at the column-grant level; listed explicitly for the fallbacks).
const QUIZ_COLS = [
  'id', 'category', 'group_type', 'year', 'standard',
  'ca_month', 'ca_year', 'ca_type', 'ca_topic',
  'aptitude_type', 'aptitude_topic', 'subject', 'topic',
  'question_type', 'external_id', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta', 'option_e_ta',
].join(', ')

// Fisher-Yates shuffle (mutates a copy).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Per-group subject-slot definitions for the group exam mock (2024/2025 pattern).
// Each slot pulls from one or more {category, subjects?} pairs, pools the results,
// shuffles, and takes the first `count` questions.
interface MockQueryDef { category: string; subjects?: string[] }
interface MockSlotDef { label: string; count: number; queries: MockQueryDef[] }

const GROUP_SLOTS: Record<string, MockSlotDef[]> = {
  Group4_VAO: [
    { label: 'General Tamil', count: 20,
      queries: [{ category: 'subject', subjects: ['தமிழ்'] }] },
    { label: 'History & INM', count: 15,
      queries: [
        { category: 'subject', subjects: ['History', 'Indian National Movement'] },
        { category: 'pyq', subjects: ['History and INM'] },
      ] },
    { label: 'Geography', count: 10,
      queries: [
        { category: 'subject', subjects: ['Geography'] },
        { category: 'pyq', subjects: ['Geography'] },
      ] },
    { label: 'Polity', count: 10,
      queries: [
        { category: 'subject', subjects: ['Polity'] },
        { category: 'pyq', subjects: ['Polity'] },
      ] },
    { label: 'General Science', count: 20,
      queries: [
        { category: 'subject', subjects: ['Physics', 'Chemistry', 'Biology'] },
        { category: 'pyq', subjects: ['Physics', 'Chemistry', 'Biology'] },
      ] },
    { label: 'Economy', count: 10,
      queries: [
        { category: 'subject', subjects: ['Economy'] },
        { category: 'pyq', subjects: ['Indian Economy'] },
      ] },
    { label: 'Current Affairs', count: 10,
      queries: [{ category: 'current_affairs' }] },
    { label: 'Aptitude', count: 5,
      queries: [{ category: 'aptitude' }] },
  ],
  Group2_2A: [
    { label: 'History & INM', count: 10,
      queries: [
        { category: 'subject', subjects: ['History', 'Indian National Movement'] },
        { category: 'pyq', subjects: ['History and INM'] },
      ] },
    { label: 'Polity', count: 8,
      queries: [
        { category: 'subject', subjects: ['Polity'] },
        { category: 'pyq', subjects: ['Polity'] },
      ] },
    { label: 'Geography', count: 8,
      queries: [
        { category: 'subject', subjects: ['Geography'] },
        { category: 'pyq', subjects: ['Geography'] },
      ] },
    { label: 'General Science', count: 10,
      queries: [
        { category: 'subject', subjects: ['Physics', 'Chemistry', 'Biology'] },
        { category: 'pyq', subjects: ['Physics', 'Chemistry', 'Biology'] },
      ] },
    { label: 'Economy', count: 4,
      queries: [
        { category: 'subject', subjects: ['Economy'] },
        { category: 'pyq', subjects: ['Indian Economy'] },
      ] },
    { label: 'TN History & Culture', count: 10,
      queries: [
        { category: 'subject', subjects: ['History, Culture, Heritage'] },
        { category: 'pyq', subjects: ['History Culture Heritage of TN'] },
      ] },
    { label: 'TN Administration', count: 5,
      queries: [
        { category: 'subject', subjects: ['Development Administration in Tamil Nadu'] },
        { category: 'pyq', subjects: ['Development Administration of TamilNadu'] },
      ] },
    { label: 'General Tamil', count: 15,
      queries: [{ category: 'subject', subjects: ['தமிழ்'] }] },
    { label: 'Current Affairs', count: 15,
      queries: [{ category: 'current_affairs' }] },
    { label: 'Aptitude', count: 15,
      queries: [{ category: 'aptitude' }] },
  ],
  Group1: [
    { label: 'History & INM', count: 15,
      queries: [
        { category: 'subject', subjects: ['History', 'Indian National Movement'] },
        { category: 'pyq', subjects: ['History and INM'] },
      ] },
    { label: 'Polity', count: 12,
      queries: [
        { category: 'subject', subjects: ['Polity'] },
        { category: 'pyq', subjects: ['Polity'] },
      ] },
    { label: 'Geography', count: 12,
      queries: [
        { category: 'subject', subjects: ['Geography'] },
        { category: 'pyq', subjects: ['Geography'] },
      ] },
    { label: 'General Science', count: 15,
      queries: [
        { category: 'subject', subjects: ['Physics', 'Chemistry', 'Biology'] },
        { category: 'pyq', subjects: ['Physics', 'Chemistry', 'Biology'] },
      ] },
    { label: 'Economy', count: 10,
      queries: [
        { category: 'subject', subjects: ['Economy'] },
        { category: 'pyq', subjects: ['Indian Economy'] },
      ] },
    { label: 'TN History & Culture', count: 10,
      queries: [
        { category: 'subject', subjects: ['History, Culture, Heritage'] },
        { category: 'pyq', subjects: ['History Culture Heritage of TN'] },
      ] },
    { label: 'TN Administration', count: 6,
      queries: [
        { category: 'subject', subjects: ['Development Administration in Tamil Nadu'] },
        { category: 'pyq', subjects: ['Development Administration of TamilNadu'] },
      ] },
    { label: 'Current Affairs', count: 10,
      queries: [{ category: 'current_affairs' }] },
    { label: 'Aptitude', count: 10,
      queries: [{ category: 'aptitude' }] },
  ],
}

// ─── Unlimited-access check ──────────────────────────────────────────────────
// premium OR vettri OR staff → unlimited tests: they never spend credits and skip
// the free-mock cap. Everyone else is a credit-gated free learner.

/** premium OR vettri OR staff → unlimited. Fails closed (treat as free on error). */
async function isUnlimited(req: AuthedRequest): Promise<boolean> {
  if (await isStaff(req)) return true
  try {
    return (await bundleAccess(req.db!)).unlimited
  } catch {
    return false // fail closed on entitlement: treat as free (gate may apply)
  }
}

// ─── GET /api/questions/topic-access ─────────────────────────────────────────
// Powers the PYQ + Current Affairs lock UI: the caller's unlimited state plus the
// topic keys whose one free test is already used. Unlimited (premium/vettri/staff)
// callers have no locks, so the list is empty for them. The client derives each
// row's key with the mirrored src/lib/freeGate.ts and checks membership.
router.get(
  '/topic-access',
  requireAuth,
  asyncH(async (_req: AuthedRequest, res) => {
    // Credits replaced per-topic locks — always report "no locks". Gating is now a
    // global credit balance (routes/credits.ts) enforced at test start (402).
    res.json({ unlimited: true, usedKeys: [] })
  })
)

// ─── GET /api/questions/subject-access ───────────────────────────────────────
// Powers the Subject Practice lock UI: the caller's premium state plus the
// subjects whose one free test is already used (locked for free users). Premium
// and staff have no locks, so the list is empty for them.
router.get(
  '/subject-access',
  requireAuth,
  asyncH(async (_req: AuthedRequest, res) => {
    // Credits replaced per-subject locks — always report "no locks".
    res.json({ premium: true, usedSubjects: [] })
  })
)

// ─── POST /api/questions/quiz ────────────────────────────────────────────────
// Safe quiz questions for a config (no answers — get_quiz_questions strips them
// server-side and returns a random sample).
router.post(
  '/quiz',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const config = req.body?.config ?? {}
    const unlimited = await isUnlimited(req)
    const { data, error } = await req.db!.rpc('get_quiz_questions', { p_config: config })
    if (error) return sendDbError(res, error)
    const questions = (data ?? []) as { id?: string }[]
    // Credit gate: a free learner is CHARGED 10 credits at START (atomic), the
    // moment a real test is delivered — never at submit, where a forged payload
    // could dodge the fee. Charging on start also makes each start a reservation,
    // so opening several tests at once can't be graded off one balance. Only a
    // non-empty draw is charged. Premium/Vettri/staff are unlimited and bypass.
    if (!unlimited && questions.length > 0) {
      const gate = await chargeTestStart(req.db!, req.userId!, (config.category as string) ?? 'quiz')
      if (gate) return res.status(402).json(gate)
    }
    // Mark these as seen so they sink to the back of future draws.
    void recordSeen(req, questions)
    res.json({ questions })
  })
)

// ─── POST /api/questions/count ───────────────────────────────────────────────
// How many questions are available for a config — bounds the question-count
// slider on the pre-test setup screen. Mirrors get_quiz_questions' filters.
router.post(
  '/count',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const config = req.body?.config ?? {}
    const { data, error } = await req.db!.rpc('count_quiz_questions', { p_config: config })
    if (!error) return res.json({ count: Number(data ?? 0) })
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): a HEAD count with the same core filters.
    let q = req.db!
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
    if (config.category) q = q.eq('category', config.category)
    if (config.subject) q = q.eq('subject', config.subject)
    if (config.standard != null) q = q.eq('standard', config.standard)
    if (config.topic) q = q.eq('topic', config.topic)
    if (config.unit) q = q.eq('unit', config.unit)
    if (config.question_type) q = q.eq('question_type', config.question_type)
    if (config.ca_type) q = q.eq('ca_type', config.ca_type)
    if (config.ca_month) q = q.eq('ca_month', config.ca_month)
    if (config.ca_topic) q = q.eq('ca_topic', config.ca_topic)
    if (config.aptitude_type) q = q.eq('aptitude_type', config.aptitude_type)
    if (config.aptitude_topic) q = q.eq('aptitude_topic', config.aptitude_topic)
    if (config.year != null) q = q.eq('year', config.year)
    const { count, error: e2 } = await q
    if (e2) return sendDbError(res, e2)
    res.json({ count: count ?? 0 })
  })
)

// ─── POST /api/questions/topics ──────────────────────────────────────────────
// Distinct topic list for a picker (Samacheer `topic`, Current-Affairs `ca_topic`).
router.post(
  '/topics',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { category, subject, standard, aptitude_type } = req.body ?? {}
    const known = ['aptitude', 'samacheer', 'pyq', 'subject', 'current_affairs']
    if (!known.includes(category)) return res.json({ topics: [] })

    // DISTINCT is computed server-side (distinct_question_topics RPC) so banks
    // larger than 1000 rows don't get truncated by PostgREST's row cap. The RPC
    // encapsulates the per-category column logic (aptitude_topic / topic /
    // topic-or-ca_topic) and active-row rules.
    const { data, error } = await req.db!.rpc('distinct_question_topics', {
      p_config: {
        category,
        subject: subject ?? null,
        standard: standard ?? null,
        aptitude_type: aptitude_type ?? null,
      },
    })
    if (!error) {
      const topics = ((data ?? []) as { topic: string }[]).map((r) => r.topic)
      return res.json({ topics })
    }
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): distinct in JS, per-category column logic.
    const col = category === 'aptitude' ? 'aptitude_topic'
      : category === 'current_affairs' ? 'topic, ca_topic'
      : 'topic'
    let q = req.db!.from('questions').select(col).eq('category', category)
    // samacheer + current_affairs historically include inactive rows.
    if (category !== 'samacheer' && category !== 'current_affairs') {
      q = q.eq('active', true)
    }
    if (subject) q = q.eq('subject', subject)
    if (category === 'samacheer' && standard != null) q = q.eq('standard', standard)
    if (category === 'aptitude' && aptitude_type) q = q.eq('aptitude_type', aptitude_type)
    const { data: rows, error: e2 } = await q
    if (e2) return sendDbError(res, e2)
    const set = new Set<string>()
    for (const r of (rows ?? []) as unknown as Record<string, string | null>[]) {
      const v = category === 'aptitude' ? r.aptitude_topic
        : category === 'current_affairs' ? (r.topic ?? r.ca_topic)
        : r.topic
      if (v) set.add(v)
    }
    res.json({ topics: [...set].sort() })
  })
)

// ─── POST /api/questions/topic-counts ────────────────────────────────────────
// Per-topic question counts for a category's topic picker — the count shown on
// every topic row (Subject Practice, Aptitude, Current Affairs, …). Grouped
// server-side so banks larger than 1000 rows stay accurate. The per-category
// topic column (aptitude_topic / topic-or-ca_topic / topic) is handled by the
// question_topic_counts RPC, mirroring the /topics endpoint.
router.post(
  '/topic-counts',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { category = 'subject', subject, standard, aptitude_type, ca_month, year } = req.body ?? {}
    const known = ['aptitude', 'samacheer', 'pyq', 'pyq2', 'subject', 'current_affairs']
    if (!known.includes(category)) return res.json({ counts: {} })

    // Current Affairs scoped to a single month: the RPC has no ca_month param,
    // but a month is a small bank (~120 rows), so group it directly. Topics live
    // in `topic` for month_wise rows (ca_topic null), mirroring the fallback below.
    if (category === 'current_affairs' && ca_month) {
      const { data: rows, error } = await req.db!
        .from('questions')
        .select('topic, ca_topic')
        .eq('category', 'current_affairs')
        .eq('ca_month', ca_month)
      if (error) return sendDbError(res, error)
      const counts: Record<string, number> = {}
      for (const r of (rows ?? []) as { topic: string | null; ca_topic: string | null }[]) {
        const v = r.topic ?? r.ca_topic
        if (v) counts[v] = (counts[v] ?? 0) + 1
      }
      return res.json({ counts })
    }

    const { data, error } = await req.db!.rpc('question_topic_counts', {
      p_config: {
        category,
        subject: subject ?? null,
        standard: standard ?? null,
        aptitude_type: aptitude_type ?? null,
        year: year ?? null,
      },
    })
    if (!error) {
      const counts: Record<string, number> = {}
      for (const r of (data ?? []) as { value: string; total: number }[]) {
        counts[r.value] = Number(r.total)
      }
      return res.json({ counts })
    }
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): count in JS with per-category column logic.
    const col = category === 'aptitude' ? 'aptitude_topic'
      : category === 'current_affairs' ? 'topic, ca_topic'
      : 'topic'
    let q = req.db!.from('questions').select(col).eq('category', category)
    if (category !== 'samacheer' && category !== 'current_affairs') {
      q = q.eq('active', true)
    }
    if (subject) q = q.eq('subject', subject)
    if (category === 'samacheer' && standard != null) q = q.eq('standard', standard)
    if (category === 'aptitude' && aptitude_type) q = q.eq('aptitude_type', aptitude_type)
    if (year != null) q = q.eq('year', year)
    const { data: rows, error: e2 } = await q
    if (e2) return sendDbError(res, e2)
    const counts: Record<string, number> = {}
    for (const r of (rows ?? []) as unknown as Record<string, string | null>[]) {
      const v = category === 'aptitude' ? r.aptitude_topic
        : category === 'current_affairs' ? (r.topic ?? r.ca_topic)
        : r.topic
      if (v) counts[v] = (counts[v] ?? 0) + 1
    }
    res.json({ counts })
  })
)

// ─── POST /api/questions/history-periods ─────────────────────────────────────
// Counts the PYQ History bank (category='pyq', subject='History and INM') by
// historical period — the `unit` column holds 'ancient' | 'medieval' | 'modern'.
// Powers the three-criteria History selector (counts + disable empty periods).
router.post(
  '/history-periods',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Grouped server-side so counts are correct on banks larger than 1000 rows.
    const { data, error } = await req.db!.rpc('pyq_history_period_counts')
    if (!error) {
      const counts: Record<string, number> = {}
      for (const r of (data ?? []) as { value: string; total: number }[]) {
        counts[r.value] = Number(r.total)
      }
      return res.json({ counts })
    }
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): count in JS.
    const { data: rows, error: e2 } = await req.db!
      .from('questions')
      .select('unit')
      .eq('category', 'pyq')
      .eq('subject', 'History and INM')
      .eq('active', true)
      .not('unit', 'is', null)
    if (e2) return sendDbError(res, e2)
    const counts: Record<string, number> = {}
    for (const r of (rows ?? []) as { unit: string | null }[]) {
      if (r.unit) counts[r.unit] = (counts[r.unit] ?? 0) + 1
    }
    res.json({ counts })
  })
)

// ─── POST /api/questions/subjects ────────────────────────────────────────────
// Subject Practice: the list of academic subjects (category='subject') with a
// total active-question count each. Powers the Subject step of the picker.
//
// Counts are grouped server-side via the subject_practice_subjects() RPC — a
// plain table select would hit PostgREST's 1000-row cap and only ever surface
// the first one or two subjects in the bank.
//
// Subjects in HIDDEN_SUBJECTS are kept in the DB but not offered in the picker.
const HIDDEN_SUBJECTS = new Set(['English', 'Tamil'])
router.post(
  '/subjects',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('subject_practice_subjects')
    if (error) return sendDbError(res, error)
    const subjects = ((data ?? []) as { subject: string; total: number }[])
      .filter((r) => r.subject && !HIDDEN_SUBJECTS.has(r.subject))
      .map((r) => ({ subject: r.subject, total: Number(r.total) }))
      .sort((a, b) => a.subject.localeCompare(b.subject))
    res.json({ subjects })
  })
)

// ─── POST /api/questions/qtypes ──────────────────────────────────────────────
// Subject Practice: per-question-type counts for a subject (optionally narrowed
// to one topic). Lets the Type step show counts and disable empty types.
router.post(
  '/qtypes',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { subject, topic } = req.body ?? {}
    // Grouped server-side so counts are correct on banks larger than 1000 rows.
    const { data, error } = await req.db!.rpc('subject_qtype_counts', {
      p_subject: subject ?? null,
      p_topic: topic ?? null,
    })
    if (!error) {
      const counts: Record<string, number> = {}
      for (const r of (data ?? []) as { value: string; total: number }[]) {
        counts[r.value] = Number(r.total)
      }
      return res.json({ counts })
    }
    if (!isMissingFunction(error)) return sendDbError(res, error)

    // Fallback (RPC not migrated yet): count in JS.
    let q = req.db!
      .from('questions')
      .select('question_type')
      .eq('category', 'subject')
      .eq('active', true)
      .not('question_type', 'is', null)
    if (subject) q = q.eq('subject', subject)
    if (topic) q = q.eq('topic', topic)
    const { data: rows, error: e2 } = await q
    if (e2) return sendDbError(res, e2)
    const counts: Record<string, number> = {}
    for (const r of (rows ?? []) as { question_type: string | null }[]) {
      if (r.question_type) counts[r.question_type] = (counts[r.question_type] ?? 0) + 1
    }
    res.json({ counts })
  })
)

// ─── POST /api/questions/mock-group ─────────────────────────────────────────
// Group-exam mock questions following the 2024/2025 TNPSC pattern. Fetches
// questions slot-by-slot (one slot per subject), pools each slot, shuffles, and
// returns a flat merged array. Answer columns never appear (column-level grants).
router.post(
  '/mock-group',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { group_type } = req.body ?? {}
    const slots = GROUP_SLOTS[group_type as string]
    if (!slots) return res.status(400).json({ error: `Unknown group_type: ${group_type}` })

    // Resolved once; the credit is charged at the end, only if a real test is built.
    const unlimited = await isUnlimited(req)

    const result: Record<string, unknown>[] = []
    // Dedup ACROSS slots too (a question tagged for two slots must appear once).
    const globalSeen = new Set<string>()

    for (const slot of slots) {
      // Sampling (dedup + ORDER BY random + limit) happens in the RPC, so it's
      // not capped by PostgREST's 1000-row limit — the previous plain select
      // only ever shuffled the first 1000 rows of each (much larger) bank.
      let rows: Record<string, unknown>[]
      const { data, error } = await req.db!.rpc('mock_slot_questions', {
        p_queries: slot.queries.map((qd) => ({
          category: qd.category,
          subjects: qd.subjects ?? null,
        })),
        p_count: slot.count,
      })
      if (!error) {
        rows = (data ?? []) as unknown as Record<string, unknown>[]
      } else if (isMissingFunction(error)) {
        // Fallback (RPC not migrated yet): pool each query, shuffle, take count.
        const pool: Record<string, unknown>[] = []
        const seen = new Set<string>()
        for (const qdef of slot.queries) {
          let q = req.db!
            .from('questions')
            .select(QUIZ_COLS)
            .eq('category', qdef.category)
            .eq('active', true)
          if (qdef.subjects?.length) q = q.in('subject', qdef.subjects)
          const { data: qd, error: e2 } = await q
          if (e2) return sendDbError(res, e2)
          for (const row of (qd ?? []) as unknown as Record<string, unknown>[]) {
            const id = row.id as string
            if (!seen.has(id)) { seen.add(id); pool.push(row) }
          }
        }
        rows = shuffle(pool).slice(0, slot.count)
      } else {
        return sendDbError(res, error)
      }

      let picked = 0
      for (const row of rows) {
        const id = row.id as string
        if (globalSeen.has(id)) continue
        globalSeen.add(id)
        result.push(row)
        picked++
      }
      if (picked < slot.count) {
        // Surface thin pools instead of silently delivering a short test.
        console.warn(
          `[mock-group] ${group_type} slot "${slot.label}" filled ${picked}/${slot.count}`
        )
      }
    }

    // Charge at start (atomic) now that a real test is assembled. Premium/Vettri/
    // staff bypass. See chargeTestStart — charging here (not at submit) closes the
    // forged-payload and multi-start bypasses.
    if (!unlimited && result.length > 0) {
      const gate = await chargeTestStart(req.db!, req.userId!, 'mock-group')
      if (gate) return res.status(402).json(gate)
    }

    void recordSeen(req, result as { id?: string }[])
    res.json({ questions: shuffle(result) })
  })
)

// ─── POST /api/questions/subject-mock ───────────────────────────────────────
// Subject/topic mock with optional difficulty filter. Returns up to `count`
// random questions from the subject bank for the selected subject/topic/difficulty.
router.post(
  '/subject-mock',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { subject, topic, difficulty, count = 50 } = req.body ?? {}
    const unlimited = await isUnlimited(req)
    // Clamp the requested count to a sane range (the RPC also clamps to [1,200],
    // but guard here so a NaN/negative never reaches it).
    const n = Math.min(Math.max(Math.trunc(Number(count)) || 50, 1), 200)

    // Random sampling done server-side (ORDER BY random + limit) so it's not
    // limited to the first 1000 rows of the subject bank.
    let questions: { id?: string }[]
    const { data, error } = await req.db!.rpc('subject_mock_questions', {
      p_subject: subject ?? null,
      p_topic: topic ?? null,
      p_difficulty: difficulty ?? null,
      p_count: n,
    })
    if (!error) {
      questions = (data ?? []) as { id?: string }[]
    } else if (!isMissingFunction(error)) {
      return sendDbError(res, error)
    } else {
      // Fallback (RPC not migrated yet): fetch then shuffle/slice in JS.
      let q = req.db!
        .from('questions')
        .select(QUIZ_COLS)
        .eq('category', 'subject')
        .eq('active', true)
      if (subject) q = q.eq('subject', subject)
      if (topic) q = q.eq('topic', topic)
      if (difficulty) q = q.eq('difficulty', difficulty)
      const { data: rows, error: e2 } = await q
      if (e2) return sendDbError(res, e2)
      questions = shuffle((rows ?? []) as unknown as Record<string, unknown>[]).slice(0, n) as { id?: string }[]
    }

    // Charge at start (atomic), only when a real test is delivered. Bypass for
    // premium/Vettri/staff. See chargeTestStart.
    if (!unlimited && questions.length > 0) {
      const gate = await chargeTestStart(req.db!, req.userId!, 'subject-mock')
      if (gate) return res.status(402).json(gate)
    }
    void recordSeen(req, questions)
    res.json({ questions })
  })
)

// ─── Full mock exams (fixed, named 200-Q papers) ─────────────────────────────
// Distinct from /mock-group (randomly sampled): each exam is a fixed bank of
// rows tagged category='mock' + mock_set. Access is gated by tier (free/paid),
// the admin `enabled` flag, and a per-user attempt cap (MAX_MOCK_EXAM_ATTEMPTS).

interface MockExamRow {
  id: string
  mock_set: number
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  tier: 'free' | 'paid'
  enabled: boolean
  sort_order: number
}

/** Admins/superadmins bypass the premium + attempt gates so they can preview any exam. */
async function isStaff(req: AuthedRequest): Promise<boolean> {
  const role = await roleOf(req.userId!)
  return role === 'admin' || role === 'superadmin'
}

/** Count this user's recorded attempts per exam (RLS scopes rows to the user). */
async function attemptCounts(req: AuthedRequest): Promise<Record<string, number>> {
  const { data, error } = await req.db!.from('mock_exam_attempts').select('exam_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as { exam_id: string }[]) {
    counts[r.exam_id] = (counts[r.exam_id] ?? 0) + 1
  }
  return counts
}

// ─── GET /api/questions/mock-exams ───────────────────────────────────────────
// The exams visible to this user (enabled only), annotated with lock state and
// attempts used. Premium is derived from the payment ledger (never trusted from
// the client); paid exams show locked=true for non-premium users.
router.get(
  '/mock-exams',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('mock_exams')
      .select(
        'id, mock_set, title, title_ta, total_questions, duration_seconds, negative_mark, tier, enabled, sort_order'
      )
      .eq('enabled', true)
      .order('sort_order')
    if (error) return sendDbError(res, error)

    // Staff (admin/superadmin) preview every exam as unlocked and uncapped.
    const staff = await isStaff(req)
    let premium = staff
    if (!premium) {
      try {
        premium = (await premiumEntitlement(req.db!)).premium
      } catch {
        premium = false // fail closed: treat as free if the ledger is unreachable
      }
    }
    const counts = await attemptCounts(req)

    const exams = ((data ?? []) as MockExamRow[]).map((e) => {
      const locked = e.tier === 'paid' && !premium
      return {
        id: e.id,
        title: e.title,
        title_ta: e.title_ta,
        total_questions: e.total_questions,
        duration_seconds: e.duration_seconds,
        negative_mark: Number(e.negative_mark),
        tier: e.tier,
        locked,
        lockReason: locked ? 'premium' : null,
        attemptsUsed: staff ? 0 : counts[e.id] ?? 0,
        attemptsMax: MAX_MOCK_EXAM_ATTEMPTS,
      }
    })
    res.json({ exams, premium })
  })
)

// ─── POST /api/questions/mock-exam ───────────────────────────────────────────
// Returns the fixed question set for one exam, in paper order. Re-checks every
// gate server-side (enabled, tier/premium, attempt cap) — the picker UI is only
// a hint. Answer columns never appear (column grants + QUIZ_COLS).
router.post(
  '/mock-exam',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const examId = String((req.body ?? {}).exam_id ?? '')
    if (!examId) return res.status(400).json({ error: 'exam_id is required' })

    const { data: exam, error: examErr } = await req.db!
      .from('mock_exams')
      .select('id, mock_set, tier, enabled')
      .eq('id', examId)
      .maybeSingle()
    if (examErr) return sendDbError(res, examErr)
    if (!exam || !(exam as MockExamRow).enabled) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    // Staff (admin/superadmin) bypass premium + attempt gates to preview exams.
    const staff = await isStaff(req)

    if (!staff && (exam as MockExamRow).tier === 'paid') {
      let premium = false
      try {
        premium = (await premiumEntitlement(req.db!)).premium
      } catch {
        premium = false
      }
      if (!premium) return res.status(403).json({ error: 'premium_required' })
    }

    // Free learners: at most ONE mock exam ever (locks even with credits), and a
    // mock costs 10 credits like any test. Premium/Vettri/staff are unlimited.
    const unlimited = await isUnlimited(req)
    if (!unlimited) {
      // Count prior mocks from the AUTHORITATIVE credit ledger (each mock start
      // writes a `test:mock-exam` spend via the SECURITY DEFINER RPC), NOT the
      // client-reported mock_exam_attempts table — so skipping the attempt
      // callback can't unlock extra free mocks. The current mock isn't charged
      // until after this check, so the count is strictly prior mocks.
      const { count } = await req.db!
        .from('credit_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'spend')
        .eq('reason', 'test:mock-exam')
      if ((count ?? 0) >= FREE_MOCK_LIMIT) {
        return res.status(403).json({ error: 'premium_required', reason: 'mock_free_used' })
      }
    }

    if (!staff) {
      const counts = await attemptCounts(req)
      if ((counts[examId] ?? 0) >= MAX_MOCK_EXAM_ATTEMPTS) {
        return res.status(403).json({ error: 'attempt_limit_reached' })
      }
    }

    const { data, error } = await req.db!
      .from('questions')
      .select(QUIZ_COLS)
      .eq('category', 'mock')
      .eq('mock_set', (exam as MockExamRow).mock_set)
    if (error) return sendDbError(res, error)
    // Shuffle so each attempt presents the questions in a fresh, mixed order
    // (the client persists this order for resume, so it stays stable mid-exam).
    const questions = shuffle((data ?? []) as unknown as Record<string, unknown>[])

    // Charge at start (atomic) once the paper is fetched. See chargeTestStart.
    if (!unlimited && questions.length > 0) {
      const gate = await chargeTestStart(req.db!, req.userId!, 'mock-exam')
      if (gate) return res.status(402).json(gate)
    }
    res.json({ questions })
  })
)

// ─── POST /api/questions/mock-exam/attempt ───────────────────────────────────
// Records a completed attempt (called from the client after the server grader
// returns). This is what the start gate counts. Best-effort: a missing exam or a
// cap overflow is ignored rather than failing the result screen.
router.post(
  '/mock-exam/attempt',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { exam_id, session_id, score, total } = req.body ?? {}
    if (!exam_id) return res.status(400).json({ error: 'exam_id is required' })

    const counts = await attemptCounts(req)
    if ((counts[String(exam_id)] ?? 0) >= MAX_MOCK_EXAM_ATTEMPTS) {
      return res.json({ ok: true, recorded: false })
    }

    const { error } = await req.db!.from('mock_exam_attempts').insert({
      user_id: req.userId!,
      exam_id: String(exam_id),
      session_id: session_id ?? null,
      score: score == null ? null : Number(score),
      total: total == null ? null : Math.trunc(Number(total)),
    })
    if (error) return sendDbError(res, error)
    res.json({ ok: true, recorded: true })
  })
)

// ─── Vettri Nichayam bank (fixed paid 13-exam set, unlimited attempts) ───────
// Fixed rows tagged category='vettri' + vettri_set. The whole bank is bundle-only
// (premium OR vettri unlocks it) with NO free tier and NO attempt cap — unlimited,
// per the product. Served only here (the leak guard keeps 'vettri' out of the
// general sampler). Answer columns never appear (column grants + QUIZ_COLS).

interface VettriExamRow {
  id: string
  vettri_set: number
  title: string
  title_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  enabled: boolean
  sort_order: number
}

// ─── GET /api/questions/vettri-exams ─────────────────────────────────────────
// The enabled exams, each annotated with lock state. `unlocked` (premium/vettri/
// staff) drives whether the whole bank is playable; non-unlocked users see the
// Vettri upsell.
router.get(
  '/vettri-exams',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('vettri_exams')
      .select(
        'id, vettri_set, title, title_ta, total_questions, duration_seconds, negative_mark, enabled, sort_order'
      )
      .eq('enabled', true)
      .order('sort_order')
    if (error) return sendDbError(res, error)

    const unlocked = await isUnlimited(req)
    const exams = ((data ?? []) as VettriExamRow[]).map((e) => ({
      id: e.id,
      title: e.title,
      title_ta: e.title_ta,
      total_questions: e.total_questions,
      duration_seconds: e.duration_seconds,
      negative_mark: Number(e.negative_mark),
      locked: !unlocked,
      lockReason: unlocked ? null : 'vettri',
    }))
    res.json({ exams, unlocked })
  })
)

// ─── POST /api/questions/vettri-exam ─────────────────────────────────────────
// The fixed question set for one exam. Re-checks the bundle gate server-side (the
// picker UI is only a hint). No attempt cap — unlimited attempts by design.
router.post(
  '/vettri-exam',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const examId = String((req.body ?? {}).exam_id ?? '')
    if (!examId) return res.status(400).json({ error: 'exam_id is required' })

    const { data: exam, error: examErr } = await req.db!
      .from('vettri_exams')
      .select('id, vettri_set, enabled')
      .eq('id', examId)
      .maybeSingle()
    if (examErr) return sendDbError(res, examErr)
    if (!exam || !(exam as VettriExamRow).enabled) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    if (!(await isUnlimited(req))) {
      return res.status(403).json({ error: 'premium_required', reason: 'vettri_required' })
    }

    const { data, error } = await req.db!
      .from('questions')
      .select(QUIZ_COLS)
      .eq('category', 'vettri')
      .eq('vettri_set', (exam as VettriExamRow).vettri_set)
    if (error) return sendDbError(res, error)
    res.json({ questions: shuffle((data ?? []) as unknown as Record<string, unknown>[]) })
  })
)

// ─── Test Series (scheduled, fixed Group 1 "Test Marathon 2026" papers) ──────
// Like Full Mock Exams (fixed rows tagged category='testseries' + test_set) but
// the WHOLE series is paid-bundle-only (premium OR Vettri) and each paper is
// date-gated: locked until its scheduled_date (IST), with a superadmin open/closed
// override. Attempt-capped.

interface TestSeriesRow {
  id: string
  test_set: number
  title: string
  title_ta: string | null
  unit_label: string | null
  unit_label_ta: string | null
  subjects_label: string | null
  subjects_label_ta: string | null
  total_questions: number
  duration_seconds: number
  negative_mark: number
  scheduled_date: string | null // 'YYYY-MM-DD'
  enabled: boolean
  open_override: 'auto' | 'open' | 'closed'
  sort_order: number
}

/** Today's date in IST (Asia/Kolkata, UTC+5:30, no DST) as 'YYYY-MM-DD'. Lexical
 *  comparison against a scheduled_date string is a valid date comparison. */
function todayIST(): string {
  const ist = new Date(Date.now() + 330 * 60_000)
  return ist.toISOString().slice(0, 10)
}

/** A test is date-locked when its override is 'closed', or 'auto' and its
 *  scheduled date is still in the future. 'open' bypasses the date gate. */
function dateLocked(row: TestSeriesRow): boolean {
  if (row.open_override === 'open') return false
  if (row.open_override === 'closed') return true
  return Boolean(row.scheduled_date && row.scheduled_date > todayIST())
}

/** Count this user's recorded test-series attempts per test (RLS scopes rows). */
async function testSeriesAttemptCounts(req: AuthedRequest): Promise<Record<string, number>> {
  const { data, error } = await req.db!.from('test_series_attempts').select('test_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as { test_id: string }[]) {
    counts[r.test_id] = (counts[r.test_id] ?? 0) + 1
  }
  return counts
}

// ─── GET /api/questions/test-series ──────────────────────────────────────────
// The enabled tests, annotated with lock state (paid-bundle OR date), the date
// they unlock, and attempts used. Access is derived from the payment ledger — any
// paid bundle (premium OR Vettri) unlocks the whole series. Staff preview all.
router.get(
  '/test-series',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('test_series')
      .select(
        'id, test_set, title, title_ta, unit_label, unit_label_ta, subjects_label, subjects_label_ta, total_questions, duration_seconds, negative_mark, scheduled_date, enabled, open_override, sort_order'
      )
      .eq('enabled', true)
      .order('sort_order')
    if (error) return sendDbError(res, error)

    const staff = await isStaff(req)
    // The whole series unlocks for ANY paid bundle — premium (₹1,699) OR Vettri
    // (₹899) — plus staff. bundleAccess().unlimited = premium || vettri.
    let unlocked = staff
    if (!unlocked) {
      try {
        unlocked = (await bundleAccess(req.db!)).unlimited
      } catch {
        unlocked = false // fail closed
      }
    }
    const counts = await testSeriesAttemptCounts(req)

    const tests = ((data ?? []) as TestSeriesRow[]).map((r) => {
      const isDateLocked = !staff && dateLocked(r)
      const locked = !unlocked || isDateLocked
      // A paid bundle takes precedence in the reason (buying unblocks the series;
      // the date still applies afterwards, reported via scheduled_date).
      const lockReason = !unlocked ? 'premium' : isDateLocked ? 'date' : null
      return {
        id: r.id,
        title: r.title,
        title_ta: r.title_ta,
        unit_label: r.unit_label,
        unit_label_ta: r.unit_label_ta,
        subjects_label: r.subjects_label,
        subjects_label_ta: r.subjects_label_ta,
        total_questions: r.total_questions,
        duration_seconds: r.duration_seconds,
        negative_mark: Number(r.negative_mark),
        scheduled_date: r.scheduled_date,
        locked,
        lockReason,
        attemptsUsed: staff ? 0 : counts[r.id] ?? 0,
        attemptsMax: MAX_TEST_SERIES_ATTEMPTS,
      }
    })
    // Key kept as `premium` for the client, but it now means "has a paid bundle"
    // (premium OR Vettri) — either unlocks the whole series.
    res.json({ tests, premium: unlocked })
  })
)

// ─── POST /api/questions/test-series ─────────────────────────────────────────
// Returns the fixed question set for one test, shuffled. Re-checks every gate
// server-side (enabled, paid-bundle, date/override, attempt cap). Answer columns
// never appear (column grants + QUIZ_COLS). Staff bypass bundle+date+attempts.
router.post(
  '/test-series',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const testId = String((req.body ?? {}).test_id ?? '')
    if (!testId) return res.status(400).json({ error: 'test_id is required' })

    const { data: test, error: tErr } = await req.db!
      .from('test_series')
      .select('id, test_set, enabled, scheduled_date, open_override')
      .eq('id', testId)
      .maybeSingle()
    if (tErr) return sendDbError(res, tErr)
    if (!test || !(test as TestSeriesRow).enabled) {
      return res.status(404).json({ error: 'Test not found' })
    }

    const staff = await isStaff(req)

    if (!staff) {
      // Any paid bundle (premium OR Vettri) unlocks the series.
      let unlocked = false
      try {
        unlocked = (await bundleAccess(req.db!)).unlimited
      } catch {
        unlocked = false
      }
      if (!unlocked) return res.status(403).json({ error: 'premium_required' })

      if (dateLocked(test as TestSeriesRow)) {
        return res.status(403).json({ error: 'not_yet_available' })
      }

      const counts = await testSeriesAttemptCounts(req)
      if ((counts[testId] ?? 0) >= MAX_TEST_SERIES_ATTEMPTS) {
        return res.status(403).json({ error: 'attempt_limit_reached' })
      }
    }

    const { data, error } = await req.db!
      .from('questions')
      .select(QUIZ_COLS)
      .eq('category', 'testseries')
      .eq('test_set', (test as TestSeriesRow).test_set)
    if (error) return sendDbError(res, error)
    res.json({ questions: shuffle((data ?? []) as unknown as Record<string, unknown>[]) })
  })
)

// Derive a coarse "question type" from a stem — the test-series bank barely
// populates questions.question_type, so we classify by content pattern (bilingual
// cues) into buckets the student can actually train on. Returned per answer so
// the analytics view can show "what kind of question you keep missing".
function deriveQType(questionType: string | null, subject: string | null, stem: string | null): string {
  const s = (stem ?? '').toLowerCase()
  if (questionType === 'match' || (/list\s*i\b/.test(s) && /list\s*ii\b/.test(s)) || /பொருத்த/.test(s))
    return 'match'
  if ((/assertion/.test(s) && /reason/.test(s)) || (/கூற்று/.test(s) && /காரணம்/.test(s)))
    return 'assertion'
  if (/\bstatements?\b/.test(s) || /\bwhich of the following\b/.test(s) || /கூற்றுக/.test(s) || /பின்வருவனவற்றுள/.test(s))
    return 'statement'
  if (subject === 'Aptitude' || subject === 'Reasoning') return 'aptitude'
  return 'factual'
}

// ─── GET /api/questions/test-series/analytics ────────────────────────────────
// This user's Test Marathon attempt history + a per-answer breakdown (subject,
// topic, derived question-type) so the client can aggregate weak areas. All rows
// are the user's own (RLS on attempts/sessions/answers). Answer stems are read
// server-side only to derive the type label — never sent to the client.
router.get(
  '/test-series/analytics',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // 1. The attempt ledger (score/total live here), newest first.
    const { data: attemptRows, error: aErr } = await req.db!
      .from('test_series_attempts')
      .select('id, test_id, session_id, score, total, submitted_at')
      .order('submitted_at', { ascending: false })
    if (aErr) return sendDbError(res, aErr)
    const attempts = (attemptRows ?? []) as {
      id: string; test_id: string; session_id: string | null
      score: number | null; total: number | null; submitted_at: string | null
    }[]
    if (attempts.length === 0) return res.json({ attempts: [], answers: [] })

    // 2. Paper titles (small catalog) and 3. session stats (attempted/correct/time).
    const sessionIds = attempts.map((a) => a.session_id).filter(Boolean) as string[]
    const [{ data: catalog }, sessionsRes] = await Promise.all([
      req.db!.from('test_series').select('id, title, title_ta, unit_label, unit_label_ta'),
      sessionIds.length
        ? req.db!
            .from('test_sessions')
            .select('id, total_questions, attempted, correct, time_taken_seconds')
            .in('id', sessionIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ])
    const titleById = new Map(
      ((catalog ?? []) as { id: string }[]).map((c) => [c.id, c as Record<string, unknown>])
    )
    const sessById = new Map(
      ((sessionsRes.data ?? []) as { id: string }[]).map((s) => [s.id, s as Record<string, unknown>])
    )

    const outAttempts = attempts.map((a) => {
      const cat = titleById.get(a.test_id)
      const sess = a.session_id ? sessById.get(a.session_id) : undefined
      return {
        id: a.id,
        test_id: a.test_id,
        title: (cat?.title as string) ?? a.test_id,
        title_ta: (cat?.title_ta as string) ?? null,
        unit_label: (cat?.unit_label as string) ?? null,
        unit_label_ta: (cat?.unit_label_ta as string) ?? null,
        score: a.score == null ? 0 : Number(a.score),
        total: a.total ?? (sess?.total_questions as number) ?? 0,
        correct: (sess?.correct as number) ?? null,
        attempted: (sess?.attempted as number) ?? null,
        time_taken_seconds: (sess?.time_taken_seconds as number) ?? null,
        submitted_at: a.submitted_at,
      }
    })

    // 4. Per-answer subject/topic/type across every attempt session.
    let answers: { is_correct: boolean | null; subject: string | null; topic: string | null; qtype: string }[] = []
    if (sessionIds.length) {
      const { data: ans, error: ansErr } = await req.db!
        .from('test_answers')
        .select('is_correct, question:questions(subject, topic, question_type, question_text)')
        .in('session_id', sessionIds)
      if (ansErr) return sendDbError(res, ansErr)
      type Row = {
        is_correct: boolean | null
        question: { subject: string | null; topic: string | null; question_type: string | null; question_text: string | null } | null
      }
      // supabase-js types the to-one `question` join as an array; at runtime it's
      // a single row (FK question_id → questions.id), so cast through unknown.
      answers = ((ans ?? []) as unknown as Row[])
        .filter((r) => r.question)
        .map((r) => ({
          is_correct: r.is_correct,
          subject: r.question!.subject,
          topic: r.question!.topic,
          qtype: deriveQType(r.question!.question_type, r.question!.subject, r.question!.question_text),
        }))
    }

    res.json({ attempts: outAttempts, answers })
  })
)

// ─── POST /api/questions/test-series/attempt ─────────────────────────────────
// Records a completed attempt (called after the server grader returns). This is
// what the start gate counts. Best-effort: overflow/missing test is ignored.
router.post(
  '/test-series/attempt',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { test_id, session_id, score, total } = req.body ?? {}
    if (!test_id) return res.status(400).json({ error: 'test_id is required' })

    const counts = await testSeriesAttemptCounts(req)
    if ((counts[String(test_id)] ?? 0) >= MAX_TEST_SERIES_ATTEMPTS) {
      return res.json({ ok: true, recorded: false })
    }

    const { error } = await req.db!.from('test_series_attempts').insert({
      user_id: req.userId!,
      test_id: String(test_id),
      session_id: session_id ?? null,
      score: score == null ? null : Number(score),
      total: total == null ? null : Math.trunc(Number(total)),
    })
    if (error) return sendDbError(res, error)
    res.json({ ok: true, recorded: true })
  })
)

export default router
