import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../supabase.js'

// ─── Credit system helpers ───────────────────────────────────────────────────
// Free users spend credits to take tests; premium/Vettri/staff are unlimited and
// never touch this. Balance lives on profiles.credits; spend/grant go through the
// atomic SECURITY DEFINER RPCs (supabase/credits.sql) so a client can't forge it.

/** Credits a single question costs — a test costs (question count × this). */
export const CREDIT_PER_QUESTION = 1
/** Credits granted once per IST day the user logs in — starting the day AFTER
 * signup (day one is the 50 signup credits only; profiles are born with
 * last_daily_grant = creation day, so the same-day grant no-ops). */
export const DAILY_CREDIT_GRANT = 10
/** A free user may take at most this many mock exams total, ever. */
export const FREE_MOCK_LIMIT = 1
/** One-time credits awarded when the user's FIRST completed test is graded. */
export const FIRST_TEST_BONUS = 25

/** What a test with this many questions costs. Floors at 1 credit. */
export function testCost(questionCount: number): number {
  return Math.max(1, Math.trunc(questionCount)) * CREDIT_PER_QUESTION
}

/**
 * Current balance for a user. Service-role read so it doesn't depend on the
 * caller's profiles-SELECT RLS (same pattern as the PDF-quota read).
 */
export async function creditBalance(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()
  if (error) throw error
  return Number(data?.credits ?? 0)
}

/**
 * Spend one test's worth of credits (atomic RPC on the user-scoped client).
 * Returns the new balance, or -1 when the balance was insufficient (nothing
 * spent).
 */
export async function spendTestCredit(
  db: SupabaseClient,
  reason: string,
  amount: number
): Promise<number> {
  const { data, error } = await db.rpc('spend_credits', {
    p_amount: amount,
    p_reason: reason,
  })
  if (error) throw error
  return Number(data ?? -1)
}

/**
 * Charge a free learner the per-question test fee at test START (atomic):
 * 1 credit per question actually delivered. Returns null on success, or a
 * ready-to-send 402 body when the balance can't cover it (nothing spent). We
 * charge on start — not submit — so the fee can't be dodged by a forged submit
 * payload, and so each start is a real reservation: opening several tests
 * before finishing can't be graded off a single balance. Callers should invoke
 * it only once a real (non-empty) test is being delivered, passing the size of
 * the paper they are about to send.
 */
export async function chargeTestStart(
  db: SupabaseClient,
  userId: string,
  category: string,
  questionCount: number
): Promise<{ error: 'insufficient_credits'; balance: number; cost: number } | null> {
  const cost = testCost(questionCount)
  const bal = await spendTestCredit(db, `test:${category}`, cost)
  if (bal >= 0) return null
  const balance = await creditBalance(userId).catch(() => 0)
  return { error: 'insufficient_credits', balance, cost }
}

/** Grant the daily login bonus (once per IST day). Returns { granted, balance }. */
export async function grantDaily(db: SupabaseClient): Promise<{ granted: boolean; balance: number }> {
  const { data, error } = await db.rpc('grant_daily_credit', { p_amount: DAILY_CREDIT_GRANT })
  if (error) throw error
  const r = (data ?? {}) as { granted?: boolean; balance?: number }
  return { granted: !!r.granted, balance: Number(r.balance ?? 0) }
}

/**
 * Grant the one-time first-test bonus (atomic RPC; no-ops unless the caller has
 * EXACTLY one completed test and no prior bonus row). Called after every graded
 * submit — the RPC itself decides whether this was the first test.
 */
export async function grantFirstTestBonus(
  db: SupabaseClient
): Promise<{ granted: boolean; balance: number }> {
  const { data, error } = await db.rpc('grant_first_test_bonus', { p_amount: FIRST_TEST_BONUS })
  if (error) throw error
  const r = (data ?? {}) as { granted?: boolean; balance?: number }
  return { granted: !!r.granted, balance: Number(r.balance ?? 0) }
}
