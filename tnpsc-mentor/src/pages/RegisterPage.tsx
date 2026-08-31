import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Info, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useLanguageStore } from '../store/languageStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { api } from '../lib/api'
import {
  postAuthDestination,
  postAuthState,
  isAutoEnrollPath,
  sanitizeFromPath,
  type CredentialCarryoverState,
} from '../lib/authRouting'
import { useAuthConfigStore } from '../store/authConfigStore'
import AuthShell from '../components/Auth/AuthShell'
import AuthDivider from '../components/Auth/AuthDivider'
import GoogleSignInButton, { useIsGoogleConfigured } from '../components/Auth/GoogleSignInButton'
import TelegramHelpModal from '../components/Auth/TelegramHelpModal'
import PasswordInput from '../components/UI/PasswordInput'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError, isValidEmail, classifyInvalidEmail, passwordStrength } from '../lib/authValidation'
import { reportClientError } from '../lib/reportClientError'
import { isNativeApp } from '../lib/nativeAuth'
import { isAndroidWebView, openInBrowser } from '../lib/webview'
import { track, trackViewContent } from '../lib/tracking'
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

/**
 * Language is NOT asked for on this form any more — it is one of the fields that
 * was cut to shorten signup. The AuthShell header already carries a live
 * EN / தமிழ் / EN+த switcher, so whatever the visitor is reading the page in is
 * the honest answer; when they never touched it we persist 'both', which is the
 * only default that strands nobody (every question renders in English AND
 * Tamil). Persisting it here is also what keeps the post-signup route going
 * straight to the dashboard instead of detouring via the /language screen.
 */
const DEFAULT_SIGNUP_LANG = 'both' as const

