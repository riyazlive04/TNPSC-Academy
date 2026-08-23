// ─── Error state ─────────────────────────────────────────────────────────────
// One reusable "this failed to load" block, in place of the AlertTriangle +
// py-16 + retry-button JSX that had been copy-pasted (with small drifts) across
// a dozen pages. Distinguishes the three ways a data fetch actually fails so
// the message tells the user something they can act on:
//   - network: the device has no usable connection right now
//   - server:  the request reached the API but it answered with a 5xx
//   - generic: anything else (a 4xx, a parse failure, an unknown throw)
//
// Two layouts: inline (default) drops into a content area that still has its
// header/chrome around it; fullScreen owns the whole viewport, for a page whose
// entire content is the one failed fetch. Both are theme-aware and bilingual.

import { useEffect, useState } from 'react'
import { WifiOff, ServerCrash, AlertTriangle, RotateCw } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { ApiError } from '../../lib/api'
import { reportClientError } from '../../lib/reportClientError'

export type ErrorKind = 'network' | 'server' | 'generic'

/**
 * Best-effort classification of a caught fetch/API error. Offline is checked
 * live (not just inferred from the error) because a request can fail for
 * network reasons even when `err` is a generic TypeError with no detail.
 */
export function classifyError(err: unknown): ErrorKind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network'
  // fetch() rejects with a bare TypeError ("Failed to fetch" / "Load failed")
  // when the request never reached a server - offline, DNS failure, a dropped
  // connection. The browser gives no finer-grained reason than that.
  if (err instanceof TypeError) return 'network'
  if (err instanceof ApiError && err.status >= 500) return 'server'
  return 'generic'
}

const ICON: Record<ErrorKind, typeof WifiOff> = {
  network: WifiOff,
  server: ServerCrash,
  generic: AlertTriangle,
}

const TILE_CLASS: Record<ErrorKind, string> = {
  network: 'bg-tint-blue text-sky',
  server: 'bg-tint-coral text-error',
  generic: 'bg-tint-coral text-error',
}

function useLiveErrorKind(error: unknown, kind?: ErrorKind): ErrorKind {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false
  )
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (offline) return 'network'
  return kind ?? classifyError(error)
}

interface Props {
  /** The caught error, used to auto-classify when `kind` isn't given. */
  error?: unknown
  /** Force a specific variant instead of classifying `error`. */
  kind?: ErrorKind
  /** Shown when retrying is possible (re-run the same fetch). */
  onRetry?: () => void
  /** Own the whole viewport (a page whose entire content failed) instead of
   *  sitting inline inside an existing header/layout. */
  fullScreen?: boolean
  className?: string
}

export default function ErrorState({ error, kind, onRetry, fullScreen, className = '' }: Props) {
  const { t } = useT()
  const resolved = useLiveErrorKind(error, kind)
  const Icon = ICON[resolved]

  const copy = {
    network: { title: t('errorNetworkTitle'), message: t('errorNetworkMessage') },
    server: { title: t('errorServerTitle'), message: t('errorServerMessage') },
    generic: { title: t('errorGenericTitle'), message: t('couldNotLoad') },
  }[resolved]

  // Tell the team over Telegram — but only for a real server/generic failure,
  // never 'network' (the user's own dropped connection, not ours to act on).
  // Depends on `error` so a retry that fails again reports the new instance.
  useEffect(() => {
    if (resolved === 'network') return
    const message =
      error instanceof ApiError
        ? error.rawMessage
        : error instanceof Error
          ? error.message
          : String(error ?? 'unknown error')
    reportClientError({
      kind: resolved,
      path: window.location.pathname,
      message,
      status: error instanceof ApiError ? error.status : undefined,
    })
  }, [resolved, error])

  if (fullScreen) {
    return (
      <div
        className={`flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 py-10 text-center ${className}`}
      >
        <span className={`grid h-16 w-16 place-items-center rounded-hero ${TILE_CLASS[resolved]}`}>
          <Icon size={30} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{copy.title}</h1>
          <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-muted">
            {copy.message}
          </p>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="btn-brand px-6 py-3 text-sm">
            <RotateCw size={16} /> {t('retry')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-3 py-16 text-center ${className}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-tile ${TILE_CLASS[resolved]}`}>
        <Icon size={26} />
      </span>
      <p className="font-heading text-sm font-semibold text-ink">{copy.title}</p>
      <p className="max-w-xs font-body text-sm text-muted">{copy.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost btn-sm mt-1">
          <RotateCw size={14} /> {t('retry')}
        </button>
      )}
    </div>
  )
}
