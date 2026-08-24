import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { postAuthDestination, postAuthState } from '../../lib/authRouting'
import { useT } from '../../lib/i18n'
import { isNativeApp, nativeGoogleIdToken } from '../../lib/nativeAuth'
import { useThemeStore } from '../../store/themeStore'
import { useAuthConfigStore } from '../../store/authConfigStore'
import { reportClientError } from '../../lib/reportClientError'
import DeviceLimitModal from './DeviceLimitModal'
import TotpChallengeModal from './TotpChallengeModal'
import type { DeviceSession } from '../../lib/api'

// Public OAuth Web Client ID (safe to ship to the browser) — still needed
// client-side to initialize Google Identity Services itself. When unset the
// component renders nothing, so the rest of auth works without Google.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'

/**
 * True only when Google is usable end to end: the Client ID is baked into this
 * build AND the server also reports it configured (its own GOOGLE_CLIENT_ID).
 * Host pages use this to hide the "or" divider too, so it never appears
 * stranded above an absent button. Reactive — see authConfigStore.
 */
export function useIsGoogleConfigured(): boolean {
  const serverSide = useAuthConfigStore((s) => s.google)
  return Boolean(CLIENT_ID) && serverSide
}

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
  const { signInWithGoogle, replaceDeviceGoogle, verifyTotp, replaceDeviceTotp } = useAuth()
  const { t } = useT()
  const configured = useIsGoogleConfigured()
  // Re-render Google's widget with its dark variant when the app is in dark mode,
  // otherwise the official button stays glaring white on a dark surface.
  const resolved = useThemeStore((s) => s.resolved)
  const resolvedRef = useRef(resolved)
  resolvedRef.current = resolved
  const renderRef = useRef<() => void>(() => {})
  const containerRef = useRef<HTMLDivElement>(null)
  // Drives a full-screen overlay while the ID token is exchanged for a session
  // and the next page loads - without it the page looks frozen ("lag") between
  // picking the Google account and the profile/onboarding screen appearing.
  const [busy, setBusy] = useState(false)
  // Device-limit state: when the account is already on the max devices we keep
  // the just-issued Google ID token (re-verifiable for ~1h) and the active device
  // list so the modal can sign one out and finish signing in here - the same
  // recovery the password/OTP flows offer.
  const [deviceLimit, setDeviceLimit] = useState<{ idToken: string; devices: DeviceSession[] } | null>(null)
  const [signingOutId, setSigningOutId] = useState<string | null>(null)
  const [modalError, setModalError] = useState('')
  // TOTP step-up (admin/superadmin only): Google succeeded but a second
  // factor is still owed. totpDeviceTicket is the SEPARATE ticket a device-
  // limit block reached DURING this step returns (distinct from the Google
  // idToken the deviceLimit state above re-verifies).
  const [totpTicket, setTotpTicket] = useState<string | null>(null)
  const [totpBusy, setTotpBusy] = useState(false)
  const [totpError, setTotpError] = useState('')
  const [totpDeviceTicket, setTotpDeviceTicket] = useState<string | null>(null)

  // GIS registers its callback ONCE; keep the latest deps in a ref so that single
  // callback always sees fresh props/handlers without re-initialising the widget.
  const handleRef = useRef<(credential: string) => void>(() => {})
  handleRef.current = async (credential: string) => {
    setBusy(true)
    onStart?.()
    const res = await signInWithGoogle(credential)
    if (res.totpRequired && res.ticket) {
      setBusy(false)
      setTotpError('')
      setTotpTicket(res.ticket)
      return
    }
    // The account is already on the max number of devices. Open the same
    // replace-device modal the password/OTP flows use; ownership is re-proven by
    // re-verifying this Google ID token when a device is signed out.
    if (res.deviceLimit) {
      setBusy(false)
      setModalError('')
      setDeviceLimit({ idToken: credential, devices: res.devices ?? [] })
      return
    }
    if (res.error) {
      setBusy(false)
      onError(res.error)
      return
    }
    // Leave the overlay up through navigation; it unmounts with this component.
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }
  const errorRef = useRef(onError)
  errorRef.current = onError

  // Sign out the chosen device, then finish signing in here. TOTP-triggered
  // blocks (already past the code check) use that fresh ticket; Google-
  // triggered blocks re-verify the stored ID token. Keep the modal open
  // (refreshing its list) if the account is somehow still over the limit.
  const onSignOutDevice = async (sessionId: string) => {
    if ((!deviceLimit && !totpDeviceTicket) || signingOutId) return
    setSigningOutId(sessionId)
    setModalError('')
    const res = totpDeviceTicket
      ? await replaceDeviceTotp(totpDeviceTicket, sessionId)
      : await replaceDeviceGoogle(deviceLimit!.idToken, sessionId)
    if (res.deviceLimit) {
      setSigningOutId(null)
      if (totpDeviceTicket) setTotpDeviceTicket(res.ticket ?? null)
      else setDeviceLimit({ idToken: deviceLimit!.idToken, devices: res.devices ?? [] })
      return
    }
    if (res.error) {
      setSigningOutId(null)
      setModalError(res.error)
      return
    }
    setSigningOutId(null)
    setDeviceLimit(null)
    setTotpDeviceTicket(null)
    setBusy(true) // overlay through navigation
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  // Verify the TOTP code and finish signing in.
  const onVerifyTotp = async (code: string) => {
    if (!totpTicket) return
    setTotpBusy(true)
    setTotpError('')
    const res = await verifyTotp(totpTicket, code)
    setTotpBusy(false)
    if (res.deviceLimit) {
      setTotpTicket(null)
      setTotpDeviceTicket(res.ticket ?? totpTicket)
      setModalError('')
      setDeviceLimit({ idToken: '', devices: res.devices ?? [] })
      return
    }
    if (res.error) {
      setTotpError(res.error)
      return
    }
    setTotpTicket(null)
    setBusy(true) // overlay through navigation
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  // Inside the Capacitor app, drive the account picker through the native plugin
  // instead of GIS (which can't run in the WebView). Same downstream handler.
  const onNativeClick = async () => {
    try {
      setBusy(true)
      const idToken = await nativeGoogleIdToken()
      if (!idToken) {
        // Picker succeeded but Google returned no ID token - surface it instead
        // of silently dropping back to the login screen.
        setBusy(false)
        // TODO i18n: diagnostic (OAuth misconfig) message; no key in
        // src/lib/i18n.ts (owned elsewhere). Kept as a clear English fallback.
        onError('Google returned no ID token. Check the Android OAuth client (package + SHA-1) is in the same project as the web client.')
        return
      }
      await handleRef.current(idToken)
    } catch (e) {
      setBusy(false)
      // Cancellation is not an error; everything else is shown.
      const msg = e instanceof Error ? e.message : String(e)
      if (/cancel/i.test(msg)) return
      onError(`Google sign-in failed: ${msg}`)
    }
  }

  useEffect(() => {
    if (!CLIENT_ID || isNativeApp()) return
    let cancelled = false
    let ro: ResizeObserver | undefined
    // GIS only takes a fixed pixel width - a hardcoded one overflows narrow
    // phones. Size it to the container instead (clamped to GIS's 200-400 range)
    // and re-render on resize so it stays inside the card. The width guard stops
    // the ResizeObserver from looping on the button's own height changes.
    let lastWidth = 0
    let lastTheme = ''
    const renderButton = () => {
      const el = containerRef.current
      if (!el || !window.google) return
      const avail = Math.floor(el.clientWidth || 300)
      const width = Math.min(400, Math.max(200, avail))
      // Google's GIS themes: 'outline' (light) / 'filled_black' (dark surface).
      const theme = resolvedRef.current === 'dark' ? 'filled_black' : 'outline'
      if (Math.abs(width - lastWidth) < 2 && theme === lastTheme) return
      lastWidth = width
      lastTheme = theme
      el.innerHTML = ''
      window.google.accounts.id.renderButton(el, {
        theme,
        size: 'large',
        width,
        text,
        shape: 'pill',
        logo_alignment: 'center',
      })
    }
    renderRef.current = renderButton
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
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load Google sign-in'
        errorRef.current(msg)
        // Server-side record (audit_log, via the same client-error telemetry
        // ErrorBoundary uses) so this is diagnosable from real traffic instead
        // of guessing — the server captures User-Agent/IP from the request
        // itself, so browser/network patterns are queryable later.
        reportClientError({
          kind: 'generic',
          path: window.location.pathname,
          message: `${msg} | UA: ${navigator.userAgent}`,
        })
      })
    return () => {
      cancelled = true
      ro?.disconnect()
    }
    // Mount-once: deps are read via refs so the widget isn't re-created per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render Google's widget when the theme flips so its variant matches.
  useEffect(() => {
    renderRef.current()
  }, [resolved])

  // The GSI-loading effect above still gates on CLIENT_ID alone (a static,
  // synchronous value) to avoid a stale-closure re-run problem with its
  // mount-once empty deps array; `configured` additionally folds in the
  // server's async-loaded flag and is safe to read fresh here since render
  // (unlike that effect) naturally re-runs whenever the store updates.
  if (!configured) return null

  // Native app: GIS can't render in the WebView, so use our own button that
  // triggers the native Google account picker.
  const label =
    text === 'signup_with'
      ? t('signUpWithGoogle')
      : text === 'signin_with'
        ? t('signInWithGoogle')
        : t('continueWithGoogle')

  return (
    <>
      {isNativeApp() ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNativeClick}
            disabled={busy}
            className="flex w-full max-w-[400px] items-center justify-center gap-3 rounded-full border border-line bg-card px-5 py-3 font-heading text-sm font-semibold text-ink shadow-pill transition active:scale-[0.98] disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
              />
            </svg>
            {label}
          </button>
        </div>
      ) : (
        // GIS renders its own fixed-width button; center it within the form column.
        <div ref={containerRef} className="flex justify-center" />
      )}
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
      <DeviceLimitModal
        open={!!deviceLimit}
        devices={deviceLimit?.devices ?? []}
        busyId={signingOutId}
        error={modalError}
        onSignOut={onSignOutDevice}
        onClose={() => {
          if (signingOutId) return
          setDeviceLimit(null)
          setTotpDeviceTicket(null)
          setModalError('')
        }}
      />
      <TotpChallengeModal
        open={!!totpTicket}
        busy={totpBusy}
        error={totpError}
        onVerify={onVerifyTotp}
        onClose={() => {
          if (totpBusy) return
          setTotpTicket(null)
          setTotpError('')
        }}
      />
    </>
  )
}
