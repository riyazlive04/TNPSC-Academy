// ─── Background polling ──────────────────────────────────────────────────────
// The header's bell and message badge have no websocket behind them, so they ask
// the API on a timer. Two things make that cheap enough to be worth doing:
//
//  1. A backgrounded tab polls nothing. A phone browser left open on the
//     dashboard overnight used to keep asking every minute — hundreds of
//     requests, every one of them reading rows out of Postgres, to update a
//     badge nobody was looking at.
//  2. Coming back to the tab refreshes immediately if the interval has already
//     elapsed, so the badge is current the moment it's visible again — which is
//     the only moment it matters.

/** Poll `fn` every `intervalMs` while the tab is visible. Returns a stop fn. */
export function startPolling(fn: () => void, intervalMs: number): () => void {
  let last = 0

  const run = () => {
    last = Date.now()
    fn()
  }

  run()

  const timer = setInterval(() => {
    if (document.hidden) return
    run()
  }, intervalMs)

  // A tab that comes back after a long sleep is stale by definition — catch it
  // up at once instead of waiting out the rest of the interval.
  const onVisible = () => {
    if (!document.hidden && Date.now() - last >= intervalMs) run()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/** How often the header badges refresh. Notifications are authored by hand a few
 *  times a week — a minute's latency on the badge was never worth the traffic. */
export const BADGE_POLL_MS = 5 * 60_000
