import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore, selectProfileNeedsOnboarding } from '../store/authStore'
import { api } from '../lib/api'
import { postAuthDestination } from '../lib/authRouting'
import AuthShell from '../components/Auth/AuthShell'
import Spinner from '../components/UI/Spinner'
import { useT } from '../lib/i18n'

const TARGET_GROUPS = [
  { value: 'Group1', label: 'Group 1' },
  { value: 'Group2_2A', label: 'Group 2 / 2A' },
  { value: 'Group4_VAO', label: 'Group 4 & VAO' },
]

/**
 * Post-signup onboarding for Google users, who arrive with only name + email.
 * Collects the two details Google doesn't provide — phone and target group — then
 * routes onward (language screen / arena). Email/password signups already supply
 * both, so the gate in ProtectedRoute never sends them here.
 */
export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const needsOnboarding = useAuthStore(selectProfileNeedsOnboarding)
  const { t } = useT()

  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [group, setGroup] = useState(profile?.target_group ?? 'Group1')
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

    setSaving(true)
    try {
      await api.updateProfile({ phone: phone.trim(), target_group: group })
      await fetchProfile()
      navigate(postAuthDestination(), { replace: true })
    } catch {
      setError(t('errServerUnreachable'))
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
                touched && !phone.trim() ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''
              }`}
              placeholder="10-digit mobile"
              value={phone}
              aria-invalid={(touched && !phone.trim()) || undefined}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="cp-group"
              className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wide text-ink2"
            >
              {t('targetGroup')}
            </label>
            <select
              id="cp-group"
              className="input-soft appearance-none"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {TARGET_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
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
