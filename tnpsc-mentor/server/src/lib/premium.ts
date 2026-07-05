import type { SupabaseClient } from '@supabase/supabase-js'
import { PREMIUM_VALIDITY_MS, VETTRI_VALIDITY_MS, VETTRI_MONTH_VALIDITY_MS } from '../pricing.js'

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
  /** premium || vettri — unlocks the vettri bank + unlimited PYQ/CA. */
  unlimited: boolean
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
 * Resolve premium AND vettri entitlement in a single ledger read. Both plans use
 * a 90-day window (see pricing.ts), so one `since` bound covers both — the widest
 * of the two validities is used defensively in case they ever diverge. Throws on
 * a DB read error so callers can fail closed.
 */
export async function bundleAccess(db: SupabaseClient): Promise<BundleEntitlement> {
  const window = Math.max(PREMIUM_VALIDITY_MS, VETTRI_VALIDITY_MS)
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

  return {
    premium: premiumActive,
    premiumUntil: premiumActive ? untilFor(premiumRow, PREMIUM_VALIDITY_MS) : null,
    vettri: vettriActive,
    vettriUntil: vettriActive ? new Date(vettriUntilMs).toISOString() : null,
    unlimited: premiumActive || vettriActive,
  }
}
