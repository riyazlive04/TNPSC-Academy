import { Router } from 'express'
import { supabaseAuthClient, supabaseAdmin } from '../supabase.js'
import { asyncH } from '../util.js'
import { isAllowedOrigin, googleEnabled } from '../config.js'
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
    const { fullName, email, phone, gender, password, targetGroup } = req.body ?? {}
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
      gender: gender ?? null,
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

// ─── POST /api/auth/google ───────────────────────────────────────────────────
// Sign in (or auto-create) with a Google ID token obtained in the browser via
// Google Identity Services. Supabase verifies the token's signature, expiry and
// audience (the Client ID must be in its "Authorized Client IDs" list), then
// mints the SAME access/refresh session the email/password flow returns. The
// `handle_new_user` DB trigger creates the profile row on first sign-in; we then
// enrich any still-empty name/email/avatar fields from Google's claims WITHOUT
// clobbering values the user may have since edited.
router.post(
  '/google',
  asyncH(async (req, res) => {
    if (!googleEnabled) {
      return res.status(503).json({ error: 'Google sign-in is not configured' })
    }
    const { idToken, nonce } = req.body ?? {}
    if (!idToken) return res.status(400).json({ error: 'Missing Google credential' })

    const { data, error } = await supabaseAuthClient.auth.signInWithIdToken({
      provider: 'google',
      token: String(idToken),
      ...(nonce ? { nonce: String(nonce) } : {}),
    })
    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: error?.message ?? 'Google sign-in failed' })
    }

    // Enrich only the fields that are currently empty, so a returning Google user
    // who edited their display name doesn't get it overwritten on every login.
    // Select the FULL row once and reuse it as the response profile — avoids a
    // second identical fetch in sessionPayload (one less Sydney round-trip, the
    // main source of the post-sign-in lag).
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const patch: Record<string, unknown> = {}
    if (!existing?.full_name && (meta.full_name || meta.name)) {
      patch.full_name = meta.full_name ?? meta.name
    }
    if (!existing?.email && data.user.email) patch.email = data.user.email
    if (!existing?.avatar_url && (meta.avatar_url || meta.picture)) {
      patch.avatar_url = meta.avatar_url ?? meta.picture
    }
    if (Object.keys(patch).length > 0) {
      const { error: enrichError } = await supabaseAdmin
        .from('profiles')
        .update(patch)
        .eq('id', data.user.id)
      // Non-fatal: a missing avatar_url column (migration not yet run) only loses
      // the avatar — the session is still valid. Log so it's visible, don't fail.
      if (enrichError) {
        console.error('[google] profile enrich failed', data.user.id, enrichError.message)
      }
    }

    // Returning user: reuse the row we already have (merged with any enrichment).
    // First sign-in only: the handle_new_user trigger may not have committed the
    // row yet when we selected, so fall back to a fresh fetch via sessionPayload.
    if (existing) {
      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user.id },
        profile: { ...existing, ...patch },
      })
    } else {
      res.json(await sessionPayload(data.session))
    }
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
