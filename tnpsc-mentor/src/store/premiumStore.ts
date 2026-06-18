import { create } from 'zustand'
import { api, isApiConfigured } from '../lib/api'

/**
 * Premium entitlement, derived from the payment ledger server-side. Shared so
 * the upsell card (rendered on Test Arena and Profile) hides everywhere at once
 * the moment a payment succeeds, with no page reload.
 */
interface PremiumState {
  premium: boolean
  until: string | null
  loaded: boolean // true once we've checked at least once
  refresh: () => Promise<void>
  /** Optimistically mark premium (called right after a verified payment). */
  markPremium: () => void
}

export const usePremiumStore = create<PremiumState>((set) => ({
  premium: false,
  until: null,
  loaded: false,
  refresh: async () => {
    if (!isApiConfigured) {
      set({ loaded: true })
      return
    }
    try {
      const s = await api.payments.premiumStatus()
      set({ premium: s.premium, until: s.until, loaded: true })
    } catch {
      // 503 (payments off) / 401 / network → treat as "not premium", show the card.
      set({ loaded: true })
    }
  },
  markPremium: () => set({ premium: true }),
}))
