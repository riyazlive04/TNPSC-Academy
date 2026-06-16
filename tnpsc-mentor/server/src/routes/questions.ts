import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// Columns safe to return to the client (answers stripped at column-grant level,
// but we also list them explicitly to be unambiguous).
const QUIZ_COLS = [
  'id', 'category', 'group_type', 'year', 'standard',
  'ca_month', 'ca_year', 'ca_type', 'ca_topic',
  'aptitude_type', 'aptitude_topic', 'subject', 'topic',
  'question_type', 'external_id', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
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

// ─── POST /api/questions/quiz ────────────────────────────────────────────────
// Safe quiz questions for a config (no answers — get_quiz_questions strips them
// server-side and returns a random sample).
router.post(
  '/quiz',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const config = req.body?.config ?? {}
    const { data, error } = await req.db!.rpc('get_quiz_questions', { p_config: config })
    if (error) return sendDbError(res, error)
    res.json({ questions: data ?? [] })
  })
)

// ─── POST /api/questions/topics ──────────────────────────────────────────────
// Distinct topic list for a picker (Samacheer `topic`, Current-Affairs `ca_topic`).
router.post(
  '/topics',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { category, subject, standard, aptitude_type } = req.body ?? {}

    if (category === 'aptitude') {
      // Aptitude bank: distinct topics for a chosen sub-category (numerics /
      // reasoning), active rows only so empty/hidden topics don't surface.
      let q = req.db!
        .from('questions')
        .select('aptitude_topic')
        .eq('category', 'aptitude')
        .eq('active', true)
        .not('aptitude_topic', 'is', null)
      if (aptitude_type) q = q.eq('aptitude_type', aptitude_type)
      const { data, error } = await q
      if (error) return sendDbError(res, error)
      const topics = Array.from(
        new Set(
          (data ?? []).map((r: { aptitude_topic: string | null }) => r.aptitude_topic).filter(Boolean)
        )
      ).sort()
      return res.json({ topics })
    }

    if (category === 'samacheer') {
      let q = req.db!
        .from('questions')
        .select('topic')
        .eq('category', 'samacheer')
        .not('topic', 'is', null)
      if (subject) q = q.eq('subject', subject)
      if (standard != null) q = q.eq('standard', standard)
      const { data, error } = await q
      if (error) return sendDbError(res, error)
      const topics = Array.from(
        new Set((data ?? []).map((r: { topic: string | null }) => r.topic).filter(Boolean))
      )
      return res.json({ topics })
    }

    if (category === 'pyq') {
      // PYQ topic-level practice (currently used by the Aptitude subject, whose
      // imported bank carries fine-grained topics). Only ACTIVE rows so hidden
      // legacy questions don't leave dead topic pills. group_type is intentionally
      // not filtered — it mirrors get_quiz_questions, which pools PYQ by subject.
      let q = req.db!
        .from('questions')
        .select('topic')
        .eq('category', 'pyq')
        .eq('active', true)
        .not('topic', 'is', null)
      if (subject) q = q.eq('subject', subject)
      const { data, error } = await q
      if (error) return sendDbError(res, error)
      const topics = Array.from(
        new Set((data ?? []).map((r: { topic: string | null }) => r.topic).filter(Boolean))
      ).sort()
      return res.json({ topics })
    }

    if (category === 'subject') {
      // Subject Practice bank: distinct topics for a chosen subject (active only).
      let q = req.db!
        .from('questions')
        .select('topic')
        .eq('category', 'subject')
        .eq('active', true)
        .not('topic', 'is', null)
      if (subject) q = q.eq('subject', subject)
      const { data, error } = await q
      if (error) return sendDbError(res, error)
      const topics = Array.from(
        new Set((data ?? []).map((r: { topic: string | null }) => r.topic).filter(Boolean))
      ).sort()
      return res.json({ topics })
    }

    if (category === 'current_affairs') {
      // Topic-wise CA is driven by the question `topic` column (e.g. 'Tamil Nadu',
      // 'Economy', 'Sports') — the imported real bank tags every row this way.
      // (Legacy ca_topic/ca_type='topic_wise' rows, if any, are also covered by
      // falling back to ca_topic when topic is absent.)
      const { data, error } = await req.db!
        .from('questions')
        .select('topic, ca_topic')
        .eq('category', 'current_affairs')
      if (error) return sendDbError(res, error)
      const topics = Array.from(
        new Set(
          (data ?? [])
            .map((r: { topic: string | null; ca_topic: string | null }) => r.topic ?? r.ca_topic)
            .filter(Boolean)
        )
      ).sort()
      return res.json({ topics })
    }

    res.json({ topics: [] })
  })
)

// ─── POST /api/questions/history-periods ─────────────────────────────────────
// Counts the PYQ History bank (category='pyq', subject='History and INM') by
// historical period — the `unit` column holds 'ancient' | 'medieval' | 'modern'.
// Powers the three-criteria History selector (counts + disable empty periods).
const HISTORY_PYQ_SUBJECT = 'History and INM'
router.post(
  '/history-periods',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('questions')
      .select('unit')
      .eq('category', 'pyq')
      .eq('subject', HISTORY_PYQ_SUBJECT)
      .eq('active', true)
      .not('unit', 'is', null)
    if (error) return sendDbError(res, error)
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as { unit: string | null }[]) {
      if (!r.unit) continue
      counts[r.unit] = (counts[r.unit] ?? 0) + 1
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
    let q = req.db!
      .from('questions')
      .select('question_type')
      .eq('category', 'subject')
      .eq('active', true)
      .not('question_type', 'is', null)
    if (subject) q = q.eq('subject', subject)
    if (topic) q = q.eq('topic', topic)
    const { data, error } = await q
    if (error) return sendDbError(res, error)
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as { question_type: string | null }[]) {
      if (!r.question_type) continue
      counts[r.question_type] = (counts[r.question_type] ?? 0) + 1
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

    for (const slot of slots) {
      const pool: Record<string, unknown>[] = []
      const seen = new Set<string>()

      for (const qdef of slot.queries) {
        let q = req.db!
          .from('questions')
          .select(QUIZ_COLS)
          .eq('category', qdef.category)
          .eq('active', true)
        if (qdef.subjects?.length) q = q.in('subject', qdef.subjects)
        const { data, error } = await q
        if (error) return sendDbError(res, error)
        for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
          const id = row.id as string
          if (!seen.has(id)) { seen.add(id); pool.push(row) }
        }
      }

      const picked = shuffle(pool).slice(0, slot.count)
      result.push(...picked)
    }

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

    let q = req.db!
      .from('questions')
      .select(QUIZ_COLS)
      .eq('category', 'subject')
      .eq('active', true)
    if (subject) q = q.eq('subject', subject)
    if (topic) q = q.eq('topic', topic)
    if (difficulty) q = q.eq('difficulty', difficulty)

    const { data, error } = await q
    if (error) return sendDbError(res, error)

    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    const questions = shuffle(rows).slice(0, Number(count))
    res.json({ questions })
  })
)

export default router
