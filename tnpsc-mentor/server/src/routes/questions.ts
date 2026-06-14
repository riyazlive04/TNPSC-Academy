import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

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
    const { category, subject, standard } = req.body ?? {}

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

export default router
