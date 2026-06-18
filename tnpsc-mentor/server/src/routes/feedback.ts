import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── POST /api/feedback ──────────────────────────────────────────────────────
// Any signed-in student can submit an app rating (1-5) + optional message. The
// row is written through the user-scoped client so RLS enforces user_id = self.
router.post(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const rating = Number(req.body?.rating)
    const message: string | null = req.body?.message?.toString().trim() || null
    const page: string | null = req.body?.page?.toString().slice(0, 200) || null

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be an integer 1–5' })
    }

    // Rate-limit: one submission per user per 3 months. The user-scoped client
    // (RLS "Users read own feedback") only ever sees this user's own rows.
    const since = new Date()
    since.setMonth(since.getMonth() - 3)
    const { data: recent, error: recentErr } = await req.db!
      .from('app_feedback')
      .select('created_at')
      .eq('user_id', req.userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
    if (recentErr) return sendDbError(res, recentErr)
    if (recent && recent.length > 0) {
      const nextAt = new Date(recent[0].created_at)
      nextAt.setMonth(nextAt.getMonth() + 3)
      return res
        .status(429)
        .json({ error: 'feedback_rate_limited', nextAt: nextAt.toISOString() })
    }

    const { data, error } = await req.db!
      .from('app_feedback')
      .insert({ user_id: req.userId, rating, message, page })
      .select('id')
      .single()
    if (error) return sendDbError(res, error)
    res.json({ ok: true, id: data?.id })
  })
)

// ─── POST /api/feedback/explanation ──────────────────────────────────────────
// Per-explanation thumbs up/down while reviewing answers. One vote per user per
// question (re-voting updates it). A 'down' marks an explanation as needing work.
router.post(
  '/explanation',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const questionId = String(req.body?.questionId ?? '').trim()
    const vote = req.body?.vote
    if (!questionId) return res.status(400).json({ error: 'questionId is required' })
    if (vote !== 'up' && vote !== 'down') {
      return res.status(400).json({ error: "vote must be 'up' or 'down'" })
    }
    const { error } = await req.db!
      .from('explanation_feedback')
      .upsert(
        { user_id: req.userId, question_id: questionId, vote, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,question_id' }
      )
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── POST /api/feedback/question-report ──────────────────────────────────────
// "Mark this question for correction" during a test. `reported: true` records
// (or updates) the report; `reported: false` removes it (re-tap to un-flag).
// One report per user per question; the optional `reason` is a short note.
router.post(
  '/question-report',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const questionId = String(req.body?.questionId ?? '').trim()
    if (!questionId) return res.status(400).json({ error: 'questionId is required' })
    const reported = req.body?.reported !== false // default true
    const reason: string | null = req.body?.reason?.toString().slice(0, 500).trim() || null

    if (!reported) {
      const { error } = await req.db!
        .from('question_reports')
        .delete()
        .eq('user_id', req.userId)
        .eq('question_id', questionId)
      if (error) return sendDbError(res, error)
      return res.json({ ok: true, reported: false })
    }

    const { error } = await req.db!
      .from('question_reports')
      .upsert(
        { user_id: req.userId, question_id: questionId, reason, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,question_id' }
      )
    if (error) return sendDbError(res, error)
    res.json({ ok: true, reported: true })
  })
)

export default router
