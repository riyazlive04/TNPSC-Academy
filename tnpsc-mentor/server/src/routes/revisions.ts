import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { recordSeen } from '../lib/seen.js'

const router = Router()

// Default number of questions in a revision re-test (the learner doesn't pick a
// count here — it's a focused retry). Clamped so a hand-crafted ?count can't ask
// for a huge or zero-length test.
const DEFAULT_REVISION_COUNT = 10

// ─── GET /api/revisions ──────────────────────────────────────────────────────
// A user's topic revisions, each with a derived status (locked | available |
// cleared). Used to render the "Studying / Ready / Cleared" sections.
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('list_revision_topics')
    if (error) return sendDbError(res, error)
    res.json({ items: data ?? [] })
  })
)

// ─── GET /api/revisions/analytics ────────────────────────────────────────────
// Pure-logic aggregates (counts, avg scores, improvement, weak subjects, focus
// list) for the revision dashboard.
router.get(
  '/analytics',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('revision_analytics')
    if (error) return sendDbError(res, error)
    res.json({ analytics: data ?? {} })
  })
)

// ─── POST /api/revisions/:id/start ───────────────────────────────────────────
// The study gate. Serves a fresh test on the saved topic ONLY when the unlock
// time has passed. Questions are SIMILAR, not identical: already-seen ids are
// excluded, with a top-up from the full pool so the test is never short.
router.post(
  '/:id/start',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { id } = req.params

    const { data: row, error } = await req.db!
      .from('revision_topics')
      .select('id, config, label, seen_ids, available_at, cleared_at')
      .eq('id', id)
      .maybeSingle()
    if (error) return sendDbError(res, error)
    if (!row) return res.status(404).json({ error: 'Revision not found' })
    if (row.cleared_at) {
      return res.status(409).json({ error: 'This topic is already cleared.' })
    }
    if (new Date(row.available_at as string).getTime() > Date.now()) {
      return res.status(423).json({
        error: 'Still studying — this test is locked.',
        available_at: row.available_at,
      })
    }

    const requested = Math.min(
      Math.max(Math.trunc(Number(req.query.count)) || DEFAULT_REVISION_COUNT, 5),
      50
    )
    const scope = (row.config ?? {}) as Record<string, unknown>
    const seenIds = (row.seen_ids ?? []) as string[]

    // Prefer unseen questions from the same scope…
    const questions = await fetchQuiz(req, { ...scope, limit: requested, exclude_ids: seenIds })
    if (questions instanceof Error) return sendDbError(res, questions)

    // …then top up from the full pool if exclusion thinned it out, so a small
    // bank never yields a short (or empty) re-test.
    if (questions.length < requested) {
      const fill = await fetchQuiz(req, { ...scope, limit: requested })
      if (fill instanceof Error) return sendDbError(res, fill)
      const have = new Set(questions.map((q) => q.id))
      for (const q of fill) {
        if (have.has(q.id)) continue
        questions.push(q)
        have.add(q.id)
        if (questions.length >= requested) break
      }
    }

    void recordSeen(req, questions)

    res.json({
      revisionId: row.id,
      label: row.label,
      // A ready-to-run QuizConfig: the saved scope + the revision markers the
      // client threads back through submit so a pass can clear this row.
      config: { ...scope, revision: true, revisionId: row.id, label: row.label },
      questions,
    })
  })
)

// ─── POST /api/revisions/:id/dismiss ─────────────────────────────────────────
// Remove a revision from the tab (the learner doesn't want to retry it).
router.post(
  '/:id/dismiss',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('dismiss_revision_topic', {
      p_id: req.params.id,
    })
    if (error) return sendDbError(res, error)
    res.json({ ok: data === true })
  })
)

type QuizRow = { id: string } & Record<string, unknown>

/** Run get_quiz_questions; returns the rows or the DB error to forward. */
async function fetchQuiz(
  req: AuthedRequest,
  config: Record<string, unknown>
): Promise<QuizRow[] | Error> {
  const { data, error } = await req.db!.rpc('get_quiz_questions', { p_config: config })
  if (error) return error as unknown as Error
  return (data ?? []) as QuizRow[]
}

export default router
