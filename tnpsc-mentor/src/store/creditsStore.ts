import { create } from 'zustand'
import { api } from '../lib/api'

/**
 * Free-tier credit balance. Free users spend 1 credit per question (a test costs
 * its question count); paid/staff are `unlimited` and the meter is hidden for
 * them. `refresh` also performs the daily check-in (grants +10 once per IST day)
 * and is called once on app load.
 */
interface CreditsState {
  balance: number
  unlimited: boolean
  loaded: boolean
  /** App-load entry point: daily check-in (grants +10 if due) + balance. */
  refresh: () => Promise<void>
  /** Re-read the balance only (e.g. after a test start spends credits). */
  reload: () => Promise<void>
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  unlimited: false,
  loaded: false,
  refresh: async () => {
    try {
      const r = await api.credits.checkin()
      set({ balance: r.balance, unlimited: r.unlimited, loaded: true })
    } catch {
      try {
        const r = await api.credits.balance()
        set({ balance: r.balance, unlimited: r.unlimited, loaded: true })
      } catch {
        set({ loaded: true })
      }
    }
  },
  reload: async () => {
    try {
      const r = await api.credits.balance()
      set({ balance: r.balance, unlimited: r.unlimited, loaded: true })
    } catch {
      /* keep last-known balance */
    }
  },
}))
