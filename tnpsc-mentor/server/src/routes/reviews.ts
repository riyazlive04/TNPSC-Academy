import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

/** Validate a UUID so a malformed id can't reach the RPC as a bad cast. */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// ─── GET /api/reviews/due?limit=30 ───────────────────────────────────────────
// Spaced-repetition items due now (no answers — revealed only on grade).
router.get(
  '/due',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Clamp: an unvalidated `limit=abc` would forward NaN to the RPC.
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 30, 1), 100)
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
    // review_items also holds the flashcard deck (question_id NULL, see
    // supabase/flashcards.sql). This badge counts MCQ revision only — the
    // /due list already excludes them by INNER JOINing questions, so without
    // this filter the badge would promise items that screen can't show.
    // Keyed on question_id (not flashcard_item_id) so it is correct whether or
    // not the flashcards migration has been applied yet.
    const { count, error } = await req.db!
      .from('review_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .not('question_id', 'is', null)
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
    // Only accept string ids, and cap the batch so a single request can't bloat
    // the deck / stress the DB with an oversized array (self-DoS bound).
    const ids: string[] = Array.isArray(req.body?.questionIds)
      ? req.body.questionIds.filter((x: unknown) => typeof x === 'string').slice(0, 500)
      : []
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
    if (typeof itemId !== 'string' || !isUuid(itemId)) {
      return res.status(400).json({ error: 'Invalid itemId.' })
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
