import { Router } from 'express'
import { asyncH, sendDbError, isMissingFunction } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { recordSeen } from '../lib/seen.js'
import { premiumEntitlement } from '../lib/premium.js'
import { MAX_MOCK_EXAM_ATTEMPTS } from '../pricing.js'

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
        { category: 'subject', subjects: ['Tamil Nadu Administration'] },
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
        { category: 'subject', subjects: ['Tamil Nadu Administration'] },
        { category: 'pyq', subjects: ['Development Administration of TamilNadu'] },
      ] },
    { label: 'Current Affairs', count: 10,
      queries: [{ category: 'current_affairs' }] },
    { label: 'Aptitude', count: 10,
      queries: [{ category: 'aptitude' }] },
  ],
}

// ─── Subject Practice free gate ──────────────────────────────────────────────
// Free (non-premium, non-staff) learners get ONE completed Subject Practice test
// per subject; a second test on a subject they've already finished is premium.
// Other categories (samacheer/pyq/aptitude/current_affairs) are never gated here.

/** Has the caller already completed a Subject Practice test for this subject? */
async function subjectFreeTestUsed(req: AuthedRequest, subject: string): Promise<boolean> {
  // RLS scopes test_sessions to the caller; an exact head-count is not capped by
  // PostgREST's row limit, so power users with 1000+ sessions still gate right.
  const { count, error } = await req.db!
    .from('test_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'subject')
    .eq('subject', subject)
    .eq('status', 'completed')
  if (error) {
    // Fail OPEN: a transient read error must not deny a free learner their first
    // legitimate test. Worst case is one extra free test, never a wrongful lock.
    console.error('[subject-gate] count failed', error.code, error.message)
    return false
  }
  return (count ?? 0) >= 1
}

/** True when this subject is locked behind premium for the caller (UI + /quiz gate). */
async function subjectLocked(req: AuthedRequest, subject: string): Promise<boolean> {
  if (await isStaff(req)) return false
  let premium = false
  try {
    premium = (await premiumEntitlement(req.db!)).premium
  } catch {
    premium = false // fail closed on entitlement: treat as free (gate may apply)
  }
  if (premium) return false
  return subjectFreeTestUsed(req, subject)
}

// ─── GET /api/questions/subject-access ───────────────────────────────────────
// Powers the Subject Practice lock UI: the caller's premium state plus the
// subjects whose one free test is already used (locked for free users). Premium
// and staff have no locks, so the list is empty for them.
router.get(
  '/subject-access',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const staff = await isStaff(req)
    let premium = staff
    if (!premium) {
      try {
        premium = (await premiumEntitlement(req.db!)).premium
      } catch {
        premium = false
      }
    }
    if (premium) return res.json({ premium: true, usedSubjects: [] })

    const { data, error } = await req.db!
      .from('test_sessions')
      .select('subject')
      .eq('category', 'subject')
      .eq('status', 'completed')
      .not('subject', 'is', null)
    if (error) return sendDbError(res, error)
    const usedSubjects = [
      ...new Set(((data ?? []) as { subject: string | null }[]).map((r) => r.subject).filter(Boolean)),
    ]
    res.json({ premium: false, usedSubjects })
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
    // Subject Practice: enforce the one-free-test-per-subject gate server-side
    // (the picker only hints at it). Premium/staff bypass; other categories skip.
    if (config.category === 'subject' && config.subject) {
      if (await subjectLocked(req, String(config.subject))) {
        return res.status(403).json({ error: 'premium_required', reason: 'subject_free_used' })
      }
    }
    const { data, error } = await req.db!.rpc('get_quiz_questions', { p_config: config })
    if (error) return sendDbError(res, error)
    const questions = (data ?? []) as { id?: string }[]
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
    // Clamp the requested count to a sane range (the RPC also clamps to [1,200],
    // but guard here so a NaN/negative never reaches it).
    const n = Math.min(Math.max(Math.trunc(Number(count)) || 50, 1), 200)

    // Random sampling done server-side (ORDER BY random + limit) so it's not
    // limited to the first 1000 rows of the subject bank.
    const { data, error } = await req.db!.rpc('subject_mock_questions', {
      p_subject: subject ?? null,
      p_topic: topic ?? null,
      p_difficulty: difficulty ?? null,
      p_count: n,
    })
    if (!error) {
      const questions = (data ?? []) as { id?: string }[]
      void recordSeen(req, questions)
      return res.json({ questions })
    }
    if (!isMissingFunction(error)) return sendDbError(res, error)

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
    const questions = shuffle((rows ?? []) as unknown as Record<string, unknown>[]).slice(0, n)
    void recordSeen(req, questions as { id?: string }[])
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
    res.json({ questions: shuffle((data ?? []) as unknown as Record<string, unknown>[]) })
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

export default router
