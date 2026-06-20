import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthShell from '../components/Auth/AuthShell'
import AuthDivider from '../components/Auth/AuthDivider'
import GoogleSignInButton, { isGoogleConfigured } from '../components/Auth/GoogleSignInButton'
import DeviceLimitModal from '../components/Auth/DeviceLimitModal'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail } from '../lib/authValidation'
import { postAuthDestination } from '../lib/authRouting'
import type { DeviceSession } from '../lib/api'
import { useT } from '../lib/i18n'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, replaceDevice } = useAuth()
  const { t } = useT()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  // Device-limit flow: the active devices to choose from, and which one is
  // currently being signed out.
  const [devices, setDevices] = useState<DeviceSession[] | null>(null)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)

  // After login the destination (console / onboarding / deep link / arena) is
  // resolved by the shared post-auth router from the freshly-loaded profile.
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  const emailInvalid = touched && !isValidEmail(email)
  const passwordInvalid = touched && !password

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')

    if (!email.trim()) return setError(t('errEmailRequired'))
    if (!isValidEmail(email)) return setError(t('errEmailInvalid'))
    if (!password) return setError(t('errPasswordRequired'))

    setLoading(true)
    const res = await signIn(email, password)
    setLoading(false)

    // Account already on the max number of devices → show them so the user can
    // sign one out and continue here.
    if (res.deviceLimit) {
      setDevices(res.devices ?? [])
      return
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }

    navigate(postAuthDestination(fromPath), { replace: true })
  }

  // Sign out the chosen device and sign in here, then continue to the app.
  const handleSignOutDevice = async (sessionId: string) => {
    setBusyDeviceId(sessionId)
    setError('')
    const res = await replaceDevice(email, password, sessionId)
    setBusyDeviceId(null)

    if (res.deviceLimit) {
      // Still over the limit (rare race) — refresh the list and let them retry.
      setDevices(res.devices ?? [])
      return
    }
    if (res.error) {
      setDevices(null)
      const f = friendlyAuthError(res.error)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }
    setDevices(null)
    navigate(postAuthDestination(fromPath), { replace: true })
  }

  return (
    <AuthShell>
      <div className="rounded-hero border border-line bg-card p-7 shadow-soft sm:p-9">
        <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-ink">
          {t('welcomeBack')}
        </h2>
        <p className="mb-7 text-center font-body text-sm text-ink2">{t('signInToContinue')}</p>

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
              {/* Inline "Forgot?" in the coral accent, as in the reference */}
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

          <button type="submit" disabled={loading} className="btn-brand press mt-2 w-full px-6 py-3.5 text-base">
            {loading && <Spinner size={18} />}
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>

        {/* Google + "create account" grouped together at the foot of the card. */}
        {isGoogleConfigured && (
          <>
            <AuthDivider label={t('orDivider')} />
            <GoogleSignInButton onError={setError} fromPath={fromPath} text="signin_with" />
          </>
        )}

        <p className="mt-6 text-center font-body text-sm text-ink2">
          {t('newHere')}{' '}
          <Link
            to="/register"
            className="focus-ring rounded font-heading font-bold text-brand transition hover:text-brand-dark"
          >
            {t('createAccount')}
          </Link>
        </p>
      </div>

      <DeviceLimitModal
        open={devices !== null}
        devices={devices ?? []}
        busyId={busyDeviceId}
        onSignOut={handleSignOutDevice}
        onClose={() => setDevices(null)}
      />
    </AuthShell>
  )
}
