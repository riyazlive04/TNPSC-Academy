import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import AuthShell from '../components/Auth/AuthShell'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'

/**
 * Where the emailed reset link lands.
 *
 * GoTrue verifies the link on its own /auth/v1/verify endpoint and then bounces
 * the browser here with the proof attached. The shape depends on the email
 * template, so read both:
 *   #access_token=…&type=recovery   default template
 *   ?token_hash=…&type=recovery     {{ .TokenHash }} template
 *
 * Read once on mount and then strip it from the address bar — a recovery
 * credential in `location` gets copied into browser history and leaks through
 * the Referer header on any outbound link.
 */
function readRecoveryCreds(): { access_token?: string; token_hash?: string } | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)

  const accessToken = hash.get('access_token')
  if (accessToken) return { access_token: accessToken }

  const tokenHash = query.get('token_hash') ?? hash.get('token_hash')
  if (tokenHash) return { token_hash: tokenHash }

  return null
}

export default function ResetPasswordPage() {
  const { t } = useT()
  const navigate = useNavigate()

  // useMemo, not useState(readRecoveryCreds()): the effect below clears the URL,
  // and under StrictMode's double-invoke a lazy initialiser would re-run after
  // the clear and come back empty.
  const creds = useMemo(readRecoveryCreds, [])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!creds) return
    window.history.replaceState(null, '', window.location.pathname)
  }, [creds])

  const mismatch = touched && confirm.length > 0 && password !== confirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (password.length < 6) return setError(t('errPasswordShort'))
    if (password !== confirm) return setError(t('errPasswordMismatch'))
    if (!creds) return setError(t('resetLinkInvalid'))

    setLoading(true)
    try {
      await api.auth.resetPassword(creds, password)
      setDone(true)
      // Straight to sign-in rather than auto-logging them in: the recovery token
      // proves control of the mailbox, not that the person at the keyboard knows
      // the password they just set.
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  // Landed here without a token — a bare visit, or a link that GoTrue rejected.
  if (!creds) {
    return (
      <AuthShell>
        <div className="rounded-3xl border border-line bg-card p-6 text-center shadow-card sm:p-8">
          <h2 className="mb-2 font-heading text-xl font-semibold tracking-tight text-ink">
            {t('resetPasswordTitle')}
          </h2>
          <p className="mb-6 font-body text-sm text-ink2">{t('resetLinkInvalid')}</p>
          <Link to="/forgot-password" className="btn-brand press inline-flex px-6 py-3">
            {t('requestNewLink')}
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('newPasswordTitle')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('newPasswordHint')}</p>

        {done ? (
          <div className="flex animate-scaleIn flex-col items-center gap-4 py-4 text-center">
            <div className="grid h-16 w-16 animate-popStar place-items-center rounded-3xl bg-mintsoft">
              <CheckCircle2 size={32} className="text-mint" />
            </div>
            <p className="font-body text-ink2">{t('passwordChanged')}</p>
            <Link to="/login" className="btn-brand press mt-2 inline-flex px-6 py-3">
              <ArrowLeft size={16} /> {t('backToSignIn')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('newPassword')}
              </label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                invalid={touched && password.length > 0 && password.length < 6}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('confirmPassword')}
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                invalid={mismatch}
              />
              {mismatch && (
                <p className="mt-1.5 font-body text-xs font-medium text-coral">
                  {t('errPasswordMismatch')}
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-brand press mt-2 px-6 py-3.5 text-base"
            >
              {loading && <Spinner size={18} />}
              {loading ? t('saving') : t('savePassword')}
            </button>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="focus-ring inline-flex items-center gap-1 rounded font-heading font-semibold text-brand transition hover:text-brand-dark"
              >
                <ArrowLeft size={15} /> {t('backToSignIn')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  )
}
