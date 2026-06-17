import { Router } from 'express'
import { supabaseAuthClient, supabaseAdmin } from '../supabase.js'
import { asyncH } from '../util.js'
import { isAllowedOrigin } from '../config.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

/** Shape returned to the browser after a successful auth call. */
async function sessionPayload(session: {
  access_token: string
  refresh_token: string
  user: { id: string }
}) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user: { id: session.user.id },
    profile: profile ?? null,
  }
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  asyncH(async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    })
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message ?? 'Invalid credentials' })
    }
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  '/register',
  asyncH(async (req, res) => {
    const { fullName, email, phone, password, targetGroup } = req.body ?? {}
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Name, email and password are required' })
    }
    const { data, error } = await supabaseAuthClient.auth.signUp({
      email: String(email).trim(),
      password: String(password),
      options: { data: { full_name: fullName } },
    })
    if (error || !data.user) {
      return res.status(400).json({ error: error?.message ?? 'Sign up failed' })
    }

    // Enrich the profile row created by the DB trigger (best-effort, but log
    // failures so a silent partial-write — user created with no name/phone —
    // is visible in server logs rather than swallowed entirely).
    const { error: enrichError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName,
      email: String(email).trim(),
      phone: phone ?? null,
      target_group: targetGroup ?? null,
    })
    if (enrichError) {
      console.error('[register] profile enrich failed', data.user.id, enrichError.message)
    }

    // Email-confirmation projects return no session on signup — surface that.
    if (!data.session) {
      return res.json({ requiresConfirmation: true })
    }
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post(
  '/refresh',
  asyncH(async (req, res) => {
    const { refresh_token } = req.body ?? {}
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh token' })
    const { data, error } = await supabaseAuthClient.auth.refreshSession({
      refresh_token: String(refresh_token),
    })
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message ?? 'Could not refresh session' })
    }
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post(
  '/forgot-password',
  asyncH(async (req, res) => {
    const { email, redirectTo } = req.body ?? {}
    if (!email) return res.status(400).json({ error: 'Email is required' })
    // Only honour a client-supplied redirectTo if its origin is in our CORS
    // allow-list — otherwise it's an open-redirect / phishing vector (the reset
    // link in the email would carry the victim to an attacker-controlled page).
    let safeRedirect: string | undefined
    if (redirectTo) {
      try {
        if (isAllowedOrigin(new URL(String(redirectTo)).origin)) {
          safeRedirect = String(redirectTo)
        }
      } catch {
        /* malformed URL → ignore, fall back to Supabase's configured default */
      }
    }
    const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(
      String(email).trim(),
      safeRedirect ? { redirectTo: safeRedirect } : undefined
    )
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  })
)

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Re-hydrate the current user + profile from a stored access token on app boot.
router.get(
  '/me',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.userId!)
      .single()
    res.json({ user: { id: req.userId }, profile: profile ?? null })
  })
)

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// Stateless JWTs: the browser simply drops its tokens. Endpoint exists for
// symmetry and future server-side revocation.
router.post('/logout', (_req, res) => res.json({ ok: true }))

export default router
