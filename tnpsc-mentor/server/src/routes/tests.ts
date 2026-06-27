import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { FREE_PDF_DOWNLOADS } from '../pricing.js'
import { premiumEntitlement } from '../lib/premium.js'
import { notifyUser } from '../notify.js'
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

    // Subject Practice free-gate nudge: if this submission just used up the
    // learner's one free test for the subject, tell them (in-app feed + a device
    // push). Fire-and-forget — the result must not wait on a notification.
    void maybeNotifySubjectFreeUsed(req, session).catch((e) =>
      console.error('[subject-free-notify] post-submit hook failed', e)
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

/**
 * After a Subject Practice test is graded, notify a free learner exactly once —
 * on the FIRST completed test for that subject, i.e. the one that just spent
 * their free pass and locked the subject (gate lives in routes/questions.ts).
 * Sends an in-app feed entry + a Web Push to their device(s). Staff and premium
 * users aren't gated, so they're never notified. Best-effort; never throws.
 */
async function maybeNotifySubjectFreeUsed(
  req: AuthedRequest,
  session: Record<string, unknown>
): Promise<void> {
  if ((session.category as string | null) !== 'subject') return
  const subject = (session.subject as string | null) ?? null
  if (!subject) return

  // Staff bypass the gate entirely.
  const role = await roleOf(req.userId!)
  if (role === 'admin' || role === 'superadmin') return

  // Premium isn't gated either.
  let premium = false
  try {
    premium = (await premiumEntitlement(req.db!)).premium
  } catch {
    premium = false
  }
  if (premium) return

  // Only on the transition 0 → 1 completed tests for this subject. The just-saved
  // session is already committed, so an exact head-count of 1 means this was the
  // first (and now-spent) free test. (RLS scopes the count to the caller.)
  const { count, error } = await req.db!
    .from('test_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'subject')
    .eq('subject', subject)
    .eq('status', 'completed')
  if (error || (count ?? 0) !== 1) return

  // Localize to the learner's saved language (ta → Tamil; else English).
  const { data: profile } = await req.db!
    .from('profiles')
    .select('language')
    .eq('id', req.userId!)
    .maybeSingle()
  const ta = (profile?.language as string | null) === 'ta'
  const title = ta ? 'இலவசத் தேர்வு முடிந்தது' : 'Free subject test used'
  const body = ta
    ? `${subject} பாடத்திற்கான உங்கள் இலவசத் தேர்வை முடித்துவிட்டீர்கள். வரம்பற்ற பாடத் தேர்வுகளுக்கு பிரீமியம் பெறுங்கள்.`
    : `You've used your free ${subject} practice test. Go Premium for unlimited subject tests.`

  await notifyUser(req.userId!, { title, body, url: '/test-arena', push: true })
}

// Premium check that never blocks the free path: a ledger read error fails
// CLOSED (treated as free, so the cap applies) rather than handing out unlimited
// downloads. Mirrors how the client treats a premium-status error.
async function isPremium(req: AuthedRequest): Promise<boolean> {
  try {
    return (await premiumEntitlement(req.db!)).premium
  } catch {
    return false
  }
}

// ─── GET /api/tests/pdf-quota ────────────────────────────────────────────────
// The caller's explanation-PDF download allowance. Premium → unlimited
// (remaining = null); free → FREE_PDF_DOWNLOADS total minus what they've used.
router.get(
  '/pdf-quota',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    if (await isPremium(req)) {
      return res.json({ premium: true, used: 0, cap: FREE_PDF_DOWNLOADS, remaining: null })
    }
    // Read via the service role (same pattern as payments.ts) so it doesn't
    // depend on profiles-SELECT RLS for the caller's own row.
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('pdf_downloads')
      .eq('id', req.userId!)
      .single()
    if (error) return sendDbError(res, error)
    const used = Number(data?.pdf_downloads ?? 0)
    res.json({
      premium: false,
      used,
      cap: FREE_PDF_DOWNLOADS,
      remaining: Math.max(FREE_PDF_DOWNLOADS - used, 0),
    })
  })
)

// ─── POST /api/tests/pdf-download ─────────────────────────────────────────────
// Reserve one download slot, called right before the client generates the PDF.
// Premium → always allowed and uncounted. Free → atomic increment-under-cap;
// `allowed:false` once the cap is reached (the client then nudges to upgrade).
router.post(
  '/pdf-download',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    if (await isPremium(req)) {
      return res.json({ allowed: true, premium: true, used: 0, cap: FREE_PDF_DOWNLOADS, remaining: null })
    }
    const { data, error } = await req.db!.rpc('record_pdf_download', { p_cap: FREE_PDF_DOWNLOADS })
    if (error) return sendDbError(res, error)
    const r = data as { allowed: boolean; used: number; remaining: number }
    res.json({ ...r, premium: false, cap: FREE_PDF_DOWNLOADS })
  })
)

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
