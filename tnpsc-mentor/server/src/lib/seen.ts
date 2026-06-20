import type { AuthedRequest } from '../middleware/auth.js'

/**
 * Record the questions just served to the learner as "seen", so the sampling
 * RPCs push them to the back of future draws (see supabase/seen_questions.sql).
 *
 * Insert-or-ignore: a question already seen keeps its original seen_at and costs
 * nothing. Best-effort — a failure here must never break the quiz the learner is
 * about to take, so callers fire-and-forget and we swallow errors.
 */
export async function recordSeen(
  req: AuthedRequest,
  questions: { id?: string | null }[]
): Promise<void> {
  if (!req.db || !req.userId || !questions?.length) return
  const seenAt = new Date().toISOString()
  const rows = questions
    .map((q) => q.id)
    .filter((id): id is string => !!id)
    .map((question_id) => ({ user_id: req.userId!, question_id, seen_at: seenAt }))
  if (!rows.length) return

  const { error } = await req.db
    .from('seen_questions')
    .upsert(rows, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
  if (error) console.error('[seen] record failed', error.code, error.message)
}
