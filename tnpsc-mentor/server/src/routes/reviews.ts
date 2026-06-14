import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/reviews/due?limit=30 ───────────────────────────────────────────
// Spaced-repetition items due now (no answers — revealed only on grade).
router.get(
  '/due',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Number(req.query.limit ?? 30)
    const { data, error } = await req.db!.rpc('get_due_reviews', { p_limit: limit })
    if (error) return sendDbError(res, error)
    res.json({ items: data ?? [] })
  })
)

// ─── GET /api/reviews/count ──────────────────────────────────────────────────
// How many items are due now (dashboard badge).
router.get(
  '/count',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { count, error } = await req.db!
      .from('review_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .lte('due_at', new Date().toISOString())
    if (error) return sendDbError(res, error)
    res.json({ count: count ?? 0 })
  })
)

// ─── POST /api/reviews/enqueue ───────────────────────────────────────────────
// Add wrong/flagged question ids to the deck (no schedule reset on dupes).
router.post(
  '/enqueue',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const ids: string[] = Array.isArray(req.body?.questionIds) ? req.body.questionIds : []
    if (ids.length === 0) return res.json({ ok: true })
    const nowIso = new Date().toISOString()
    const rows = ids.map((qid) => ({
      user_id: req.userId,
      question_id: qid,
      due_at: nowIso,
      interval_days: 0,
      reps: 0,
    }))
    const { error } = await req.db!
      .from('review_items')
      .upsert(rows, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── POST /api/reviews/grade ─────────────────────────────────────────────────
// Grade one review item; server reveals the answer and reschedules (SM-2-lite).
router.post(
  '/grade',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { itemId, selected } = req.body ?? {}
    if (!itemId || !selected) {
      return res.status(400).json({ error: 'itemId and selected are required' })
    }
    const { data, error } = await req.db!.rpc('grade_review', {
      p_item_id: itemId,
      p_selected: selected,
    })
    if (error) return sendDbError(res, error)
    res.json(data)
  })
)

export default router
