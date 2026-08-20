import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PREMIUM_VALIDITY_MS,
  VETTRI_VALIDITY_MS,
  VETTRI_MONTH_VALIDITY_MS,
  RANK_BOOSTER_VALIDITY_MS,
  MOCK_PACK_VALIDITY_MS,
} from '../pricing.js'

export interface PremiumEntitlement {
  premium: boolean
  /** ISO expiry of the active premium window, or null when not premium. */
  until: string | null
}

/**
 * Full bundle entitlement resolved from the ledger in ONE query. `premium` is the
 * ₹1,699 plan (superset); `vettri` is the ₹999 Vettri Nichayam bundle. `unlimited`
 * is the derived flag the PYQ/CA gate and the vettri-exam gate check — either paid
 * plan grants it, since premium is a superset of vettri.
 */
export interface BundleEntitlement {
  premium: boolean
  premiumUntil: string | null
  vettri: boolean
  vettriUntil: string | null
  /** premium || vettri — unlocks the vettri bank (Test Marathon). Deliberately
   *  does NOT include rankBooster — see creditsUnlimited for the credit gate. */
  unlimited: boolean
  /** The standalone ₹1,249/90-day "Group II/IIA Rank Booster" plan. */
  rankBooster: boolean
  rankBoosterUntil: string | null
  /** premium || rankBooster — deliberately does NOT include vettri: Rank
   *  Booster is its own purchase, only Premium (the superset plan) includes
   *  it for free. Unlocks the Rank Booster test series. */
  rankBoosterUnlocked: boolean
  /** unlimited || rankBooster — the credit-gate bypass ("never spends credits,
   *  unlimited PYQ/CA/Subject-practice"). Rank Booster grants this bonus for
   *  its own 90-day window WITHOUT unlocking the Vettri Test Marathon bank
   *  (that stays on `unlimited` alone) — the two gates are intentionally
   *  different unions of the same three plans. */
  creditsUnlimited: boolean
  /** The standalone ₹399/80-day "Group 1 Mock Test Pack". Deliberately NOT
   *  folded into `creditsUnlimited` — it grants a bigger DAILY credit
   *  allowance (see credits.ts DAILY_CREDIT_GRANT_BOOSTED), not unlimited
   *  credits, so it stays its own field. */
  mockPack: boolean
  mockPackUntil: string | null
}

/**
 * Premium entitlement derived from the payment ledger: a paid `premium_annual`
 * order within the validity window (see pricing.ts). This is the single source
 * of truth — used by GET /api/payments/premium and any feature gate that needs
 * to know whether a caller is premium (e.g. the free PDF-download cap). Throws
 * on a DB read error so callers can decide how to fail.
 */
export async function premiumEntitlement(db: SupabaseClient): Promise<PremiumEntitlement> {
  const since = new Date(Date.now() - PREMIUM_VALIDITY_MS).toISOString()
  const { data, error } = await db
    .from('payments')
    .select('created_at, notes')
    .eq('status', 'paid')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw error

  const latest = (data ?? []).find(
    (r) => (r.notes as { plan?: string } | null)?.plan === 'premium_annual'
  )
  if (!latest) return { premium: false, until: null }
  const until = new Date(new Date(latest.created_at).getTime() + PREMIUM_VALIDITY_MS).toISOString()
  return { premium: true, until }
}

/**
 * Resolve premium AND vettri entitlement in a single ledger read. Premium is a
 * 180-day window and Vettri a 60-day one (see pricing.ts) — they already
 * diverge, so `window` takes the widest of all three plans defensively, then
 * bounds each plan against its own validity below. Throws on a DB read error
 * so callers can fail closed.
 */
export async function bundleAccess(db: SupabaseClient): Promise<BundleEntitlement> {
  const window = Math.max(
    PREMIUM_VALIDITY_MS,
    VETTRI_VALIDITY_MS,
    RANK_BOOSTER_VALIDITY_MS,
    MOCK_PACK_VALIDITY_MS
  )
  const since = new Date(Date.now() - window).toISOString()
  const { data, error } = await db
    .from('payments')
    .select('created_at, notes')
    .eq('status', 'paid')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as { created_at: string; notes: { plan?: string } | null }[]
  const latestFor = (plan: string) => rows.find((r) => r.notes?.plan === plan)
  const untilFor = (row: { created_at: string } | undefined, validityMs: number) =>
    row ? new Date(new Date(row.created_at).getTime() + validityMs).toISOString() : null

  // A payment older than its own plan's validity has lapsed even though it fell
  // inside the (wider) query window — guard each plan against its own bound.
  const now = Date.now()
  const premiumRow = latestFor('premium_annual')
  const premiumActive = !!premiumRow && now - new Date(premiumRow.created_at).getTime() < PREMIUM_VALIDITY_MS

  // Vettri access comes from EITHER the full ₹899 plan (90-day) OR the monthly
  // ₹499 plan (30-day). Take whichever expiry is later so a user who bought both
  // (or renewed monthly) keeps the longest access. Each plan's latest paid order
  // is checked against its own window.
  const endOf = (row: { created_at: string } | undefined, validityMs: number): number => {
    if (!row) return 0
    const end = new Date(row.created_at).getTime() + validityMs
    return end > now ? end : 0
  }
  const vettriUntilMs = Math.max(
    endOf(latestFor('vettri_nichayam'), VETTRI_VALIDITY_MS),
    endOf(latestFor('vettri_month'), VETTRI_MONTH_VALIDITY_MS)
  )
  const vettriActive = vettriUntilMs > now

  // Rank Booster: single ₹1,249/90-day plan, same shape as premium's own check.
  const rankBoosterRow = latestFor('rank_booster_g2')
  const rankBoosterActive =
    !!rankBoosterRow && now - new Date(rankBoosterRow.created_at).getTime() < RANK_BOOSTER_VALIDITY_MS

  // Mock Pack: single ₹399/80-day plan, same shape again.
  const mockPackRow = latestFor('group1_mock_pack')
  const mockPackActive =
    !!mockPackRow && now - new Date(mockPackRow.created_at).getTime() < MOCK_PACK_VALIDITY_MS

  return {
    premium: premiumActive,
    premiumUntil: premiumActive ? untilFor(premiumRow, PREMIUM_VALIDITY_MS) : null,
    vettri: vettriActive,
    vettriUntil: vettriActive ? new Date(vettriUntilMs).toISOString() : null,
    unlimited: premiumActive || vettriActive,
    rankBooster: rankBoosterActive,
    rankBoosterUntil: rankBoosterActive ? untilFor(rankBoosterRow, RANK_BOOSTER_VALIDITY_MS) : null,
    rankBoosterUnlocked: premiumActive || rankBoosterActive,
    creditsUnlimited: premiumActive || vettriActive || rankBoosterActive,
    mockPack: mockPackActive,
    mockPackUntil: mockPackActive ? untilFor(mockPackRow, MOCK_PACK_VALIDITY_MS) : null,
  }
}
