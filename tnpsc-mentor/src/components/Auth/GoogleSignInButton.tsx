import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { postAuthDestination } from '../../lib/authRouting'

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
  const containerRef = useRef<HTMLDivElement>(null)

  // GIS registers its callback ONCE; keep the latest deps in a ref so that single
  // callback always sees fresh props/handlers without re-initialising the widget.
  const handleRef = useRef<(credential: string) => void>(() => {})
  handleRef.current = async (credential: string) => {
    onStart?.()
    const { error } = await signInWithGoogle(credential)
    if (error) {
      onError(error)
      return
    }
    navigate(postAuthDestination(fromPath), { replace: true })
  }
  const errorRef = useRef(onError)
  errorRef.current = onError

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => handleRef.current(resp.credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text,
          shape: 'pill',
          logo_alignment: 'center',
        })
      })
      .catch((e) =>
        errorRef.current(e instanceof Error ? e.message : 'Failed to load Google sign-in')
      )
    return () => {
      cancelled = true
    }
    // Mount-once: deps are read via refs so the widget isn't re-created per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CLIENT_ID) return null
  // GIS renders its own fixed-width button; center it within the form column.
  return <div ref={containerRef} className="flex justify-center" />
}
