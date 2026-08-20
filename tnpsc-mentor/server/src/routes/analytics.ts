import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/analytics ──────────────────────────────────────────────────────
// Raw rows for the Insights page (sessions + per-answer subject/topic). The
// frontend keeps its aggregation logic; this just serves its own RLS-guarded data.
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Bound to the last year — an unbounded query returned a user's entire
    // lifetime of sessions (and every answer in them) on every Insights page
    // open. Mirrors the 365-day clamp ceiling in profile.ts's /activity route.
    const since = new Date()
    since.setDate(since.getDate() - 365)

    const { data: sessions, error: sErr } = await req.db!
      .from('test_sessions')
      .select(
        'id,category,subject,score_percentage,total_questions,correct,attempted,completed_at,time_taken_seconds'
      )
      .eq('user_id', req.userId)
      .eq('status', 'completed')
      .gte('completed_at', since.toISOString())
      .order('completed_at', { ascending: true })
    if (sErr) return sendDbError(res, sErr)

    const rows = sessions ?? []
    if (rows.length === 0) return res.json({ sessions: [], answers: [] })

    const sessionIds = rows.map((r: { id: string }) => r.id)
    const { data: answers, error: aErr } = await req.db!
      .from('test_answers')
      .select('is_correct,question:questions(subject,topic,category,aptitude_topic,ca_topic)')
      .in('session_id', sessionIds)
    if (aErr) return sendDbError(res, aErr)

    res.json({ sessions: rows, answers: answers ?? [] })
  })
)

export default router
