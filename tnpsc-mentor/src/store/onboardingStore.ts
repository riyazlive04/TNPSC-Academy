import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Drives the first-run sequence, shown ONLY to freshly created accounts (never
 * to existing users). Signup "arms" BOTH phases the moment an account is
 * created; the dashboard then runs them in order:
 *
 *   1. `testPrompt` — a modal inviting the new aspirant to take the Starter
 *      Challenge FIRST. Starting the test (or skipping) consumes this flag.
 *   2. `pending`    — the guided spotlight tour. It is held back while
 *      `testPrompt` is set, so it fires when the user lands back on the
 *      dashboard after the test (or immediately after skipping it).
 *
 * `replay` re-opens the tour on demand from the profile. Only the two phase
 * flags are persisted, so the sequence survives the redirect /
 * email-confirmation hop into the app but never re-triggers uninvited.
 */
interface OnboardingState {
  /** Tour pending: set at account creation; the dashboard shows it once, then clears it. */
  pending: boolean
  /** Starter-test prompt pending: shown before the tour; cleared once answered. */
  testPrompt: boolean
  /** "Test Marathon Test 1 is FREE" promo alert: shown once after the test
   *  prompt + tour have both resolved; cleared once answered. */
  marathonAlert: boolean
  /** Transient - whether the tour overlay is currently visible. */
  open: boolean
  /** Mark a newly created account so the test prompt + tour fire on first dashboard view. */
  arm: () => void
  /** Consume the test prompt (the user started the Starter Challenge or skipped it). */
  consumeTestPrompt: () => void
  /** Consume the marathon promo alert (CTA tapped or dismissed). */
  consumeMarathonAlert: () => void
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
      testPrompt: false,
      marathonAlert: false,
      open: false,
      arm: () => set({ pending: true, testPrompt: true, marathonAlert: true }),
      consumeTestPrompt: () => set({ testPrompt: false }),
      consumeMarathonAlert: () => set({ marathonAlert: false }),
      start: () => set({ open: true, pending: false }),
      replay: () => set({ open: true }),
      finish: () => set({ open: false }),
    }),
    {
      name: 'tnpsc-mentor-onboarding',
      // Only the "new account" intent persists; `open` is transient UI state.
      partialize: (s) => ({
        pending: s.pending,
        testPrompt: s.testPrompt,
        marathonAlert: s.marathonAlert,
      }),
    }
  )
)
