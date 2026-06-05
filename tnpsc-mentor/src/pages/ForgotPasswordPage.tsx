import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Please enter your email address.')
    if (!isSupabaseConfigured)
      return setError('Supabase is not configured. Set the VITE_SUPABASE_* env vars.')

    setLoading(true)
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    setSent(true)
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
          <h2 className="mb-2 text-center font-heading text-2xl font-bold uppercase tracking-wide text-white">
            Reset Credentials
          </h2>
          <p className="mb-6 text-center font-body text-sm text-white/60">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <MailCheck size={32} className="text-green-400" />
              </div>
              <p className="font-body text-white">
                If an account exists for{' '}
                <span className="font-semibold text-accent">{email}</span>, a
                password reset link is on its way. Check your inbox.
              </p>
              <Link
                to="/login"
                className="mt-2 rounded-full bg-accent px-6 py-2.5 font-heading font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div>
                <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  className="input-pill"
                  placeholder="aspirant@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-warn/20 px-4 py-3 text-center font-body text-sm text-white">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <div className="text-center text-sm">
                <Link
                  to="/login"
                  className="font-heading font-semibold uppercase tracking-wide text-white transition hover:text-accent"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
