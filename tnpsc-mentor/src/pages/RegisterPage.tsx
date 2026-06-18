import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { api } from '../lib/api'
import AuthShell from '../components/Auth/AuthShell'
import AuthDivider from '../components/Auth/AuthDivider'
import GoogleSignInButton, { isGoogleConfigured } from '../components/Auth/GoogleSignInButton'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail, passwordStrength } from '../lib/authValidation'
import { useT, type StringKey } from '../lib/i18n'

const GENDERS: { value: string; labelKey: StringKey }[] = [
  { value: 'male', labelKey: 'genderMale' },
  { value: 'female', labelKey: 'genderFemale' },
  { value: 'other', labelKey: 'genderOther' },
]

const LANGUAGES: { id: Lang; labelKey: StringKey }[] = [
  { id: 'en', labelKey: 'langEnglish' },
  { id: 'ta', labelKey: 'langTamil' },
  { id: 'both', labelKey: 'langBoth' },
]

const STRENGTH_META: { key: StringKey; color: string }[] = [
  { key: 'pwStrengthWeak', color: 'bg-coral' },
  { key: 'pwStrengthWeak', color: 'bg-coral' },
  { key: 'pwStrengthFair', color: 'bg-gold' },
  { key: 'pwStrengthGood', color: 'bg-brand' },
  { key: 'pwStrengthStrong', color: 'bg-mint' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { t } = useT()
  const setLang = useLanguageStore((s) => s.setLang)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: '',
    password: '',
    confirm: '',
    targetGroup: 'Group1',
    language: 'en' as Lang,
  })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const strength = useMemo(() => passwordStrength(form.password), [form.password])
  const confirmMismatch = touched && form.confirm.length > 0 && form.password !== form.confirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    setInfo('')

    if (!form.fullName.trim()) return setError(t('errNameRequired'))
    if (!form.email.trim()) return setError(t('errEmailRequired'))
    if (!isValidEmail(form.email)) return setError(t('errEmailInvalid'))
    if (!form.phone.trim()) return setError(t('errPhoneRequired'))
    if (form.password.length < 6) return setError(t('errPasswordShort'))
    if (form.password !== form.confirm) return setError(t('errPasswordMismatch'))

    setLoading(true)
    const { error: err } = await signUp({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender || undefined,
      password: form.password,
      targetGroup: form.targetGroup,
    })
    setLoading(false)

    if (err) {
      const f = friendlyAuthError(err)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }

    // Apply the language chosen at signup right away (drives the UI), persist it
    // to the profile when the account is live, and skip the language screen.
    setLang(form.language)
    if (useAuthStore.getState().user) {
      api.updateProfile({ language: form.language }).catch(() => {})
      navigate('/test-arena', { replace: true })
    } else {
      setInfo(t('confirmEmailSent'))
    }
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('createYourAccount')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('startPreparing')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
          <Field
            id="reg-name"
            label={t('fullName')}
            value={form.fullName}
            onChange={(v) => update('fullName', v)}
            placeholder="Your name"
            autoComplete="name"
            invalid={touched && !form.fullName.trim()}
          />
          <Field
            id="reg-email"
            label={t('email')}
            type="email"
            value={form.email}
            onChange={(v) => update('email', v)}
            placeholder="aspirant@email.com"
            autoComplete="email"
            invalid={touched && !!form.email && !isValidEmail(form.email)}
          />
          <Field
            id="reg-phone"
            label={t('phone')}
            type="tel"
            value={form.phone}
            onChange={(v) => update('phone', v)}
            placeholder="10-digit mobile"
            autoComplete="tel"
            invalid={touched && !form.phone.trim()}
          />

          <div>
            <label
              htmlFor="reg-password"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('password')}
            </label>
            <PasswordInput
              id="reg-password"
              value={form.password}
              onChange={(v) => update('password', v)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              invalid={touched && form.password.length > 0 && form.password.length < 6}
            />
            {/* Password strength meter - animates as the user types. */}
            {form.password.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-1.5 flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                        i < strength ? STRENGTH_META[strength].color : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-heading text-[11px] font-semibold text-ink2">
                  {t(STRENGTH_META[strength].key)}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="reg-confirm"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('confirmPassword')}
            </label>
            <PasswordInput
              id="reg-confirm"
              value={form.confirm}
              onChange={(v) => update('confirm', v)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              invalid={confirmMismatch}
            />
            {confirmMismatch && (
              <p className="mt-1.5 animate-slideDown font-body text-xs font-medium text-coral">
                {t('errPasswordMismatch')}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="reg-gender"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('gender')}
            </label>
            <select
              id="reg-gender"
              className="input-soft appearance-none"
              value={form.gender}
              onChange={(e) => update('gender', e.target.value)}
            >
              <option value="">{t('genderSelect')}</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {t(g.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred language - chosen at signup so the language screen is skipped */}
          <div>
            <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2">
              {t('language')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((o) => {
                const active = form.language === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, language: o.id }))}
                    aria-pressed={active}
                    className={[
                      'tamil rounded-xl border px-3 py-2.5 font-heading text-sm font-semibold transition-all',
                      active
                        ? 'border-transparent bg-brand-gradient text-white shadow-brand'
                        : 'border-line bg-card text-ink2 hover:border-brand/30',
                    ].join(' ')}
                  >
                    {t(o.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              role="status"
              className="flex animate-slideDown items-center gap-2 rounded-2xl bg-mintsoft px-4 py-3 text-center font-body text-sm font-medium text-mint"
            >
              <CheckCircle2 size={16} className="flex-shrink-0" />
              {info}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-brand press mt-2 px-6 py-3.5 text-base">
            {loading && <Spinner size={18} />}
            {loading ? t('creatingAccount') : t('createAccount')}
          </button>
        </form>

        {isGoogleConfigured && (
          <>
            <AuthDivider label={t('orDivider')} />
            <GoogleSignInButton onError={setError} text="signup_with" />
          </>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-ink2">{t('alreadyRegistered')} </span>
          <Link
            to="/login"
            className="focus-ring rounded font-heading font-bold text-brand transition hover:text-brand-dark"
          >
            {t('signIn')}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  invalid?: boolean
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  invalid = false,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`input-soft ${invalid ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
