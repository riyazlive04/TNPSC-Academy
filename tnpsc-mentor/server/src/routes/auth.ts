import { Router } from 'express'
import { supabaseAuthClient, supabaseAdmin } from '../supabase.js'
import { asyncH } from '../util.js'
import { isAllowedOrigin, googleEnabled } from '../config.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import {
  registerLoginSession,
  touchSession,
  revokeSession,
  revokeSessionById,
  listSessions,
  deviceLabel,
} from '../sessions.js'

const router = Router()

/** The device id the browser sends with auth calls (empty for legacy clients). */
function deviceId(req: { body?: { device_id?: unknown } }): string {
  return typeof req.body?.device_id === 'string' ? req.body.device_id : ''
}

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
    // Concurrent-device limit: block a new device once 2 others are active.
    const { blocked } = await registerLoginSession(
      data.session.user.id,
      deviceId(req),
      deviceLabel(req.headers['user-agent'])
    )
    if (blocked) {
      // Return the active devices so the browser can show them and let the user
      // sign one out (they've proven ownership with the correct password).
      const devices = await listSessions(data.session.user.id)
      return res.status(403).json({ error: 'device_limit', devices })
    }
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/login/replace-device ─────────────────────────────────────
// Reached after a `device_limit` block: the user picked an existing device to
// sign out so they can sign in here. We re-verify the password (no app token
// exists yet), revoke the chosen session, then claim this device's slot.
router.post(
  '/login/replace-device',
  asyncH(async (req, res) => {
    const { email, password, session_id } = req.body ?? {}
    if (!email || !password || !session_id) {
      return res.status(400).json({ error: 'Email, password and session_id are required' })
    }
    const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    })
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message ?? 'Invalid credentials' })
    }
    const userId = data.session.user.id
    // revokeSessionById is scoped to userId, so a forged session_id from another
    // account is a no-op rather than a cross-account sign-out.
    await revokeSessionById(userId, String(session_id))
    const { blocked } = await registerLoginSession(
      userId,
      deviceId(req),
      deviceLabel(req.headers['user-agent'])
    )
    if (blocked) {
      const devices = await listSessions(userId)
      return res.status(403).json({ error: 'device_limit', devices })
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
    // Record this device's session (a brand-new account is never over the limit).
    await registerLoginSession(
      data.session.user.id,
      deviceId(req),
      deviceLabel(req.headers['user-agent'])
    )
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

    // Concurrent-device limit (same rule as password login).
    const { blocked } = await registerLoginSession(
      data.session.user.id,
      deviceId(req),
      deviceLabel(req.headers['user-agent'])
    )
    if (blocked) {
      const devices = await listSessions(data.session.user.id)
      return res.status(403).json({ error: 'device_limit', devices })
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
    // Heartbeat this device + honour a remote sign-out (manage-devices revoke):
    // a revoked session fails to refresh, so that device logs out on its next try.
    const { revoked } = await touchSession(
      data.session.user.id,
      deviceId(req),
      deviceLabel(req.headers['user-agent'])
    )
    if (revoked) return res.status(401).json({ error: 'session_revoked' })
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
// The browser drops its tokens; here we also revoke this device's session row so
// it frees a slot for the 2-device limit. Best-effort and never fails the logout.
router.post(
  '/logout',
  asyncH(async (req, res) => {
    const dev = deviceId(req)
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    if (token && dev) {
      const { data } = await supabaseAdmin.auth.getUser(token)
      if (data.user) await revokeSession(data.user.id, dev)
    }
    res.json({ ok: true })
  })
)

// ─── GET /api/auth/sessions ──────────────────────────────────────────────────
// The signed-in user's active device sessions (manage-devices screen).
router.get(
  '/sessions',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    res.json({ sessions: await listSessions(req.userId!) })
  })
)

// ─── POST /api/auth/sessions/revoke ──────────────────────────────────────────
// Sign out one device by session id (frees a slot; that device logs out on its
// next token refresh).
router.post(
  '/sessions/revoke',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const id = typeof req.body?.id === 'string' ? req.body.id : ''
    if (!id) return res.status(400).json({ error: 'Session id required' })
    await revokeSessionById(req.userId!, id)
    res.json({ ok: true })
  })
)

export default router
