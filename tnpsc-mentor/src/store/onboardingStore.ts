import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Drives the first-run guided tour, which is shown ONLY to freshly created
 * accounts (never to existing users). The signup flow "arms" the tour
 * (`pending = true`) the moment an account is created; the dashboard "consumes"
 * that flag once and opens the coach-mark overlay. `replay` re-opens it on demand
 * from the profile. Only `pending` is persisted, so it survives the redirect /
 * email-confirmation hop into the app but never re-triggers uninvited.
 */
interface OnboardingState {
  /** Set at account creation; the dashboard shows the tour once, then clears it. */
  pending: boolean
  /** Transient - whether the tour overlay is currently visible. */
  open: boolean
  /** Mark a newly created account so the tour fires on first dashboard view. */
  arm: () => void
  /** Consume the pending flag and open the tour (called by the dashboard). */
  start: () => void
  /** Re-open the tour manually (e.g. from the profile's "How it works" row). */
  replay: () => void
  /** Finish or skip - close the overlay. */
  finish: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      pending: false,
      open: false,
      arm: () => set({ pending: true }),
      start: () => set({ open: true, pending: false }),
      replay: () => set({ open: true }),
      finish: () => set({ open: false }),
    }),
    {
      name: 'tnpsc-mentor-onboarding',
      // Only the "new account" intent persists; `open` is transient UI state.
      partialize: (s) => ({ pending: s.pending }),
    }
  )
)
