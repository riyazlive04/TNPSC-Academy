// ─── Store-localized price for a paid plan ──────────────────────────────────
// On the web the rupee constants in the card components are the truth. Inside the
// native apps they are NOT: the amount charged is whatever App Store Connect /
// Play Console has for the user's storefront, which drifts from the website price
// with local tax, currency and each store's own price points.
//
// Showing the website price next to a store checkout that charges something else
// is both a bad surprise and an Apple review finding, so on native the paywall
// renders this value instead. Falls back to null — meaning "use the web price" —
// whenever the store can't be reached, so the paywall never blocks on it.

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { storePrices } from '../lib/iap'
import { catalogForPlan, type PlanId } from '../lib/iapCatalog'

export interface UseStorePriceResult {
  /** e.g. "₹1,699.00" — already localized+formatted by the store. */
  priceString: string | null
  /** True while the first lookup is in flight (native only). */
  loading: boolean
}

export function useStorePrice(plan: PlanId): UseStorePriceResult {
  const isNative = Capacitor.isNativePlatform()
  const [priceString, setPriceString] = useState<string | null>(null)
  const [loading, setLoading] = useState(isNative)

  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    void (async () => {
      const prices = await storePrices()
      if (cancelled) return
      const entry = catalogForPlan(plan)
      setPriceString(entry ? (prices.get(entry.productId)?.priceString ?? null) : null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isNative, plan])

  return { priceString, loading }
}
