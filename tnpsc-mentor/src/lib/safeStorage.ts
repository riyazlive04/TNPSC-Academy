import type { StateStorage } from 'zustand/middleware'

/**
 * A localStorage adapter for zustand `persist` that NEVER throws on write.
 *
 * The quiz stores persist their full question set so a refresh can resume an
 * in-progress test (~190 KB for a 100-question group mock). A plain
 * `localStorage.setItem` throws `QuotaExceededError` when the origin's storage
 * is full - which surfaces as an uncaught error mid-test and trips the app's
 * error boundary ("Something went wrong"). It bites hardest in dev, where every
 * Vite app on the default `http://localhost:5173` origin shares one 5 MB bucket.
 *
 * On overflow we evict the OTHER quiz-session blob (only one test runs at a time)
 * and retry once. If it still won't fit we drop the write silently: the in-memory
 * store keeps working and the live test is unaffected - only resume-after-refresh
 * is lost for this session. Crashing the running test is never the right trade.
 */

// The large, transient session blobs we may evict to make room. Keep in sync
// with the `name` of quizStore / mockQuizStore.
const EVICTABLE_KEYS = ['tnpsc-mentor-quiz', 'tnpsc-mentor-mock-quiz']

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },

  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
      return
    } catch {
      /* fall through to eviction + retry */
    }
    // Free space from the other (now-stale) quiz session, then retry once.
    for (const key of EVICTABLE_KEYS) {
      if (key === name) continue
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(name, value)
    } catch {
      // Still won't fit (storage full of unrelated data, or unavailable). Give
      // up rather than crash; resume-after-refresh just won't be available.
      // eslint-disable-next-line no-console
      console.warn(`[TNPSC Mentor] Could not persist "${name}" - storage full; resume disabled for this session.`)
    }
  },

  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}
