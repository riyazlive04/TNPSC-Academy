import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Info, Send } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useLanguageStore, type Lang } from '../store/languageStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { api, isSignupWaOtpConfigured, isTelegramVerifyConfigured } from '../lib/api'
import AuthShell from '../components/Auth/AuthShell'
import AuthDivider from '../components/Auth/AuthDivider'
import GoogleSignInButton, { isGoogleConfigured } from '../components/Auth/GoogleSignInButton'
import TelegramHelpModal from '../components/Auth/TelegramHelpModal'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail, passwordStrength } from '../lib/authValidation'
import { useT, type StringKey } from '../lib/i18n'

/**
 * Validates a 10-digit Indian mobile number. Accepts an optional +91 / 91 / 0
 * prefix and incidental spaces, hyphens or brackets, then requires exactly ten
 * digits starting 6-9 (the valid Indian mobile range).
 */
function isValidIndianMobile(raw: string): boolean {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  const m = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/)
  return Boolean(m)
}

/** The bare 10 digits of a valid Indian mobile ('' when invalid) — used to tell
 * whether the number a WhatsApp-OTP ticket was issued for is still the one in
 * the form (any prefix/spacing variant of the same number counts as unchanged). */
function tenDigits(raw: string): string {
  const m = raw.replace(/[\s\-()]/g, '').match(/^(?:\+91|91|0)?([6-9]\d{9})$/)
  return m ? m[1] : ''
}

