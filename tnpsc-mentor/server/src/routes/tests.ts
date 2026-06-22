import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import {
  REVISION_PASS_MARK,
  buildLabel,
  buildScopeConfig,
  buildTopicKey,
  computeAvailableAt,
  isRevisable,
  type RevisionScope,
} from '../lib/revision.js'

const router = Router()

// Upper bound on a single submission's answers[] — no real test is this long, so
// a larger array is abuse. Bounds RPC work and memory per request.
const MAX_ANSWERS = 500

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
    if (answers.length > MAX_ANSWERS) {
      return res.status(400).json({ error: `Too many answers (max ${MAX_ANSWERS}).` })
    }
    // Every entry must carry a string question_id before we forward to the grader.
    if (!answers.every((a) => a && typeof (a as { question_id?: unknown }).question_id === 'string')) {
      return res.status(400).json({ error: 'Each answer must include a string question_id.' })
    }
    const { data, error } = await req.db!.rpc('submit_test', {
      p_session: session,
      p_answers: answers,
    })
    if (error) return sendDbError(res, error)

    // ── Topic revision layer ────────────────────────────────────────────────
    // After grading, auto-flag a low-scoring topic test for revision (and clear
    // a passing re-test). Best-effort: a failure here must never block the
    // graded result the learner is waiting on.
    const result = data as { score_percentage?: number; session_id?: string }
    const revision = await applyRevision(req, session, answers, result).catch(
      (e) => {
        console.error('[revision] post-submit hook failed', e)
        return null
      }
    )

    res.json(revision ? { ...result, revision } : result)
  })
)

/** Scope fields carried on the submit session (see lib/revision.ts). */
function scopeOf(session: Record<string, unknown>): RevisionScope {
  return {
    category: (session.category as string) ?? null,
    group_type: (session.group_type as string) ?? null,
    subject: (session.subject as string) ?? null,
    standard: (session.standard as number) ?? null,
    topic: (session.topic as string) ?? null,
    unit: (session.unit as string) ?? null,
    question_type: (session.question_type as string) ?? null,
    ca_type: (session.ca_type as string) ?? null,
    ca_month: (session.ca_month as string) ?? null,
    ca_topic: (session.ca_topic as string) ?? null,
    aptitude_type: (session.aptitude_type as string) ?? null,
    aptitude_topic: (session.aptitude_topic as string) ?? null,
    difficulty: (session.difficulty as string) ?? null,
  }
}

/**
 * Returns a small `revision` summary for the Result page, or null when the test
 * isn't revision-eligible. Clears a passing re-test; otherwise enqueues / resets
 * the study gate for a below-pass-mark topic test.
 */
async function applyRevision(
  req: AuthedRequest,
  session: Record<string, unknown>,
  answers: { question_id?: string }[],
  result: { score_percentage?: number; session_id?: string }
): Promise<Record<string, unknown> | null> {
  const score = Number(result?.score_percentage ?? 0)
  const revisionId = (session.revision_id as string) ?? null
  const scope = scopeOf(session)

  // A passing re-attempt of an existing revision → clear it. The learner must
  // score ABOVE the pass mark; exactly REVISION_PASS_MARK still needs revision.
  if (revisionId && score > REVISION_PASS_MARK) {
    await req.db!.rpc('clear_revision_topic', { p_id: revisionId })
    return { cleared: true }
  }

  // A topic test at/below the pass mark → flag (or re-flag) it and lock the
  // re-test. Inclusive at the mark (40% counts as needing revision).
  if (isRevisable(scope) && score <= REVISION_PASS_MARK) {
    const availableAt = computeAvailableAt(Date.now())
    const seenIds = answers
      .map((a) => a.question_id)
      .filter((id): id is string => !!id)
    const label = buildLabel(scope)
    const { error } = await req.db!.rpc('upsert_revision_topic', {
      p_topic_key: buildTopicKey(scope),
      p_config: buildScopeConfig(scope),
      p_label: label,
      p_score: score,
      p_session_id: result.session_id ?? null,
      p_seen_ids: seenIds,
      p_available_at: availableAt.toISOString(),
    })
    if (error) {
      console.error('[revision] upsert failed', error.code, error.message)
      return null
    }
    return {
      enqueued: true,
      status: 'locked',
      available_at: availableAt.toISOString(),
      label,
    }
  }

  return null
}

// ─── POST /api/tests/abandon ─────────────────────────────────────────────────
// Records a test that was exited mid-way (status = 'abandoned').
router.post(
  '/abandon',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { session } = req.body ?? {}
    if (!session) {
      return res.status(400).json({ error: 'session is required' })
    }
    const { data, error } = await req.db!.rpc('record_abandoned_test', {
      p_session: session,
    })
    if (error) return sendDbError(res, error)
    res.json({ sessionId: data })
  })
)

export default router
