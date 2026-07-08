import { create } from 'zustand'

// ─── Forced-upsell overlay state ─────────────────────────────────────────────
// One global modal (components/UI/UpsellModal, mounted in App) that pushes a
// free learner to buy when a paywall actually blocks them:
//   'credits' — a test start was (or would be) refused for lack of credits.
//   'premium' — a Premium-ONLY feature (paid full mock exams); Vettri doesn't
//               unlock it, so only the Premium card is pitched.
//   'bundle'  — unlocks with ANY paid plan (Test Marathon, Vettri arena,
//               unlimited PYQ/CA); both cards are pitched, Vettri first.
// Same store+imperative-helper pattern as toastStore, so api/error paths can
// open it without React context.

export type UpsellVariant = 'credits' | 'premium' | 'bundle'

interface UpsellState {
  open: boolean
  variant: UpsellVariant
  /** 'credits' variant: what the blocked test would have cost (null = unknown). */
  cost: number | null
  show: (variant: UpsellVariant, opts?: { cost?: number }) => void
  close: () => void
}

export const useUpsellStore = create<UpsellState>((set) => ({
  open: false,
  variant: 'credits',
  cost: null,
  show: (variant, opts) => set({ open: true, variant, cost: opts?.cost ?? null }),
  close: () => set({ open: false }),
}))

/** Imperative helpers for non-component code (fetch error handlers etc.). */
export const upsell = {
  credits: (cost?: number) => useUpsellStore.getState().show('credits', { cost }),
  premium: () => useUpsellStore.getState().show('premium'),
  bundle: () => useUpsellStore.getState().show('bundle'),
}
