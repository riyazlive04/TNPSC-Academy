import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore, selectIsSuperAdmin } from '../store/authStore'
import AuthShell from '../components/Auth/AuthShell'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail } from '../lib/authValidation'
import { useT } from '../lib/i18n'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const { t } = useT()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  // After login: superadmins go straight to their console; everyone else routes
  // through the language screen (deep links to a specific page are honoured).
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
    const { error: err } = await signIn(email, password)
    setLoading(false)

    if (err) {
      const f = friendlyAuthError(err)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }

    // Resolve destination from the freshly-loaded profile.
    const isSuper = selectIsSuperAdmin(useAuthStore.getState())
    const dest = isSuper
      ? '/superadmin'
      : fromPath && fromPath !== '/test-arena'
        ? fromPath
        : '/language'
    navigate(dest, { replace: true })
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('welcomeBack')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('signInToContinue')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('email')}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`input-soft ${emailInvalid ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''}`}
              placeholder="aspirant@email.com"
              value={email}
              aria-invalid={emailInvalid || undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('password')}
            </label>
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
              className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-brand press mt-2 px-6 py-3.5 text-base">
            {loading && <Spinner size={18} />}
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <Link
            to="/forgot-password"
            className="focus-ring rounded font-heading font-semibold text-brand transition hover:text-brand-dark"
          >
            {t('forgotPassword')}
          </Link>
          <div className="h-px w-full bg-line" />
          <p className="font-body text-ink2">
            {t('newHere')}{' '}
            <Link
              to="/register"
              className="focus-ring rounded font-heading font-bold text-brand transition hover:text-brand-dark"
            >
              {t('createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
