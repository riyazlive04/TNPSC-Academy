import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/bookmarks/ids ──────────────────────────────────────────────────
// Just the saved question ids (for toggle state across the app).
router.get(
  '/ids',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Defensive cap — a normal account has a handful to a few hundred bookmarks,
    // never unbounded.
    const { data, error } = await req.db!.from('bookmarks').select('question_id').limit(500)
    if (error) return sendDbError(res, error)
    res.json({ ids: (data ?? []).map((r: { question_id: string }) => r.question_id) })
  })
)

// ─── GET /api/bookmarks ──────────────────────────────────────────────────────
// Full saved questions with answers/explanations revealed (own rows only).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_bookmarks')
    if (error) return sendDbError(res, error)
    res.json({ questions: data ?? [] })
  })
)

// ─── POST /api/bookmarks ─────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { questionId } = req.body ?? {}
    if (!questionId) return res.status(400).json({ error: 'questionId is required' })
    const { error } = await req.db!
      .from('bookmarks')
      .upsert(
        { user_id: req.userId, question_id: questionId },
        { onConflict: 'user_id,question_id' }
      )
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── DELETE /api/bookmarks/:questionId ───────────────────────────────────────
router.delete(
  '/:questionId',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await req.db!
      .from('bookmarks')
      .delete()
      .eq('question_id', req.params.questionId)
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

export default router
