import { useAuthStore } from '../store/authStore'

// How many tests a user must finish before the app surfaces the periodic
// feedback prompt. The point is to never ask right after opening the app -
// only once the user has actually experienced a test or two.
export const TESTS_BEFORE_FEEDBACK = 2

function counterKey(userId: string | null | undefined): string | null {
  return userId ? `tnpsc:testsCompleted:${userId}` : null
}

/**
 * Per-user count of finished tests (any category). Best-effort localStorage -
 * a wrong/zero value just delays the gentle feedback prompt, nothing critical.
 */
export function getTestsCompleted(userId?: string | null): number {
  const id = userId ?? useAuthStore.getState().user?.id ?? null
  const key = counterKey(id)
  if (!key) return 0
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Record one finished test for the signed-in user (called on every submit). */
export function recordTestCompleted(): void {
  const id = useAuthStore.getState().user?.id ?? null
  const key = counterKey(id)
  if (!key) return
  try {
    localStorage.setItem(key, String(getTestsCompleted(id) + 1))
  } catch {
    /* storage disabled/full - non-critical */
  }
}
