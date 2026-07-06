import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Shows the dashboard's MomentumPanel (goal ring / week strip / level) once per
 * sign-in, keeping the everyday dashboard clean. Every successful interactive
 * login/signup path in the auth store arms it; the dashboard consumes it on the
 * first view where the panel actually renders. Mirrors the onboarding-tour
 * arm/consume pattern. Persisted to sessionStorage (not localStorage) so the
 * flag survives an in-flow reload but dies with the tab and can never leak into
 * another user's login.
 */
interface MomentumState {
  pending: boolean
  arm: () => void
  consume: () => void
}

export const useMomentumStore = create<MomentumState>()(
  persist(
    (set) => ({
      pending: false,
      arm: () => set({ pending: true }),
      consume: () => set({ pending: false }),
    }),
    { name: 'tnpsc-mentor-momentum', storage: createJSONStorage(() => sessionStorage) }
  )
)

/** Hook-free arm for the auth store's sign-in success paths. */
export function armMomentumPanel(): void {
  useMomentumStore.getState().arm()
}
