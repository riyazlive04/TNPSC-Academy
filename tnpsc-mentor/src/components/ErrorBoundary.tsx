import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw, Home, Copy, Check, WifiOff, Sparkles } from 'lucide-react'
import { classifyError } from './UI/ErrorState'
import { reportClientError } from '../lib/reportClientError'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string | null
}

/**
 * Top-level error boundary so a render-time throw shows a recoverable, on-brand
 * screen (with the exact error surfaced to the user) instead of a blank page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[TNPSC Mentors] Unhandled UI error:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen error={this.state.error} componentStack={this.state.componentStack} />
      )
    }
    return this.props.children
  }
}

/**
 * A route-chunk `import()` rejecting - stale asset hashes after a redeploy, or
 * no connection when the chunk was never cached - throws during render exactly
 * like a real bug and lands here too. It deserves its own copy: "reload for the
 * latest version" reads very differently from "something broke".
 */
function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|importing a module script failed|chunkloaderror/i.test(
    `${error.name} ${error.message}`
  )
}

/**
 * The recoverable error screen. Shown by ErrorBoundary on a crash; standalone so
 * it can be reused/previewed. A chunk-load or offline failure gets its own
 * actionable copy; anything else surfaces the real error message directly so
 * the user (and support) can see exactly what failed, with a one-tap copy.
 */
export function ErrorScreen({
  error,
  componentStack,
}: {
  error: Error
  componentStack?: string | null
}) {
  const [copied, setCopied] = useState(false)

  const kind = isChunkLoadError(error) ? 'chunk' : classifyError(error) === 'network' ? 'network' : 'generic'

  // A genuine unhandled crash - the highest-value 'generic' case to page on.
  // Chunk-load (a stale deploy, not a bug) and network (the user's own dropped
  // connection) are deliberately never reported.
  useEffect(() => {
    if (kind !== 'generic') return
    reportClientError({
      kind: 'generic',
      path: window.location.pathname,
      message: error.name ? `${error.name}: ${error.message}` : error.message,
      componentStack,
    })
  }, [error, kind])

  const details = [error.name ? `${error.name}: ${error.message}` : error.message, componentStack]
    .filter(Boolean)
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable - no-op */
    }
  }

  if (kind === 'chunk') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 py-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-violet">
          <Sparkles size={30} className="text-primary" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            New version available
          </h1>
          <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-muted">
            TNPSC Mentors was updated since this page loaded. Reload to get the latest version.
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-brand px-6 py-3 text-sm">
          <RotateCw size={16} /> Reload app
        </button>
      </div>
    )
  }

  if (kind === 'network') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 py-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-blue">
          <WifiOff size={30} className="text-sky" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            No internet connection
          </h1>
          <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-muted">
            Check your Wi-Fi or mobile data, then try again.
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-brand px-6 py-3 text-sm">
          <RotateCw size={16} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-coral">
        <AlertTriangle size={30} className="text-wrong" />
      </span>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-muted">
          An unexpected error interrupted the app. Your progress is saved where possible. Here's
          exactly what happened:
        </p>
      </div>

      {/* The actual issue, shown directly. */}
      <div className="w-full max-w-md rounded-card border border-line bg-card p-4 text-left">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-heading text-2xs font-bold uppercase tracking-wide text-muted">
            Error details
          </span>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 font-body text-xs font-medium text-accent transition-opacity hover:opacity-80"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-wrong">
          {error.message || 'Unknown error'}
        </pre>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <button
          onClick={() => window.location.reload()}
          className="btn-brand flex-1 px-6 py-3 text-sm"
        >
          <RotateCw size={16} /> Reload app
        </button>
        <button
          onClick={() => window.location.assign('/test-arena')}
          className="btn-ghost flex-1 px-6 py-3 text-sm"
        >
          <Home size={16} /> Go to Home
        </button>
      </div>
    </div>
  )
}
