import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore, selectProfileNeedsOnboarding } from '../store/authStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { api, ApiError } from '../lib/api'
import { postAuthDestination } from '../lib/authRouting'
import AuthShell from '../components/Auth/AuthShell'
import Spinner from '../components/UI/Spinner'
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

/**
 * Post-signup onboarding for Google users, who arrive with only name + email.
 * Collects the one detail Google doesn't provide - phone - then routes onward
 * (language screen / arena). Email/password signups already supply it, so the
 * gate in ProtectedRoute never sends them here. A default target group is still
 * submitted to keep group-derived logic working, but it isn't shown to the user.
 */
export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const needsOnboarding = useAuthStore(selectProfileNeedsOnboarding)
  const { t } = useT()

  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  // Default group, submitted but not shown - keeps group-derived logic working.
  const group = profile?.target_group ?? 'Group1'
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  // Already complete (direct navigation / refresh after finishing) → move on.
  if (!needsOnboarding) {
    return <Navigate to={postAuthDestination()} replace />
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (!phone.trim()) return setError(t('errPhoneRequired'))
    // TODO i18n: no errPhoneInvalid key in src/lib/i18n.ts (owned elsewhere).
    if (!isValidIndianMobile(phone))
      return setError('Please enter a valid 10-digit mobile number.')

    setSaving(true)
    try {
      await api.updateProfile({ phone: phone.trim(), gender: gender || null, target_group: group })
      await fetchProfile()
      // New Google account just finished profile setup - arm the first-run tour.
      useOnboardingStore.getState().arm()
      navigate(postAuthDestination(), { replace: true })
    } catch (e) {
      setError(
        e instanceof ApiError && e.message === 'phone_already_registered'
          ? t('phoneAlreadyRegistered')
          : t('errServerUnreachable')
      )
      setSaving(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-3xl border border-line bg-card p-6 shadow-card sm:p-8">
        <h2 className="mb-1 text-center font-heading text-xl font-semibold tracking-tight text-ink">
          {t('completeProfileTitle')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('completeProfileSub')}</p>

        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <div>
            <label
              htmlFor="cp-phone"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('phone')}
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
              placeholder="10-digit mobile"
              value={phone}
              aria-invalid={(touched && !isValidIndianMobile(phone)) || undefined}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="cp-gender"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('gender')}
            </label>
            <select
              id="cp-gender"
              className="input-soft appearance-none"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">{t('genderSelect')}</option>
              <option value="male">{t('genderMale')}</option>
              <option value="female">{t('genderFemale')}</option>
              <option value="other">{t('genderOther')}</option>
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="animate-slideDown rounded-2xl bg-coralsoft px-4 py-3 text-center font-body text-sm font-medium text-coral"
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-brand press mt-2 px-6 py-3.5 text-base">
            {saving && <Spinner size={18} />}
            {saving ? t('sending') : t('saveContinue')}
          </button>
        </form>
      </div>
    </AuthShell>
  )
}
