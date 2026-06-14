import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AuthShell from '../components/Auth/AuthShell'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail } from '../lib/authValidation'
import { useT } from '../lib/i18n'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const emailInvalid = touched && !isValidEmail(email)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (!email.trim()) return setError(t('errEmailRequired'))
    if (!isValidEmail(email)) return setError(t('errEmailInvalid'))

    setLoading(true)
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) {
      const f = friendlyAuthError(err)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }
    setSent(true)
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('resetPasswordTitle')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('resetPasswordHint')}</p>

        {sent ? (
          <div className="flex animate-scaleIn flex-col items-center gap-4 py-4 text-center">
            <div className="grid h-16 w-16 animate-popStar place-items-center rounded-3xl bg-mintsoft">
              <MailCheck size={32} className="text-mint" />
            </div>
            <p className="font-body text-ink2">
              {t('resetLinkSent')}{' '}
              <span className="font-semibold text-brand">{email}</span>
            </p>
            <Link to="/login" className="btn-brand press mt-2 inline-flex px-6 py-3">
              <ArrowLeft size={16} /> {t('backToSignIn')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('email')}
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                className={`input-soft ${emailInvalid ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''}`}
                placeholder="aspirant@email.com"
                value={email}
                aria-invalid={emailInvalid || undefined}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? t('sending') : t('sendResetLink')}
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
