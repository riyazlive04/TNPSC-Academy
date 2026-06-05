import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // After login we always route through the language screen (it pre-selects
  // any saved choice, so returning users just click Continue). Deep links to
  // a specific protected page are still honoured.
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname
  const from = fromPath && fromPath !== '/test-arena' ? fromPath : '/language'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.')
      return
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.')
      return
    }

    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-wide text-white sm:text-4xl">
            <span className="text-warn">✳</span> TNPSC{' '}
            <span className="text-accent">MENTOR</span>
          </h1>
          <p className="mt-2 font-body text-sm uppercase tracking-widest text-white/50">
            Tamil Nadu Public Service Commission
          </p>
        </div>

        <div className="rounded-3xl bg-secondary/40 p-6 shadow-card backdrop-blur sm:p-8">
          <h2 className="mb-6 text-center font-heading text-2xl font-bold uppercase tracking-wide text-white">
            Enter Aspirant Portal
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
                Email / Username
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

            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wide text-white/70">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                className="input-pill"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            <Link
              to="/register"
              className="font-heading font-semibold uppercase tracking-wide text-white transition hover:text-accent"
            >
              Register as Aspirant
            </Link>
            <Link
              to="/forgot-password"
              className="font-heading font-semibold uppercase tracking-wide text-accent transition hover:text-white"
            >
              Forgot Credentials
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
