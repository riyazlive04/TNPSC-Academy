// ─── Client-error reporting ─────────────────────────────────────────────────
// Fire-and-forget beacon: whenever ErrorState or ErrorBoundary shows a real
// person a 'server' or 'generic' failure, tell the team over the same Telegram
// pipe the security detectors use (server/src/lib/securityAlerts.ts) instead of
// relying on someone noticing a support message. 'network' is never reported —
// a dropped connection is the user's own, not ours to act on.
//
// Deliberately best-effort: this must never throw into the error screen it's
// reporting about, and never blocks rendering (it's called from an effect,
// after paint).

import { useAuthStore } from '../store/authStore'
import type { ErrorKind } from '../components/UI/ErrorState'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function reportClientError(opts: {
  kind: ErrorKind
  path: string
  message: string
  status?: number
}): void {
  if (opts.kind === 'network') return
  const userId = useAuthStore.getState().user?.id ?? null
  void fetch(`${API_URL}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...opts, userId }),
  }).catch(() => {
    /* best-effort — nothing to do if the report itself can't be delivered */
  })
}