const STRENGTH_META: { key: StringKey; color: string }[] = [
  { key: 'pwStrengthWeak', color: 'bg-coral' },
  { key: 'pwStrengthWeak', color: 'bg-coral' },
  { key: 'pwStrengthFair', color: 'bg-gold' },
  { key: 'pwStrengthGood', color: 'bg-brand' },
  { key: 'pwStrengthStrong', color: 'bg-mint' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp, sendSignupOtp, verifySignupOtp, startTelegramVerify, checkTelegramVerify } =
    useAuth()
  const { t } = useT()
  const setLang = useLanguageStore((s) => s.setLang)
  const isSignupWaOtpConfigured = useAuthConfigStore((s) => s.whatsappOtp)
  const isTelegramVerifyConfigured = useAuthConfigStore((s) => s.telegramVerify)
  const isGoogleConfigured = useIsGoogleConfigured()

  // Bounced here from /login because no account exists for the email typed
  // there — carry over what was typed instead of a blank form.
  const carryover = location.state as CredentialCarryoverState | null
  // Four inputs, deliberately. Gender, confirm-password and the language picker
  // were cut: none of them gate anything on the way in, and each one was another
  // reason to abandon a form that most visitors reach from an ad. Gender is
  // editable in Profile; language rides the AuthShell switcher (see
  // DEFAULT_SIGNUP_LANG); a mistyped password is recoverable via the show/hide
  // eye and, failing that, /forgot-password.
  const [form, setForm] = useState({
    fullName: '',
    email: carryover?.prefillEmail ?? '',
    phone: '',
    password: carryover?.prefillPassword ?? '',
    targetGroup: 'Group1',
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
  // DPDP consent. The Act requires consent to be a free, specific, informed and
  // UNAMBIGUOUS indication given by clear affirmative action — a passive "by
  // using this app you agree" does not qualify. It also defines a child as
  // anyone under 18, so an explicit age affirmation is what lets us apply the
  // children's rules at all. One tick covers both. The submit BUTTON stays
  // enabled (a dead button teaches nothing); handleSubmit refuses and points at
  // the tick instead.
  const [consented, setConsented] = useState(false)
  const [showTgHelp, setShowTgHelp] = useState(false)

  // A deep link the user was bounced from (e.g. a marketing landing page CTA) —
  // resolved the same way LoginPage does, via the shared postAuthDestination().
  // A ?from= query param is the fallback for a WebView-to-browser handoff
  // (fresh page load, no router state survives it) — see goAuth in
  // RankBoosterLandingPage.tsx and sanitizeFromPath's own doc for why the
  // query-param source is validated and the state one isn't.
  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    sanitizeFromPath(new URLSearchParams(location.search).get('from'))

  // Top of the signup funnel: fire Meta's ViewContent once when the register
  // page is reached (no-ops in the native apps / dev — see lib/tracking).
  useEffect(() => {
    trackViewContent({ contentName: 'Register', contentCategory: 'signup' })
    // Arrival counter for in-app-browser traffic — the clearest signal we have
    // about where this page's visitors come from (overwhelmingly Instagram /
    // Facebook). Reported here, once per page load, rather than from
    // GoogleSignInButton: that component now attempts Google in a WebView like
    // anywhere else, so it can only tell us about REFUSALS, not arrivals.
    if (isAndroidWebView) {
      reportClientError({
        kind: 'generic',
        path: '/register',
        message: `Register opened inside an Android WebView | UA: ${navigator.userAgent}`,
      })
    }
  }, [])

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

  // WHERE the Google block goes, not whether it exists — it is always rendered.
  // Google's SDK usually refuses to run inside an in-app browser (Instagram /
  // Facebook / Messenger), which is where most of this page's ad traffic
  // arrives, so leading with it there would spend the most valuable spot on the
  // page on a button that probably won't appear; those visitors get the form
  // first and the Google block underneath, where it still renders a real,
  // working button in the WebViews that DO allow it.
  //
  // Our own Android app is also an Android WebView by user-agent (stock System
  // WebView, no UA override in capacitor.config.ts) — but its Google sign-in
  // goes through the native plugin and was never subject to the block, so it
  // belongs firmly in the "Google first" branch.
  const googleFirst = isGoogleConfigured && (isNativeApp() || !isAndroidWebView)
  const googleBelowForm = isGoogleConfigured && !googleFirst

  /** Create the account (with the WhatsApp ticket when the feature is live) and
   * run the post-signup routine. On failure the user lands back on the form —
   * every fixable signup error (duplicate email etc.) lives there. */
  const doSignUp = async (phoneTicket?: string) => {
    const { error: err, emailTaken } = await signUp({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      targetGroup: form.targetGroup,
      phoneTicket,
    })

    if (emailTaken) {
      const state: CredentialCarryoverState = {
        prefillEmail: form.email.trim(),
        prefillPassword: form.password,
        ...(fromPath ? { from: { pathname: fromPath } } : {}),
      }
      navigate('/login', { replace: true, state })
      return
    }

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

    // Settle the language WITHOUT asking: whatever the AuthShell switcher is on,
    // else the bilingual default. Persisting it is what lets the next line land
    // on the dashboard instead of the one-time /language screen — a brand-new
    // account should never be stopped by another screen right after signing up.
    const chosenLang = useLanguageStore.getState().lang ?? DEFAULT_SIGNUP_LANG
    setLang(chosenLang)
    if (useAuthStore.getState().user) {
      api.updateProfile({ language: chosenLang }).catch(() => {})
      navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
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
    track('signup_otp_sent')
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
    if (!isValidEmail(form.email)) {
      // Never the actual value — a coarse shape tag only (see
      // classifyInvalidEmail) — so a real occurrence is diagnosable without
      // logging anyone's typed input anywhere.
      reportClientError({
        kind: 'generic',
        path: '/register',
        message: `Email validation rejected on submit: ${classifyInvalidEmail(form.email)} (length ${form.email.trim().length})`,
      })
      return setError(t('errEmailInvalid'))
    }
    if (!form.phone.trim()) return setError(t('errWhatsappRequired'))
    if (!isValidIndianMobile(form.phone)) return setError(t('errMobileInvalid'))
    if (form.password.length < 8) return setError(t('errPasswordShort'))
    if (!consented) return setError(t('errConsentRequired'))

    track('signup_form_submit')
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

  const handleVerifyOtp = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setOtpInfo('')
    if (otp.trim().length !== 6) return setError(t('errOtpRequired'))

    setLoading(true)
    const res = await verifySignupOtp(form.phone.trim(), otp.trim())
    if (res.invalid) {
      setLoading(false)
      track('signup_otp_failed', { reason: 'invalid' })
      return setError(t('waOtpInvalid'))
    }
    if (res.dead) {
      setLoading(false)
      setOtp('')
      track('signup_otp_failed', { reason: 'expired' })
      return setError(t('waOtpDead'))
    }
    if (res.error || !res.ticket) {
      setLoading(false)
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setVerified({ phone: tenDigits(form.phone), ticket: res.ticket })
    track('signup_otp_verified')
    // Straight into account creation — the button reads "Verify & create account".
    await doSignUp(res.ticket)
    setLoading(false)
  }

  // Six digits in → verify immediately. Guarded on `loading` and on the step so
  // a re-render mid-request can't fire a second verification with the same code
  // (which the server would count as a wrong guess against the 5-attempt budget).
  useEffect(() => {
    if (step !== 'otp' || loading || otp.length !== 6) return
    void handleVerifyOtp()
    // handleVerifyOtp is re-created every render and `loading` must stay OUT of
    // the deps: re-running when it flips back to false would resubmit the same
    // rejected code and burn another of the server's 5 attempts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step])

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
        {/* "Register for free" is the headline, not "Create your account": the
            page's whole job is to answer "what does this cost me?" before a
            visitor decides whether to read on. */}
        <h2 className="tamil mb-1 text-center font-heading text-2xl font-bold tracking-tight text-ink">
          {t('registerForFree')}
        </h2>
        <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('registerFreeSub')}</p>

        {/* Google first — one tap, nothing to type. Only where it can actually
            work: inside an in-app browser Google's SDK refuses to run, so those
            visitors get the form first and the escape hatch below it instead of
            a dead button occupying the most valuable spot on the page.
            fromPath (threaded through GoogleSignInButton → postAuthState) brings
            purchase-intent arrivals right back to resume checkout. */}
        {googleFirst && step === 'form' && (
          <div className="mb-6">
            {isAutoEnrollPath(fromPath) && (
              <p className="tamil mb-3 text-center font-heading text-xs font-bold uppercase tracking-wide text-gold">
                {t('fastestWayToEnroll')}
              </p>
            )}
            <GoogleSignInButton onError={setError} fromPath={fromPath} text="signup_with" />
            <AuthDivider label={t('orSignUpWithEmail')} />
          </div>
        )}

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
                autoFocus
                className="input-soft text-center text-lg tracking-[0.5em]"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
          {/* The number must be ON WhatsApp — that is where the verification
              code is delivered — so the label says so rather than leaving the
              user to discover it at the OTP step. */}
          <div>
            <Field
              id="reg-phone"
              label={t('whatsappNumber')}
              type="tel"
              value={form.phone}
              onChange={(v) => update('phone', v)}
              placeholder="10-digit WhatsApp number"
              autoComplete="tel"
              inputMode="numeric"
              invalid={touched && !!form.phone && !isValidIndianMobile(form.phone)}
            />
            {isSignupWaOtpConfigured && (
              <p className="tamil mt-1.5 flex items-start gap-1.5 font-body text-xs leading-relaxed text-ink2">
                <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-mint" />
                {t('whatsappNumberHint')}
              </p>
            )}
          </div>

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
              placeholder="At least 8 characters"
              autoComplete="new-password"
              invalid={touched && form.password.length > 0 && form.password.length < 8}
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
                <span className="font-heading text-2xs font-semibold text-ink2">
                  {t(STRENGTH_META[strength].key)}
                </span>
              </div>
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

          {/* Consent + age. Recorded as an affirmative action, and the policies
              are reachable from here rather than buried in a footer. */}
          <label className="mt-1 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-brand"
            />
            <span className="tamil font-body text-xs leading-relaxed text-ink2">
              {t('consentIntro')}{' '}
              <Link to="/guidelines" target="_blank" className="text-brand hover:underline">
                {t('termsOfUse')}
              </Link>{' '}
              {t('consentAnd')}{' '}
              <Link to="/privacy" target="_blank" className="text-brand hover:underline">
                {t('privacyPolicy')}
              </Link>
              {t('consentAgeSuffix')}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-brand press mt-2 px-6 py-3.5 text-base"
          >
            {loading && <Spinner size={18} />}
            {loading
              ? isSignupWaOtpConfigured
                ? t('sendingOtp')
                : t('registeringFree')
              : t('registerForFree')}
          </button>
        </form>
        )}

        {/* In-app browser (Instagram / Facebook / Messenger). Google still gets
            its chance here — the button below renders for real wherever the
            embedded browser permits it, and only degrades to tap-to-explain
            where Google actually refuses. The "open in Chrome" line sits under
            it as a quiet offer rather than the modal that used to interrupt the
            page before the visitor had read a word of it; tapping hands the URL
            to Android's intent resolver, which opens their real browser (or this
            app, if installed). */}
        {googleBelowForm && step === 'form' && (
          <>
            <AuthDivider label={t('orDivider')} />
            <GoogleSignInButton onError={setError} fromPath={fromPath} text="signup_with" />
            <p className="tamil mt-3 text-center font-body text-xs leading-relaxed text-ink2">
              {t('webViewGoogleNote')}{' '}
              <button
                type="button"
                onClick={() => openInBrowser('/register')}
                className="focus-ring rounded font-heading font-bold text-brand transition hover:text-brand-dark"
              >
                {t('openInChrome')}
              </button>
            </p>
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
  inputMode?: 'numeric' | 'tel' | 'email' | 'text'
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
  inputMode,
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
        inputMode={inputMode}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
