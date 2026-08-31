import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthShell from '../components/Auth/AuthShell'
import AuthDivider from '../components/Auth/AuthDivider'
import GoogleSignInButton, { useIsGoogleConfigured } from '../components/Auth/GoogleSignInButton'
import DeviceLimitModal from '../components/Auth/DeviceLimitModal'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail, classifyInvalidEmail } from '../lib/authValidation'
import { reportClientError } from '../lib/reportClientError'
import {
  postAuthDestination,
  postAuthState,
  sanitizeFromPath,
  type CredentialCarryoverState,
} from '../lib/authRouting'
import { type DeviceSession } from '../lib/api'
import { useAuthConfigStore } from '../store/authConfigStore'
import { useT } from '../lib/i18n'

/** 10-digit Indian mobile, accepting an optional +91/91/0 prefix and spacing. */
function isValidIndianMobile(raw: string): boolean {
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(raw.replace(/[\s\-()]/g, ''))
}

type Mode = 'password' | 'phone'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, replaceDevice, sendOtp, verifyOtp, replaceDeviceOtp, verifyTotp, replaceDeviceTotp } =
    useAuth()
  const { t } = useT()
  const isPhoneOtpConfigured = useAuthConfigStore((s) => s.phoneOtp)
  const isGoogleConfigured = useIsGoogleConfigured()

  // Which sign-in method is active. The phone tab only appears when OTP login is
  // enabled for this build (server independently gates the endpoints).
  const [mode, setMode] = useState<Mode>('password')

  // Bounced here from /register because the email typed there already has a
  // password account — carry over what was typed instead of a blank form.
  const carryover = location.state as CredentialCarryoverState | null
  const [email, setEmail] = useState(carryover?.prefillEmail ?? '')
  const [password, setPassword] = useState(carryover?.prefillPassword ?? '')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  // Phone-OTP flow.
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone')
  const [otpInfo, setOtpInfo] = useState('')
  // Ticket returned with an OTP device-limit block — lets the device replace
  // finish without a fresh code.
  const [otpTicket, setOtpTicket] = useState<string | null>(null)

  // TOTP step-up (admin/superadmin only): password/Google succeeded but a
  // second factor is still owed. Set once signIn()/GoogleSignInButton reports
  // totpRequired; its presence replaces the password/phone form with the code
  // challenge below. totpDeviceTicket is the SEPARATE ticket a device-limit
  // block reached DURING this step returns (the TOTP code is already spent).
  const [totpTicket, setTotpTicket] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpUseBackup, setTotpUseBackup] = useState(false)
  const [totpDeviceTicket, setTotpDeviceTicket] = useState<string | null>(null)

  // Device-limit flow: the active devices to choose from, and which one is
  // currently being signed out.
  const [devices, setDevices] = useState<DeviceSession[] | null>(null)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  // Error shown INSIDE the device-limit modal (so a failed sign-out keeps the
  // modal open with its message, instead of closing and stranding the error).
  const [deviceError, setDeviceError] = useState('')

  // After login the destination (console / onboarding / deep link / arena) is
  // resolved by the shared post-auth router from the freshly-loaded profile.
  // A ?from= query param is the fallback for a WebView-to-browser handoff
  // (fresh page load, no router state survives it) — see goAuth in
  // RankBoosterLandingPage.tsx and sanitizeFromPath's own doc for why the
  // query-param source is validated and the state one isn't.
  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    sanitizeFromPath(new URLSearchParams(location.search).get('from'))

  const emailInvalid = touched && !isValidEmail(email)
  const passwordInvalid = touched && !password

  // ─── Password sign-in ──────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')

    if (!email.trim()) return setError(t('errEmailRequired'))
    if (!isValidEmail(email)) {
      // Never the actual value — a coarse shape tag only, see classifyInvalidEmail.
      reportClientError({
        kind: 'generic',
        path: '/login',
        message: `Email validation rejected on submit: ${classifyInvalidEmail(email)} (length ${email.trim().length})`,
      })
      return setError(t('errEmailInvalid'))
    }
    if (!password) return setError(t('errPasswordRequired'))

    setLoading(true)
    const res = await signIn(email, password)
    setLoading(false)

    if (res.totpRequired && res.ticket) {
      setTotpTicket(res.ticket)
      setTotpCode('')
      setTotpUseBackup(false)
      return
    }
    if (res.deviceLimit) {
      setDevices(res.devices ?? [])
      return
    }
    if (res.accountNotFound) {
      const state: CredentialCarryoverState = {
        prefillEmail: email.trim(),
        prefillPassword: password,
        ...(fromPath ? { from: { pathname: fromPath } } : {}),
      }
      navigate('/register', { replace: true, state })
      return
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  // ─── TOTP step-up: verify the code (or a backup code) and finish signing in ─
  const handleVerifyTotp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!totpCode.trim()) return setError(t('errOtpRequired'))

    setLoading(true)
    const res = await verifyTotp(totpTicket!, totpCode.trim())
    setLoading(false)

    if (res.deviceLimit) {
      setTotpDeviceTicket(res.ticket ?? totpTicket)
      setDevices(res.devices ?? [])
      return
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  // ─── Phone-OTP: request a code ─────────────────────────────────────────────
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOtpInfo('')
    if (!isValidIndianMobile(phone)) return setError(t('errMobileInvalid'))

    setLoading(true)
    const res = await sendOtp(phone.trim())
    setLoading(false)

    if (res.notRegistered) return setError(t('otpNotRegistered'))
    if (res.error) {
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setOtp('')
    setOtpStep('code')
  }

  // ─── Phone-OTP: resend ─────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setError('')
    setOtpInfo('')
    setLoading(true)
    const res = await sendOtp(phone.trim())
    setLoading(false)
    if (res.error) {
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setOtpInfo(t('otpResent'))
  }

  // ─── Phone-OTP: verify + sign in ───────────────────────────────────────────
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!otp.trim()) return setError(t('errOtpRequired'))

    setLoading(true)
    const res = await verifyOtp(phone.trim(), otp.trim())
    setLoading(false)

    if (res.deviceLimit) {
      setOtpTicket(res.ticket ?? null)
      setDevices(res.devices ?? [])
      return
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  // Sign out the chosen device and sign in here, then continue to the app. The
  // re-auth differs by method: password re-sends the credentials; OTP/TOTP use
  // the one-time ticket from the block (the code/OTP was already spent).
  const handleSignOutDevice = async (sessionId: string) => {
    setBusyDeviceId(sessionId)
    setDeviceError('')
    const res = totpDeviceTicket
      ? await replaceDeviceTotp(totpDeviceTicket, sessionId)
      : mode === 'phone' && otpTicket
        ? await replaceDeviceOtp(otpTicket, sessionId)
        : await replaceDevice(email, password, sessionId)
    setBusyDeviceId(null)

    if (res.deviceLimit) {
      // Still over the limit (rare race) - refresh the list/ticket and let them retry.
      if (totpDeviceTicket) setTotpDeviceTicket(res.ticket ?? null)
      else if (mode === 'phone') setOtpTicket(res.ticket ?? null)
      setDevices(res.devices ?? [])
      return
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      setDeviceError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }
    setDevices(null)
    navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setOtpInfo('')
    setTouched(false)
  }

  return (
    <AuthShell>
      <div className="rounded-hero border border-line bg-card p-7 shadow-soft sm:p-9">
        <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-ink">
          {t('welcomeBack')}
        </h2>
        <p className="mb-7 text-center font-body text-sm text-ink2">{t('signInToContinue')}</p>

        {totpTicket ? (
          <form onSubmit={handleVerifyTotp} className="flex flex-col gap-4" noValidate>
            <p className="text-center font-body text-sm text-ink2">{t('totpChallengeHint')}</p>
            <div>
              <label
                htmlFor="login-totp"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {totpUseBackup ? t('totpBackupCodeLabel') : t('enterOtp')}
              </label>
              <input
                id="login-totp"
                type="text"
                inputMode={totpUseBackup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                maxLength={totpUseBackup ? 10 : 6}
                className="input-soft text-center text-lg tracking-[0.4em]"
                placeholder="••••••"
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(
                    totpUseBackup ? e.target.value.trim() : e.target.value.replace(/\D/g, '')
                  )
                }
              />
            </div>

            {error && (
              <div
                role="alert"
                className="animate-slideDown rounded-card bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand press mt-2 w-full px-6 py-3.5 text-base"
            >
              {loading && <Spinner size={18} />}
              {loading ? t('verifyingOtp') : t('verifyAndSignIn')}
            </button>

            <div className="flex items-center justify-between font-heading text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTotpTicket(null)
                  setTotpDeviceTicket(null)
                  setTotpCode('')
                  setError('')
                }}
                className="focus-ring rounded text-ink2 transition hover:text-ink"
              >
                {t('totpBackToSignIn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTotpUseBackup((v) => !v)
                  setTotpCode('')
                  setError('')
                }}
                className="focus-ring rounded text-accent transition hover:opacity-80"
              >
                {totpUseBackup ? t('totpUseAppCodeInstead') : t('totpUseBackupCode')}
              </button>
            </div>
          </form>
        ) : (
        <>
        {/* Method toggle — only when phone-OTP login is enabled for this build. */}
        {isPhoneOtpConfigured && (
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-card bg-surface p-1">
            {(['password', 'phone'] as Mode[]).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  aria-pressed={active}
                  className={[
                    'rounded-card px-3 py-2 font-heading text-sm font-semibold transition-all',
                    active ? 'bg-card text-ink shadow-soft' : 'text-ink2 hover:text-ink',
                  ].join(' ')}
                >
                  {t(m === 'password' ? 'tabPassword' : 'tabPhone')}
                </button>
              )
            })}
          </div>
        )}

        {mode === 'password' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('email')}
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className={`input-soft pr-10 ${emailInvalid ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''}`}
                  placeholder="aspirant@email.com"
                  value={email}
                  aria-invalid={emailInvalid || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {isValidEmail(email) && (
                  <Check
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-correct"
                  />
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="login-password"
                  className="font-heading text-xs font-bold uppercase tracking-wide text-ink2"
                >
                  {t('password')}
                </label>
                <Link
                  to="/forgot-password"
                  className="focus-ring rounded font-heading text-xs font-semibold text-accent transition hover:opacity-80"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={setPassword}
                invalid={passwordInvalid}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="animate-slideDown rounded-card bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand press mt-2 w-full px-6 py-3.5 text-base"
            >
              {loading && <Spinner size={18} />}
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>
        )}

        {mode === 'phone' && (
          <>
            {otpStep === 'phone' ? (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4" noValidate>
                <div>
                  <label
                    htmlFor="login-phone"
                    className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
                  >
                    {t('mobileNumber')}
                  </label>
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="input-soft"
                    placeholder="10-digit mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="animate-slideDown rounded-card bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand press mt-2 w-full px-6 py-3.5 text-base"
                >
                  {loading && <Spinner size={18} />}
                  {loading ? t('sendingOtp') : t('sendOtp')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
                <p className="text-center font-body text-sm text-ink2">
                  {t('otpSentTo')} <span className="font-semibold text-ink">{phone.trim()}</span>
                </p>
                <div>
                  <label
                    htmlFor="login-otp"
                    className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
                  >
                    {t('enterOtp')}
                  </label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="input-soft text-center text-lg tracking-[0.5em]"
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="animate-slideDown rounded-card bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
                  >
                    {error}
                  </div>
                )}
                {otpInfo && (
                  <div
                    role="status"
                    className="animate-slideDown rounded-card bg-mintsoft px-4 py-3 text-center font-body text-sm font-medium text-mint"
                  >
                    {otpInfo}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand press mt-2 w-full px-6 py-3.5 text-base"
                >
                  {loading && <Spinner size={18} />}
                  {loading ? t('verifyingOtp') : t('verifyAndSignIn')}
                </button>

                <div className="flex items-center justify-between font-heading text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('phone')
                      setError('')
                      setOtpInfo('')
                    }}
                    className="focus-ring rounded text-ink2 transition hover:text-ink"
                  >
                    {t('changeNumber')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="focus-ring rounded text-accent transition hover:opacity-80 disabled:opacity-50"
                  >
                    {t('resendOtp')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Google + "create account" grouped together at the foot of the card. */}
        {isGoogleConfigured && (
          <>
            <AuthDivider label={t('orDivider')} />
            <GoogleSignInButton onError={setError} fromPath={fromPath} text="signin_with" />
          </>
        )}

        {/* Signing up is the scarcer action, so the link says what it costs
            ("free") rather than what it does ("create an account"). */}
        <p className="tamil mt-6 text-center font-body text-sm text-ink2">
          {t('newHere')}{' '}
          <Link
            to="/register"
            className="focus-ring rounded font-heading font-bold text-brand transition hover:text-brand-dark"
          >
            {t('registerForFree')}
          </Link>
        </p>
        </>
        )}
      </div>

      <DeviceLimitModal
        open={devices !== null}
        devices={devices ?? []}
        busyId={busyDeviceId}
        error={deviceError}
        onSignOut={handleSignOutDevice}
        onClose={() => {
          setDevices(null)
          setDeviceError('')
          setTotpDeviceTicket(null)
        }}
      />
    </AuthShell>
  )
}
