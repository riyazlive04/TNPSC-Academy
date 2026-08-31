import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Info, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore, selectProfileNeedsOnboarding } from '../store/authStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { api, ApiError } from '../lib/api'
import { useAuthConfigStore } from '../store/authConfigStore'
import { postAuthDestination, postAuthState } from '../lib/authRouting'
import AuthShell from '../components/Auth/AuthShell'
import TelegramHelpModal from '../components/Auth/TelegramHelpModal'
import Spinner from '../components/UI/Spinner'
import { friendlyAuthError } from '../lib/authValidation'
import { useT } from '../lib/i18n'

/**
 * Validates a 10-digit Indian mobile number. Accepts an optional +91 / 91 / 0
 * prefix and incidental spaces/hyphens, then requires exactly ten digits
 * starting 6-9 (the valid Indian mobile range).
 */
function isValidIndianMobile(raw: string): boolean {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned)
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
 * Post-signup onboarding for Google users, who arrive with only name + email.
 * Collects the one detail Google doesn't provide - phone - then routes onward
 * (language screen / arena). Email/password signups already supply it, so the
 * gate in ProtectedRoute never sends them here. A default target group is still
 * submitted to keep group-derived logic working, but it isn't shown to the user.
 *
 * Phone ownership is proven the same way signup proves it: when the WhatsApp
 * OTP feature is live, PATCH /api/profile demands the same phone-verified
 * ticket /register does, so the form flips to a code-entry step (with the
 * Telegram fallback for numbers that have no WhatsApp) before saving.
 */
