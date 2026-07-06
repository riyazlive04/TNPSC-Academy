import { create } from 'zustand'
import { api, isApiConfigured } from '../lib/api'

/**
 * Full bundle entitlement (premium + vettri), derived server-side from the ledger.
 * Shared so the Vettri upsell card hides everywhere the moment a payment succeeds,
 * with no reload. `unlimited` (premium || vettri) is the flag the Vettri bank and
 * the PYQ/CA lock UI care about — premium is a superset of vettri.
 */
interface EntitlementsState {
  premium: boolean
  vettri: boolean
  /** premium || vettri. */
  unlimited: boolean
  premiumUntil: string | null
  vettriUntil: string | null
  loaded: boolean // true once we've checked at least once
  refresh: () => Promise<void>
  /** Optimistically mark vettri (called right after a verified Vettri payment). */
  markVettri: () => void
  /** Optimistically mark premium (called right after a verified Premium payment).
   *  Premium is a superset, so this also flips `unlimited`. */
  markPremium: () => void
}

export const useEntitlementsStore = create<EntitlementsState>((set) => ({
  premium: false,
  vettri: false,
  unlimited: false,
  premiumUntil: null,
  vettriUntil: null,
  loaded: false,
  refresh: async () => {
    if (!isApiConfigured) {
      set({ loaded: true })
      return
    }
    try {
      const e = await api.payments.entitlements()
      set({
        premium: e.premium,
        vettri: e.vettri,
        unlimited: e.unlimited,
        premiumUntil: e.premiumUntil,
        vettriUntil: e.vettriUntil,
        loaded: true,
      })
    } catch {
      // 503 (payments off) / 401 / network → treat as no entitlement, show the card.
      set({ loaded: true })
    }
  },
  markVettri: () => set({ vettri: true, unlimited: true }),
  markPremium: () => set({ premium: true, unlimited: true }),
}))
