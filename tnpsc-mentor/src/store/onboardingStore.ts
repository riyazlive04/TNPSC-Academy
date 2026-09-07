import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Drives the first-run sequence, shown ONLY to freshly created accounts (never
 * to existing users). Signup "arms" every phase the moment an account is
 * created; they then run in order:
 *
 *   0. `intro`      — the full-screen /welcome slides ("what's in the app"),
 *      shown on the way into the app, straight after the language screen.
 *   1. `testPrompt` — a modal inviting the new aspirant to take the Starter
 *      Challenge FIRST. Starting the test (or skipping) consumes this flag.
 *   2. `pending`    — the guided spotlight tour. It is held back while
 *      `testPrompt` is set, so it fires when the user lands back on the
 *      dashboard after the test (or immediately after skipping it).
 *
 * `replay` re-opens the tour on demand from the profile (the intro slides are
 * replayed by simply navigating to /welcome). Only the phase
 * flags are persisted, so the sequence survives the redirect /
 * email-confirmation hop into the app but never re-triggers uninvited.
 */
interface OnboardingState {
  /** Intro slides pending: the full-screen "what's in the app" walkthrough
   *  (/welcome) shown ONCE, before the app itself. Armed at signup, consumed by
   *  the last slide (or Skip). */
  intro: boolean
  /** Tour pending: set at account creation; the dashboard shows it once, then clears it. */
  pending: boolean
  /** Starter-test prompt pending: shown before the tour; cleared once answered. */
  testPrompt: boolean
  /** "Test Marathon Test 1 is FREE" promo alert: shown once after the test
   *  prompt + tour have both resolved; cleared once answered. */
  marathonAlert: boolean
  /** Transient - whether the tour overlay is currently visible. */
  open: boolean
  /** Mark a newly created account so the intro slides, test prompt + tour fire once. */
  arm: () => void
  /** Consume the intro slides (finished or skipped) - they never re-open uninvited. */
  consumeIntro: () => void
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
      intro: false,
      pending: false,
      testPrompt: false,
      marathonAlert: false,
      open: false,
      arm: () => set({ intro: true, pending: true, testPrompt: true, marathonAlert: true }),
      consumeIntro: () => set({ intro: false }),
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
        intro: s.intro,
        pending: s.pending,
        testPrompt: s.testPrompt,
        marathonAlert: s.marathonAlert,
      }),
    }
  )
)
