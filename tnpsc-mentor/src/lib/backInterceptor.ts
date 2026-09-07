// ─── Back interceptor ───────────────────────────────────────────────────────
// A screen with internal steps can claim the back gesture while it still has
// somewhere to unwind to. The intro slides use it so Android's hardware back
// goes to the PREVIOUS SLIDE instead of dropping the whole walkthrough - the
// behaviour every native onboarding has, and the one users reach for.
//
// One interceptor at a time (only one such screen is ever on top), registered
// by the screen and cleared on unmount. Returning false means "not mine" and
// back falls through to BackButtonGuard's normal handling.

type Interceptor = () => boolean

let current: Interceptor | null = null

/** Register the interceptor for the mounted screen. Returns an unregister fn
 *  (safe to call after another screen has taken over - it only clears its own). */
export function setBackInterceptor(fn: Interceptor): () => void {
  current = fn
  return () => {
    if (current === fn) current = null
  }
}

/** Let the active screen consume this back press. True = handled, stop here. */
export function runBackInterceptor(): boolean {
  return current ? current() : false
}
