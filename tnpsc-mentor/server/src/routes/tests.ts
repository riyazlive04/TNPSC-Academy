import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── POST /api/tests/submit ──────────────────────────────────────────────────
// Server-graded test submission. The DB function is the sole grader and only
// reveals answers/explanations when the 80% attendance gate is met.
router.post(
  '/submit',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { session, answers } = req.body ?? {}
    if (!session || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'session and answers[] are required' })
    }
    const { data, error } = await req.db!.rpc('submit_test', {
      p_session: session,
      p_answers: answers,
    })
    if (error) return sendDbError(res, error)
    res.json(data)
  })
)

export default router
