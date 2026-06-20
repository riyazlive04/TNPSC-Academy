import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { postAuthDestination } from '../../lib/authRouting'
import { useT } from '../../lib/i18n'

// Public OAuth Web Client ID (safe to ship to the browser). When unset the
// component renders nothing, so the rest of auth works without Google.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'

/** True when a Google Client ID is configured — host pages use this to hide the
 * "or" divider too, so it never appears stranded above an absent button. */
export const isGoogleConfigured = Boolean(CLIENT_ID)

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (resp: { credential: string }) => void
          }) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

// Load the Google Identity Services script exactly once, shared across mounts.
let gsiPromise: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google sign-in'))
    document.head.appendChild(s)
  })
  return gsiPromise
}

interface GoogleSignInButtonProps {
  /** Surface a sign-in failure in the host page's error banner. */
  onError: (msg: string) => void
  /** Called the moment a credential comes back, before the network round-trip. */
  onStart?: () => void
  /** Deep link the user was bounced from, forwarded to post-auth routing. */
  fromPath?: string
  /** Google's button label variant. */
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

/**
 * Renders Google's official "Sign in with Google" button. On success it exchanges
 * the returned ID token for an app session (auto-creating the account on first
 * use) and routes the user via the shared post-auth rules. Renders nothing when
 * VITE_GOOGLE_CLIENT_ID is not configured.
 */
export default function GoogleSignInButton({
  onError,
  onStart,
  fromPath,
  text = 'continue_with',
}: GoogleSignInButtonProps) {
  const navigate = useNavigate()
  const { signInWithGoogle } = useAuth()
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  // Drives a full-screen overlay while the ID token is exchanged for a session
  // and the next page loads — without it the page looks frozen ("lag") between
  // picking the Google account and the profile/onboarding screen appearing.
  const [busy, setBusy] = useState(false)

  // GIS registers its callback ONCE; keep the latest deps in a ref so that single
  // callback always sees fresh props/handlers without re-initialising the widget.
  const handleRef = useRef<(credential: string) => void>(() => {})
  handleRef.current = async (credential: string) => {
    setBusy(true)
    onStart?.()
    const { error } = await signInWithGoogle(credential)
    if (error) {
      setBusy(false)
      onError(error)
      return
    }
    // Leave the overlay up through navigation; it unmounts with this component.
    navigate(postAuthDestination(fromPath), { replace: true })
  }
  const errorRef = useRef(onError)
  errorRef.current = onError

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    let ro: ResizeObserver | undefined
    // GIS only takes a fixed pixel width — a hardcoded one overflows narrow
    // phones. Size it to the container instead (clamped to GIS's 200–400 range)
    // and re-render on resize so it stays inside the card. The width guard stops
    // the ResizeObserver from looping on the button's own height changes.
    let lastWidth = 0
    const renderButton = () => {
      const el = containerRef.current
      if (!el || !window.google) return
      const avail = Math.floor(el.clientWidth || 300)
      const width = Math.min(400, Math.max(200, avail))
      if (Math.abs(width - lastWidth) < 2) return
      lastWidth = width
      el.innerHTML = ''
      window.google.accounts.id.renderButton(el, {
        theme: 'outline',
        size: 'large',
        width,
        text,
        shape: 'pill',
        logo_alignment: 'center',
      })
    }
    loadGsi()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => handleRef.current(resp.credential),
        })
        renderButton()
        ro = new ResizeObserver(() => renderButton())
        ro.observe(containerRef.current)
      })
      .catch((e) =>
        errorRef.current(e instanceof Error ? e.message : 'Failed to load Google sign-in')
      )
    return () => {
      cancelled = true
      ro?.disconnect()
    }
    // Mount-once: deps are read via refs so the widget isn't re-created per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CLIENT_ID) return null
  // GIS renders its own fixed-width button; center it within the form column.
  return (
    <>
      <div ref={containerRef} className="flex justify-center" />
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-pill">
            <Loader2 size={20} className="animate-spin text-brand" />
            <span className="font-heading text-sm font-semibold text-ink">{t('signingIn')}</span>
          </div>
        </div>
      )}
    </>
  )
}
