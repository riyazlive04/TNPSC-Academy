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
  rankBooster: boolean
  rankBoosterUntil: string | null
  /** premium || rankBooster — unlocks the Group II/IIA Rank Booster series. */
  rankBoosterUnlocked: boolean
  /** The standalone ₹399/80-day Group 1 Mock Test Pack. */
  mockPack: boolean
  mockPackUntil: string | null
  loaded: boolean // true once we've checked at least once
  refresh: () => Promise<void>
  /** Optimistically mark vettri (called right after a verified Vettri payment). */
  markVettri: () => void
  /** Optimistically mark premium (called right after a verified Premium payment).
   *  Premium is a superset, so this also flips `unlimited` and `rankBoosterUnlocked`. */
  markPremium: () => void
  /** Optimistically mark Rank Booster (called right after a verified payment). */
  markRankBooster: () => void
  /** Optimistically mark the Mock Pack (called right after a verified payment). */
  markMockPack: () => void
}

export const useEntitlementsStore = create<EntitlementsState>((set) => ({
  premium: false,
  vettri: false,
  unlimited: false,
  premiumUntil: null,
  vettriUntil: null,
  rankBooster: false,
  rankBoosterUntil: null,
  rankBoosterUnlocked: false,
  mockPack: false,
  mockPackUntil: null,
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
        rankBooster: e.rankBooster,
        rankBoosterUntil: e.rankBoosterUntil,
        rankBoosterUnlocked: e.rankBoosterUnlocked,
        mockPack: e.mockPack,
        mockPackUntil: e.mockPackUntil,
        loaded: true,
      })
    } catch {
      // 503 (payments off) / 401 / network → treat as no entitlement, show the card.
      set({ loaded: true })
    }
  },
  markVettri: () => set({ vettri: true, unlimited: true }),
  markPremium: () => set({ premium: true, unlimited: true, rankBoosterUnlocked: true }),
  markRankBooster: () => set({ rankBooster: true, rankBoosterUnlocked: true }),
  markMockPack: () => set({ mockPack: true }),
}))
