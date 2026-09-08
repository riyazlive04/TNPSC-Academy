import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Which paid plans the superadmin is currently SELLING (Payments tab). Gates
 * every monetisation surface: the purchase cards (PremiumCard / VettriCard /
 * RankBoosterCard), the promo banners they carry, the landing pricing grid and
 * the forced-upsell paywall. The same flags are enforced server-side in
 * POST /api/payments/order, so a withdrawn plan is genuinely off sale rather
 * than merely hidden.
 *
 * Distinct from useVettriEnabled / useRankBoosterEnabled, which answer a
 * different question — whether that product AREA (nav tab, Test Arena tile)
 * exists for people who already own it. A plan can be live for its buyers while
 * no longer being offered to anyone new.
 *
 * One fetch per session shared by every caller (the cards mount several at a
 * time, and each hook keeping its own request would multiply the same call).
 * Everything reads FALSE until the check resolves: a plan that is meant to be
 * hidden must never flash on screen first, and the cards are already gated
 * behind their own async entitlement stores, so one more is no new delay.
 */
export interface PlanSales {
  /** Whether the flags have been fetched. False = still assuming "not selling". */
  ready: boolean
  /** Master switch — false forces every plan below to false. */
  payments: boolean
  premium: boolean
  vettri: boolean
  rankBooster: boolean
  mockPack: boolean
}

/** The closed state, used until the fetch resolves and if it fails. */
const NONE: PlanSales = {
  ready: false,
  payments: false,
  premium: false,
  vettri: false,
  rankBooster: false,
  mockPack: false,
}

let cache: PlanSales | null = null
let inflight: Promise<PlanSales> | null = null

export function usePlanSales(): PlanSales {
  const [sales, setSales] = useState<PlanSales>(cache ?? NONE)

  useEffect(() => {
    if (cache !== null) {
      setSales(cache)
      return
    }
    let cancelled = false
    inflight =
      inflight ??
      api
        .appSettings()
        .then((s) => {
          // The master switch vetoes each plan here, once, so no caller has to
          // remember to check both.
          const master = Boolean(s.payments_enabled)
          cache = {
            ready: true,
            payments: master,
            premium: master && Boolean(s.premium_sale_enabled),
            vettri: master && Boolean(s.vettri_sale_enabled),
            rankBooster: master && Boolean(s.rank_booster_sale_enabled),
            mockPack: master && Boolean(s.mock_pack_sale_enabled),
          }
          return cache
        })
        .catch(() => {
          // Don't poison the shared cache on a transient failure — that would
          // hide every plan for the rest of the session with no way back.
          // Clear `inflight` so the next mount retries.
          inflight = null
          return NONE
        })
    inflight.then((v) => !cancelled && setSales(v))
    return () => {
      cancelled = true
    }
  }, [])

  return sales
}

/**
 * Drop the cached flags so the next mount refetches. Called by the superadmin
 * Payments tab after a toggle, so the console operator sees their own change
 * take effect without a reload. Other sessions pick it up on their next load.
 */
export function invalidatePlanSales(): void {
  cache = null
  inflight = null
}
