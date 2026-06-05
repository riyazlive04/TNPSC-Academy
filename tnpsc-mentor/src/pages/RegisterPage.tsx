import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'

const TARGET_GROUPS = [
  { value: 'Group1', label: 'Group 1' },
  { value: 'Group2_2A', label: 'Group 2 / 2A' },
  { value: 'Group4_VAO', label: 'Group 4 & VAO' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    targetGroup: 'Group1',
  })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!form.fullName.trim()) return setError('Please enter your full name.')
    if (!form.email.trim()) return setError('Please enter your email.')
    if (!form.phone.trim()) return setError('Please enter your phone number.')
    if (form.password.length < 6)
      return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirm)
      return setError('Passwords do not match.')
    if (!isSupabaseConfigured)
      return setError('Supabase is not configured. Set the VITE_SUPABASE_* env vars.')

    setLoading(true)
    const { error: err } = await signUp({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      targetGroup: form.targetGroup,
    })
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    // If email confirmation is enabled there may be no active session yet.
    if (useAuthStore.getState().user) {
      navigate('/language', { replace: true })
    } else {
      setInfo('Account created! Please check your email to confirm, then sign in.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-wide text-white">
            <span className="text-warn">✳</span> TNPSC{' '}
            <span className="text-accent">MENTOR</span>
          </h1>
        </div>

        <div className="rounded-3xl bg-secondary/40 p-6 shadow-card backdrop-blur sm:p-8">
          <h2 className="mb-6 text-center font-heading text-2xl font-bold uppercase tracking-wide text-white">
            Register as Aspirant
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            <Field
              label="Full Name"
              value={form.fullName}
              onChange={(v) => update('fullName', v)}
              placeholder="Your name"
              autoComplete="name"
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => update('email', v)}
              placeholder="aspirant@email.com"
              autoComplete="email"
            />
            <Field
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(v) => update('phone', v)}
              placeholder="10-digit mobile"
              autoComplete="tel"
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => update('password', v)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <Field
              label="Confirm Password"
              type="password"
              value={form.confirm}
              onChange={(v) => update('confirm', v)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />

            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
                Target Group
              </label>
              <select
                className="input-pill appearance-none"
                value={form.targetGroup}
                onChange={(e) => update('targetGroup', e.target.value)}
              >
                {TARGET_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl bg-warn/20 px-4 py-3 text-center font-body text-sm text-white">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl bg-green-500/20 px-4 py-3 text-center font-body text-sm text-white">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-white/60">Already registered? </span>
            <Link
              to="/login"
              className="font-heading font-semibold uppercase tracking-wide text-accent transition hover:text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </label>
      <input
        type={type}
        className="input-pill"
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
