import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../supabase.js'

// ─── Credit system helpers ───────────────────────────────────────────────────
// Free users spend credits to take tests; premium/Vettri/staff are unlimited and
// never touch this. Balance lives on profiles.credits; spend/grant go through the
// atomic SECURITY DEFINER RPCs (supabase/credits.sql) so a client can't forge it.

/** Credits a single test costs (flat, regardless of question count). */
export const TEST_CREDIT_COST = 10
/** Credits granted once per IST day the user logs in. */
export const DAILY_CREDIT_GRANT = 10
/** A free user may take at most this many mock exams total, ever. */
export const FREE_MOCK_LIMIT = 1

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
 * For a NON-unlimited caller, returns the shortfall info when they can't afford a
 * test, or null when they can. Callers turn a non-null result into a 402.
 */
export async function insufficientCredits(
  userId: string
): Promise<{ balance: number; cost: number } | null> {
  const balance = await creditBalance(userId)
  return balance < TEST_CREDIT_COST ? { balance, cost: TEST_CREDIT_COST } : null
}

/**
 * Spend one test's worth of credits (atomic RPC on the user-scoped client).
 * Returns the new balance, or -1 when the balance was insufficient (nothing
 * spent).
 */
export async function spendTestCredit(db: SupabaseClient, reason: string): Promise<number> {
  const { data, error } = await db.rpc('spend_credits', {
    p_amount: TEST_CREDIT_COST,
    p_reason: reason,
  })
  if (error) throw error
  return Number(data ?? -1)
}

/**
 * Charge a free learner the flat test fee at test START (atomic). Returns null on
 * success, or a ready-to-send 402 body when the balance can't cover it (nothing
 * spent). We charge on start — not submit — so the fee can't be dodged by a forged
 * submit payload, and so each start is a real reservation: opening several tests
 * before finishing can't be graded off a single balance. Callers should invoke it
 * only once a real (non-empty) test is being delivered.
 */
export async function chargeTestStart(
  db: SupabaseClient,
  userId: string,
  category: string
): Promise<{ error: 'insufficient_credits'; balance: number; cost: number } | null> {
  const bal = await spendTestCredit(db, `test:${category}`)
  if (bal >= 0) return null
  const balance = await creditBalance(userId).catch(() => 0)
  return { error: 'insufficient_credits', balance, cost: TEST_CREDIT_COST }
}

/** Grant the daily login bonus (once per IST day). Returns { granted, balance }. */
export async function grantDaily(db: SupabaseClient): Promise<{ granted: boolean; balance: number }> {
  const { data, error } = await db.rpc('grant_daily_credit', { p_amount: DAILY_CREDIT_GRANT })
  if (error) throw error
  const r = (data ?? {}) as { granted?: boolean; balance?: number }
  return { granted: !!r.granted, balance: Number(r.balance ?? 0) }
}
