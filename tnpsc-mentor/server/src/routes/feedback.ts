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

    const { data, error } = await req.db!
      .from('app_feedback')
      .insert({ user_id: req.userId, rating, message, page })
      .select('id')
      .single()
    if (error) return sendDbError(res, error)
    res.json({ ok: true, id: data?.id })
  })
)

export default router