/** Seconds the user must wait between WhatsApp-OTP sends (mirrors the server). */
const RESEND_COOLDOWN_S = 45

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
  const { signUp, sendSignupOtp, verifySignupOtp, startTelegramVerify, checkTelegramVerify } =
    useAuth()
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

  // WhatsApp phone verification: after the form validates, a code goes to the
  // number's WhatsApp and the form flips to a code-entry step. The verified
  // ticket is kept so an unchanged number never re-prompts (e.g. after fixing a
  // duplicate-email error and resubmitting).
  const [step, setStep] = useState<'form' | 'otp' | 'telegram'>('form')
  const [otp, setOtp] = useState('')
  const [otpInfo, setOtpInfo] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [verified, setVerified] = useState<{ phone: string; ticket: string } | null>(null)

  // Telegram fallback (number has no WhatsApp): deep link + polling token of the
  // in-flight verification, and whether to offer the button under the error.
  const [tg, setTg] = useState<{ token: string; url: string } | null>(null)
  const [offerTelegram, setOfferTelegram] = useState(false)
  const [showTgHelp, setShowTgHelp] = useState(false)

  // Tick the resend-cooldown counter down once per second while it's running.
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const update = (key: keyof typeof form, value: string) => {
    // A different phone invalidates any previously verified ticket AND the
    // pending Telegram offer/verification.
    if (key === 'phone') {
      setVerified(null)
      setOfferTelegram(false)
      setTg(null)
    }
    setForm((f) => ({ ...f, [key]: value }))
  }

  const strength = useMemo(() => passwordStrength(form.password), [form.password])
  const confirmMismatch = touched && form.confirm.length > 0 && form.password !== form.confirm

  /** Create the account (with the WhatsApp ticket when the feature is live) and
   * run the post-signup routine. On failure the user lands back on the form —
   * every fixable signup error (duplicate email etc.) lives there. */
  const doSignUp = async (phoneTicket?: string) => {
    const { error: err } = await signUp({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender || undefined,
      password: form.password,
      targetGroup: form.targetGroup,
      phoneTicket,
    })

    if (err) {
      // Ticket went stale between verify and register (very slow submit) — the
      // next submit will re-run the WhatsApp step for a fresh code.
      if (err.startsWith('Phone verification expired')) setVerified(null)
      setStep('form')
      const f = friendlyAuthError(err)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return
    }

    // Brand-new account - arm the first-run guided tour so it fires once when the
    // user first reaches the dashboard (now, or after email confirmation).
    useOnboardingStore.getState().arm()

    // Apply the language chosen at signup right away (drives the UI), persist it
    // to the profile when the account is live, and skip the language screen.
    setLang(form.language)
    if (useAuthStore.getState().user) {
      api.updateProfile({ language: form.language }).catch(() => {})
      navigate('/test-arena', { replace: true })
    } else {
      setStep('form')
      setInfo(t('confirmEmailSent'))
    }
  }

  /** Send (or re-send) the WhatsApp code and open the code-entry step. */
  const sendCode = async (): Promise<boolean> => {
    const res = await sendSignupOtp(form.phone.trim())
    if (res.phoneTaken) {
      setError(t('errPhoneRegistered'))
      return false
    }
    if (res.noWhatsApp) {
      setError(t('waOtpNoWhatsApp'))
      // No WhatsApp is exactly the case the Telegram fallback exists for.
      if (isTelegramVerifyConfigured) setOfferTelegram(true)
      return false
    }
    if (res.error) {
      const f = friendlyAuthError(res.error)
      setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
      return false
    }
    // On cooldown a still-valid code is already in their WhatsApp — let the user
    // type it rather than block them.
    setStep('otp')
    setResendIn(RESEND_COOLDOWN_S)
    if (res.cooldown) setOtpInfo(t('waOtpCooldown'))
    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    setInfo('')
    setOfferTelegram(false)

    if (!form.fullName.trim()) return setError(t('errNameRequired'))
    if (!form.email.trim()) return setError(t('errEmailRequired'))
    if (!isValidEmail(form.email)) return setError(t('errEmailInvalid'))
    if (!form.phone.trim()) return setError(t('errPhoneRequired'))
    if (!isValidIndianMobile(form.phone)) return setError(t('errMobileInvalid'))
    if (form.password.length < 6) return setError(t('errPasswordShort'))
    if (form.password !== form.confirm) return setError(t('errPasswordMismatch'))

    setLoading(true)
    if (!isSignupWaOtpConfigured) {
      // Feature off: single-step signup, exactly as before.
      await doSignUp()
    } else if (verified && verified.phone === tenDigits(form.phone)) {
      // This exact number already passed the OTP — no second prompt.
      await doSignUp(verified.ticket)
    } else {
      setOtp('')
      setOtpInfo('')
      await sendCode()
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOtpInfo('')
    if (otp.trim().length !== 6) return setError(t('errOtpRequired'))

    setLoading(true)
    const res = await verifySignupOtp(form.phone.trim(), otp.trim())
    if (res.invalid) {
      setLoading(false)
      return setError(t('waOtpInvalid'))
    }
    if (res.dead) {
      setLoading(false)
      setOtp('')
      return setError(t('waOtpDead'))
    }
    if (res.error || !res.ticket) {
      setLoading(false)
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setVerified({ phone: tenDigits(form.phone), ticket: res.ticket })
    // Straight into account creation — the button reads "Verify & create account".
    await doSignUp(res.ticket)
    setLoading(false)
  }

  const handleResendOtp = async () => {
    if (loading || resendIn > 0) return
    setError('')
    setOtpInfo('')
    setLoading(true)
    const ok = await sendCode()
    setLoading(false)
    if (ok) setOtpInfo((prev) => prev || t('otpResent'))
  }

  /** Telegram fallback: start a verification, open the bot, flip to the waiting
   * step (the polling effect below picks it up from there). */
  const handleStartTelegram = async () => {
    if (loading) return
    setError('')
    // Claim the new tab NOW, synchronously inside the click gesture — popup
    // blockers reject window.open calls made after an await. The tab gets its
    // real URL once the server responds; sever `opener` so the t.me page can't
    // reach back into the app.
    const win = window.open('', '_blank')
    if (win) win.opener = null
    setLoading(true)
    const res = await startTelegramVerify(form.phone.trim())
    setLoading(false)
    if (res.phoneTaken || res.error || !res.token || !res.url) {
      win?.close()
      if (res.phoneTaken) return setError(t('errPhoneRegistered'))
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setTg({ token: res.token, url: res.url })
    setStep('telegram')
    if (win) {
      win.location.href = res.url
    } else {
      // Pop-up fully denied — the waiting step's "Open Telegram" button is the
      // user-gesture fallback.
      window.open(res.url, '_blank', 'noopener')
    }
  }

  // Poll the Telegram verification while the waiting step is showing. Terminal
  // states clear `tg`, which also stops the loop; 'verified' rolls straight
  // into account creation with the same ticket the WhatsApp path uses.
  useEffect(() => {
    if (step !== 'telegram' || !tg) return
    let cancelled = false
    const interval = setInterval(async () => {
      const res = await checkTelegramVerify(tg.token)
      if (cancelled) return
      if (res.status === 'verified' && res.ticket) {
        cancelled = true
        clearInterval(interval)
        setTg(null)
        setVerified({ phone: tenDigits(form.phone), ticket: res.ticket })
        setLoading(true)
        await doSignUp(res.ticket)
        setLoading(false)
      } else if (res.status === 'mismatch') {
        clearInterval(interval)
        setTg(null)
        setError(t('tgMismatch'))
      } else if (res.status === 'expired') {
        clearInterval(interval)
        setTg(null)
        setError(t('tgExpired'))
      }
      // 'pending' (or a transient network error) → keep polling.
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phone/handlers are
    // stable while the waiting step is showing; re-run only on step/tg changes.
  }, [step, tg])

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('createYourAccount')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('startPreparing')}</p>

        {step === 'otp' ? (
          /* WhatsApp phone verification — the code was sent to the number's
             WhatsApp; verifying it immediately creates the account. */
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
            <p className="text-center font-body text-sm text-ink2">
              {t('waOtpSentTo')}{' '}
              <span className="font-semibold text-ink">{form.phone.trim()}</span>
            </p>
            <div>
              <label
                htmlFor="reg-otp"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('enterOtp')}
              </label>
              <input
                id="reg-otp"
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
                className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
              >
                {error}
              </div>
            )}
            {otpInfo && (
              <div
                role="status"
                className="animate-slideDown rounded-2xl bg-mintsoft px-4 py-3 text-center font-body text-sm font-medium text-mint"
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
              {loading ? t('verifyingOtp') : t('verifyAndCreate')}
            </button>

            <div className="flex items-center justify-between font-heading text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setStep('form')
                  setOtp('')
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
                disabled={loading || resendIn > 0}
                className="focus-ring rounded text-accent transition hover:opacity-80 disabled:opacity-50"
              >
                {resendIn > 0 ? `${t('resendOtp')} (${resendIn}s)` : t('resendOtp')}
              </button>
            </div>

            {/* Telegram fallback entry — the official WhatsApp API can't detect
                numbers without WhatsApp up front, so the alternative is offered
                right here on the code step instead of on a no-WhatsApp error. */}
            {isTelegramVerifyConfigured && (
              <button
                type="button"
                onClick={handleStartTelegram}
                disabled={loading}
                className="focus-ring mx-auto inline-flex items-center gap-1.5 rounded font-heading text-xs font-semibold text-accent transition hover:opacity-80 disabled:opacity-50"
              >
                <Send size={13} />
                {t('tgOfferBtn')}
              </button>
            )}
          </form>
        ) : step === 'telegram' ? (
          /* Telegram fallback — waiting for the user to share their contact in
             the bot; the polling effect advances this step automatically. */
          <div className="flex flex-col gap-4">
            <p className="text-center font-body text-sm text-ink2">{t('tgInstructions')}</p>

            <button
              type="button"
              onClick={() => setShowTgHelp(true)}
              className="focus-ring mx-auto inline-flex items-center gap-1.5 rounded font-heading text-xs font-semibold text-accent transition hover:opacity-80"
            >
              <Info size={14} />
              {t('tgHelpTitle')}
            </button>

            {tg && (
              <div className="flex items-center justify-center gap-2 font-body text-sm font-medium text-ink2">
                <Spinner size={16} />
                {loading ? t('creatingAccount') : t('tgWaiting')}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
              >
                {error}
              </div>
            )}

            {tg && (
              <a
                href={tg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brand press flex items-center justify-center gap-2 px-6 py-3.5 text-base"
              >
                <Send size={18} />
                {t('tgOpen')}
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                setStep('form')
                setTg(null)
                setError('')
              }}
              className="focus-ring mx-auto rounded font-heading text-xs font-semibold text-ink2 transition hover:text-ink"
            >
              {t('changeNumber')}
            </button>
          </div>
        ) : (
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
            invalid={touched && !!form.phone && !isValidIndianMobile(form.phone)}
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
                <div aria-hidden="true" className="flex h-1.5 flex-1 gap-1">
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
          {/* Telegram fallback offer — shown when the number has no WhatsApp.
              The ⓘ opens an illustrated how-to before the user commits. */}
          {offerTelegram && (
            <div className="flex animate-slideDown items-stretch gap-2">
              <button
                type="button"
                onClick={handleStartTelegram}
                disabled={loading}
                className="btn-brand press flex flex-1 items-center justify-center gap-2 px-6 py-3 text-sm"
              >
                <Send size={16} />
                {t('tgOfferBtn')}
              </button>
              <button
                type="button"
                onClick={() => setShowTgHelp(true)}
                aria-label={t('tgHelpTitle')}
                className="focus-ring grid w-11 flex-shrink-0 place-items-center rounded-xl border border-line bg-card text-ink2 transition hover:border-brand/30 hover:text-ink"
              >
                <Info size={18} />
              </button>
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
            {loading
              ? isSignupWaOtpConfigured
                ? t('sendingOtp')
                : t('creatingAccount')
              : t('createAccount')}
          </button>
        </form>
        )}

        {isGoogleConfigured && step === 'form' && (
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

      <TelegramHelpModal open={showTgHelp} onClose={() => setShowTgHelp(false)} />
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