export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Deep link the user was bounced from before Google onboarding intervened
  // (e.g. /rank-booster) — see postAuthState() in lib/authRouting.ts, which is
  // what puts this here in the first place.
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const {
    profile,
    sendSignupOtp,
    verifySignupOtp,
    startTelegramVerify,
    checkTelegramVerify,
    signOut,
  } = useAuth()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const needsOnboarding = useAuthStore(selectProfileNeedsOnboarding)
  const { t } = useT()
  const isSignupWaOtpConfigured = useAuthConfigStore((s) => s.whatsappOtp)
  const isTelegramVerifyConfigured = useAuthConfigStore((s) => s.telegramVerify)

  const [phone, setPhone] = useState(profile?.phone ?? '')
  // Default group, submitted but not shown - keeps group-derived logic working.
  const group = profile?.target_group ?? 'Group1'
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  // WhatsApp phone verification: after the number validates, a code goes to its
  // WhatsApp and the form flips to a code-entry step. The verified ticket is
  // kept so an unchanged number never re-prompts.
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

  const updatePhone = (value: string) => {
    // A different phone invalidates any previously verified ticket AND the
    // pending Telegram offer/verification.
    setVerified(null)
    setOfferTelegram(false)
    setTg(null)
    setPhone(value)
  }

  /** Persist the profile (with the WhatsApp ticket when the feature is live)
   * and route onward. On failure the user lands back on the form. */
  const saveProfile = async (phoneTicket?: string) => {
    try {
      await api.updateProfile({
        phone: phone.trim(),
        target_group: group,
        ...(phoneTicket ? { phoneTicket } : {}),
      })
      await fetchProfile()
      // New Google account just finished profile setup - arm the first-run tour.
      useOnboardingStore.getState().arm()
      navigate(postAuthDestination(fromPath), { replace: true, state: postAuthState(fromPath) })
    } catch (e) {
      setStep('form')
      if (e instanceof ApiError && e.message === 'phone_already_registered') {
        setError(t('phoneAlreadyRegistered'))
      } else if (e instanceof ApiError && e.message === 'phone_not_verified') {
        // Ticket went stale between verify and save (very slow submit) — the
        // next submit re-runs the WhatsApp step for a fresh code.
        setVerified(null)
        setError(t('phoneVerifyExpired'))
      } else {
        setError(t('errServerUnreachable'))
      }
    }
  }

  /** Send (or re-send) the WhatsApp code and open the code-entry step. */
  const sendCode = async (): Promise<boolean> => {
    const res = await sendSignupOtp(phone.trim())
    if (res.phoneTaken) {
      setError(t('phoneAlreadyRegistered'))
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    setOfferTelegram(false)
    if (!phone.trim()) return setError(t('errPhoneRequired'))
    if (!isValidIndianMobile(phone)) return setError(t('errMobileInvalid'))

    setSaving(true)
    if (!isSignupWaOtpConfigured) {
      // Feature off: single-step save, exactly as before.
      await saveProfile()
    } else if (verified && verified.phone === tenDigits(phone)) {
      // This exact number already passed the OTP — no second prompt.
      await saveProfile(verified.ticket)
    } else {
      setOtp('')
      setOtpInfo('')
      await sendCode()
    }
    setSaving(false)
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOtpInfo('')
    if (otp.trim().length !== 6) return setError(t('errOtpRequired'))

    setSaving(true)
    const res = await verifySignupOtp(phone.trim(), otp.trim())
    if (res.invalid) {
      setSaving(false)
      return setError(t('waOtpInvalid'))
    }
    if (res.dead) {
      setSaving(false)
      setOtp('')
      return setError(t('waOtpDead'))
    }
    if (res.error || !res.ticket) {
      setSaving(false)
      const f = friendlyAuthError(res.error)
      return setError(f.key ? t(f.key) : f.text ?? t('errServerUnreachable'))
    }
    setVerified({ phone: tenDigits(phone), ticket: res.ticket })
    // Straight into the save — the button reads "Verify & Continue".
    await saveProfile(res.ticket)
    setSaving(false)
  }

  const handleResendOtp = async () => {
    if (saving || resendIn > 0) return
    setError('')
    setOtpInfo('')
    setSaving(true)
    const ok = await sendCode()
    setSaving(false)
    if (ok) setOtpInfo((prev) => prev || t('otpResent'))
  }

  /** Telegram fallback: start a verification, open the bot, flip to the waiting
   * step (the polling effect below picks it up from there). */
  const handleStartTelegram = async () => {
    if (saving) return
    setError('')
    // Claim the new tab NOW, synchronously inside the click gesture — popup
    // blockers reject window.open calls made after an await. The tab gets its
    // real URL once the server responds; sever `opener` so the t.me page can't
    // reach back into the app.
    const win = window.open('', '_blank')
    if (win) win.opener = null
    setSaving(true)
    const res = await startTelegramVerify(phone.trim())
    setSaving(false)
    if (res.phoneTaken || res.error || !res.token || !res.url) {
      win?.close()
      if (res.phoneTaken) return setError(t('phoneAlreadyRegistered'))
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
  // into the profile save with the same ticket the WhatsApp path uses.
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
        setVerified({ phone: tenDigits(phone), ticket: res.ticket })
        setSaving(true)
        await saveProfile(res.ticket)
        setSaving(false)
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
    // phone/handlers are stable while the waiting step is showing; re-run only
    // on step/tg changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tg])

  // Already complete (direct navigation / refresh after finishing) → move on.
  if (!needsOnboarding) {
    return <Navigate to={postAuthDestination(fromPath)} state={postAuthState(fromPath)} replace />
  }

  // This screen only ever appears already signed in (Google supplied name +
  // email; only phone is missing) — but there was previously no way off it if
  // that was the wrong Google account. Signing out here just clears the
  // session; ProtectedRoute then sends the now-anonymous user to /login same
  // as everywhere else.
  const handleSwitchAccount = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('completeProfileTitle')}
        </h2>
        <p className="mb-4 text-center font-body text-sm text-ink2">{t('completeProfileSub')}</p>
        {profile?.email && (
          <p className="mb-6 text-center font-body text-xs text-ink2">
            {profile.email} ·{' '}
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="focus-ring rounded font-heading font-semibold text-accent underline-offset-2 hover:underline"
            >
              {t('signOut')}
            </button>
          </p>
        )}

        {step === 'otp' ? (
          /* WhatsApp phone verification — the code was sent to the number's
             WhatsApp; verifying it immediately saves the profile. */
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
            <p className="text-center font-body text-sm text-ink2">
              {t('waOtpSentTo')} <span className="font-semibold text-ink">{phone.trim()}</span>
            </p>
            <div>
              <label
                htmlFor="cp-otp"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('enterOtp')}
              </label>
              <input
                id="cp-otp"
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
              disabled={saving}
              className="btn-brand press mt-2 w-full px-6 py-3.5 text-base"
            >
              {saving && <Spinner size={18} />}
              {saving ? t('verifyingOtp') : t('verifyAndContinue')}
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
                disabled={saving || resendIn > 0}
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
                disabled={saving}
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
                {saving ? t('sending') : t('tgWaiting')}
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
          <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
            <div>
              <label
                htmlFor="cp-phone"
                className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
              >
                {t('whatsappNumber')}
              </label>
              <input
                id="cp-phone"
                type="tel"
                autoComplete="tel"
                className={`input-soft ${
                  touched && !isValidIndianMobile(phone)
                    ? 'animate-shake border-coral/60 focus:ring-coral/20'
                    : ''
                }`}
                inputMode="numeric"
                placeholder="10-digit WhatsApp number"
                value={phone}
                aria-invalid={(touched && !isValidIndianMobile(phone)) || undefined}
                onChange={(e) => updatePhone(e.target.value)}
              />
              {isSignupWaOtpConfigured && (
                <p className="tamil mt-1.5 flex items-start gap-1.5 font-body text-xs leading-relaxed text-ink2">
                  <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-mint" />
                  {t('whatsappNumberHint')}
                </p>
              )}
            </div>
            {/* Gender used to be asked here too. It gates nothing, and this
                screen is the ONLY thing standing between a Google sign-up and
                the dashboard — so it moved to Profile, where it can be filled in
                (or not) without costing a signup. */}

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
                  disabled={saving}
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

            <button
              type="submit"
              disabled={saving}
              className="btn-brand press mt-2 px-6 py-3.5 text-base"
            >
              {saving && <Spinner size={18} />}
              {saving
                ? isSignupWaOtpConfigured
                  ? t('sendingOtp')
                  : t('sending')
                : t('saveContinue')}
            </button>
          </form>
        )}
      </div>

      <TelegramHelpModal open={showTgHelp} onClose={() => setShowTgHelp(false)} />
    </AuthShell>
  )
}
