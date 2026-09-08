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
  /** Question categories this caller draws free WITHOUT being unlimited — the
   *  ₹399 Mock Pack's Group 1 PYQs. Supplied by the server (which owns the
   *  rule) so the pre-test credit prompt can't ask for a fee the quiz route
   *  won't charge. Use `chargesCredits()` rather than reading this directly. */
  freeCategories: string[]
  loaded: boolean
  /** App-load entry point: daily check-in (grants +10 if due) + balance. */
  refresh: () => Promise<void>
  /** Re-read the balance only (e.g. after a test start spends credits). */
  reload: () => Promise<void>
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  unlimited: false,
  freeCategories: [],
  loaded: false,
  refresh: async () => {
    try {
      const r = await api.credits.checkin()
      set({ balance: r.balance, unlimited: r.unlimited, freeCategories: r.freeCategories ?? [], loaded: true })
    } catch {
      try {
        const r = await api.credits.balance()
        set({ balance: r.balance, unlimited: r.unlimited, freeCategories: r.freeCategories ?? [], loaded: true })
      } catch {
        set({ loaded: true })
      }
    }
  },
  reload: async () => {
    try {
      const r = await api.credits.balance()
      set({ balance: r.balance, unlimited: r.unlimited, freeCategories: r.freeCategories ?? [], loaded: true })
    } catch {
      /* keep last-known balance */
    }
  },
}))

/**
 * Whether a test in this category actually costs the current user credits.
 *
 * Answers the question the UI needs before showing a "this costs N credits"
 * prompt, keeping the two conditions (globally unlimited, or free for this one
 * bank) together instead of at every call site. Subscribes to the store rather
 * than reading a snapshot, so a screen mounted before the balance loads still
 * settles on the right answer.
 */
export function useChargesCredits(category: string | undefined): boolean {
  const loaded = useCreditsStore((s) => s.loaded)
  const unlimited = useCreditsStore((s) => s.unlimited)
  const freeCategories = useCreditsStore((s) => s.freeCategories)
  if (!loaded || unlimited) return false
  return !(category && freeCategories.includes(category))
}
