import type { SupabaseClient } from '@supabase/supabase-js'
import { PREMIUM_VALIDITY_MS } from '../pricing.js'

export interface PremiumEntitlement {
  premium: boolean
  /** ISO expiry of the active premium window, or null when not premium. */
  until: string | null
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
