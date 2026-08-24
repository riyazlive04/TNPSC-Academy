import { Router, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { supabaseAuthClient, supabaseAdmin } from '../supabase.js'
import { asyncH } from '../util.js'
import {
  config,
  isAllowedOrigin,
  googleEnabled,
  msg91Enabled,
  whatsappOtpEnabled,
  telegramVerifyEnabled,
} from '../config.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js'
import {
  registerLoginSession,
  touchSession,
  revokeSession,
  revokeSessionById,
  revokeSessionByDeviceId,
  listSessions,
  deviceLabel,
  clientPlatform,
  sessionIdFromToken,
  type DeviceSession,
} from '../sessions.js'
import { normalizeMobile, sendOtp, verifyOtp } from '../lib/msg91.js'
import { phoneTakenByOther } from '../lib/phone.js'
import { checkPassword } from '../lib/passwordPolicy.js'
import {
  issueOtpTicket,
  verifyOtpTicket,
  issuePhoneVerifyTicket,
  verifyPhoneVerifyTicket,
  issueTotpStepUpTicket,
  verifyTotpStepUpTicket,
} from '../lib/otpTicket.js'
import { sendSignupOtp, verifySignupOtp } from '../lib/whatsappOtp.js'
import {
  generateSecret,
  verifyToken as verifyTotpToken,
  enrollmentQr,
  generateBackupCodes,
  consumeBackupCode,
} from '../lib/totp.js'
import { auditAuth, clientIp } from '../lib/audit.js'
import { recordAuthFailure } from '../lib/securityAlerts.js'

const router = Router()

/** The device id the browser sends with auth calls (empty for legacy clients). */
function deviceId(req: { body?: { device_id?: unknown } }): string {
  return typeof req.body?.device_id === 'string' ? req.body.device_id : ''
}

/**
 * Identity the device-limit binds to. Prefer the un-forgeable GoTrue `session_id`
 * carried in the freshly-minted access token; fall back to the client `device_id`
 * only for legacy tokens that lack the claim. Using the session id means the cap
 * counts REAL sessions — a client can no longer pin one id to share an account, or
 * rotate ids to evict the owner, because it doesn't choose this value.
 */
function deviceKey(accessToken: string | undefined, req: { body?: { device_id?: unknown } }): string {
  return sessionIdFromToken(accessToken) || deviceId(req)
}

// ─── Refresh-token cookie (web only) ─────────────────────────────────────────
// The WEB client keeps its refresh token in this HttpOnly cookie — unreadable by
// JS, so an XSS can't exfiltrate it (the durable credential). The native app
// can't rely on cross-site cookies in the Android WebView, so it continues to
// receive the refresh token in the JSON body and send it back explicitly; both
// transports are supported in parallel.
const RT_COOKIE = 'tnpsc_rt'
const RT_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000 // 60 days
// Scoped to /api/auth so the cookie is only ever sent to the auth endpoints that
// need it (login/refresh/logout), never to data routes.
const RT_PATH = '/api/auth'

/** Persist the refresh token in the HttpOnly cookie (web path). Harmless for the
 * native app, which ignores it and uses the body token instead. */
function setRtCookie(res: Response, refreshToken: string): void {
  res.cookie(RT_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: RT_PATH,
    maxAge: RT_MAX_AGE_MS,
  })
}

/** Clear the refresh-token cookie on logout. */
function clearRtCookie(res: Response): void {
  res.clearCookie(RT_COOKIE, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: RT_PATH,
  })
}

// ─── Brute-force / abuse limiters ────────────────────────────────────────────
// The global /api/auth limiter (30/min/IP, see index.ts) is a coarse net. These
// are per-CREDENTIAL and per-ACTION so password guessing, credential stuffing and
// reset-email bombing stay bounded no matter how the attacker spreads requests.

/** Key on the targeted email + client IP, so guessing ONE account is throttled
 * even across many IPs, and one IP can't fan out across many accounts unchecked. */
function emailIpKey(req: Request): string {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  return `${email}|${req.ip}`
}

/** Failed sign-ins per email+IP. Successful logins are skipped, so a legitimate
 * user is never locked out by their own activity — only wrong guesses count. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 8,
  keyGenerator: emailIpKey,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
})

/** Sign-ups and password-reset emails per email+IP — stops inbox flooding and
 * automated account spam. Counts every attempt (success included). */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  keyGenerator: emailIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many attempts. Please wait a while and try again.' },
})

/** Token-based endpoints (Google sign-in, refresh) keyed by IP — no password to
 * guess, but caps replay / refresh floods from a single source. */
const tokenLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many requests. Please slow down.' },
})

/** Key OTP limits on the targeted phone + client IP — same rationale as
 * emailIpKey: throttle hammering ONE number across IPs and one IP fanning out
 * across numbers. */
function phoneIpKey(req: Request): string {
  const phone =
    typeof req.body?.phone === 'string' ? normalizeMobile(req.body.phone) : ''
  return `${phone}|${req.ip}`
}

/** OTP sends per phone+IP. Every send costs an SMS and risks inbox spam, so this
 * is tight — counts success and failure alike. */
const otpSendLimiter = rateLimit({
  windowMs: 30 * 60_000,
  max: 5,
  keyGenerator: phoneIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many OTP requests. Please wait a while and try again.' },
})

/** OTP verification attempts per phone+IP — bounds code-guessing. Successful
 * verifications are skipped so a real user is never locked out by signing in. */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyGenerator: phoneIpKey,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many attempts. Please request a new code.' },
})

/** Device list for the PRE-AUTH device-limit screen. Strips the raw device_id —
 * a fingerprint an attacker who has the password could otherwise harvest to spoof
 * or evict sessions. The client only needs the opaque session `id` to sign one
 * out (label + last_seen are display-only). */
function publicDevices(list: DeviceSession[]) {
  return list.map((d) => ({
    id: d.id,
    label: d.label,
    created_at: d.created_at,
    last_seen_at: d.last_seen_at,
  }))
}

/** Strip fields that must never reach the client — see admin_totp.sql. The
 * secret and backup-code hashes are server-only; `totp_enabled` is just a
 * status flag and is fine to keep. Applied everywhere a profile row (fetched
 * with `select('*')`) is serialized into a response. */
function stripTotpSecrets<T extends Record<string, unknown> | null>(profile: T): T {
  if (!profile) return profile
  const { totp_secret: _s, totp_backup_codes: _b, ...rest } = profile
  return rest as T
}

/**
 * If `userId` is admin/superadmin with totp_enabled, returns the body /login
 * and /google should send instead of a session (a step-up ticket) — null
 * means no TOTP gate applies and the caller should proceed to mint the
 * session as normal. Never claims a device slot; that only happens once
 * /totp/step-up succeeds.
 */
async function requireTotpStepUp(
  req: Request,
  userId: string
): Promise<{ totpRequired: true; ticket: string } | null> {
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('role, totp_enabled')
    .eq('id', userId)
    .single()
  const role = prof?.role as string | undefined
  if ((role === 'admin' || role === 'superadmin') && prof?.totp_enabled) {
    auditAuth(req, 'totp_challenge', { subjectId: userId, status: 200 })
    return { totpRequired: true, ticket: issueTotpStepUpTicket(userId) }
  }
  return null
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
    profile: stripTotpSecrets(profile) ?? null,
  }
}

// ─── GET /api/auth/config ─────────────────────────────────────────────────────
// The single source of truth for which optional auth methods are live. Every
// `*Enabled` constant here already gates its own routes (503 when unset); this
// just exposes the same booleans so the client can show/hide UI for them
// WITHOUT a separately hand-maintained set of VITE_* build flags that has to be
// kept in sync by hand — that drift is exactly what let the WhatsApp-OTP UI lag
// behind the server being armed for it in the past. Public, no auth required.
router.get(
  '/config',
  asyncH(async (_req, res) => {
    res.json({
      google: googleEnabled,
      whatsappOtp: whatsappOtpEnabled,
      telegramVerify: telegramVerifyEnabled,
      phoneOtp: msg91Enabled,
    })
  })
)

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
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
      // Constant, generic message: never echo GoTrue's text (which can distinguish
      // "wrong password" from "no such user" → account enumeration). The audit
      // entry follows the same rule — it records the attempt and its IP but NOT
      // whether the address exists, so the trail can't be read as an oracle.
      auditAuth(req, 'login_failed', { status: 401 })
      recordAuthFailure(clientIp(req), { route: 'login' })
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    // Privileged accounts with TOTP enrolled must clear a step-up challenge
    // before a session — or a device slot — is ever granted. Checked BEFORE
    // registerLoginSession so a pending step-up never consumes the cap.
    const totpGate = await requireTotpStepUp(req, data.session.user.id)
    if (totpGate) return res.json(totpGate)
    // Concurrent-device limit: block a new device once 2 others are active.
    const { blocked } = await registerLoginSession(
      data.session.user.id,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      // Return the active devices so the browser can show them and let the user
      // sign one out (they've proven ownership with the correct password). The
      // raw device_id is stripped — see publicDevices.
      const devices = publicDevices(await listSessions(data.session.user.id))
      auditAuth(req, 'login_device_limit', { subjectId: data.session.user.id, status: 403 })
      return res.status(403).json({ error: 'device_limit', devices })
    }
    auditAuth(req, 'login_success', {
      subjectId: data.session.user.id,
      status: 200,
      detail: { device: deviceLabel(req.headers['user-agent']), platform: clientPlatform(req) },
    })
    setRtCookie(res, data.session.refresh_token)
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/login/replace-device ─────────────────────────────────────
// Reached after a `device_limit` block: the user picked an existing device to
// sign out so they can sign in here. We re-verify the password (no app token
// exists yet), revoke the chosen session, then claim this device's slot.
router.post(
  '/login/replace-device',
  loginLimiter,
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
      auditAuth(req, 'login_failed', { status: 401, detail: { route: 'replace-device' } })
      recordAuthFailure(clientIp(req), { route: 'login/replace-device' })
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const userId = data.session.user.id
    // revokeSessionById is scoped to userId, so a forged session_id from another
    // account is a no-op rather than a cross-account sign-out. Signing another
    // device out is exactly what a session hijacker would do, so it is audited.
    auditAuth(req, 'login_device_replaced', { subjectId: userId, status: 200 })
    await revokeSessionById(userId, String(session_id))
    const { blocked } = await registerLoginSession(
      userId,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(userId))
      return res.status(403).json({ error: 'device_limit', devices })
    }
    setRtCookie(res, data.session.refresh_token)
    res.json(await sessionPayload(data.session))
  })
)

/**
 * How an email is already registered (service-role-only RPC over auth.users):
 * 'none' | 'google' | 'password'. Fails OPEN to 'none' on a lookup error — GoTrue
 * still rejects a true duplicate at signUp, so the worst case is a generic (not a
 * tailored) message, never a wrongly-let-through account.
 */
async function emailStatus(email: string): Promise<'none' | 'google' | 'password'> {
  const { data, error } = await supabaseAdmin.rpc('email_registration_status', { p_email: email })
  if (error) {
    console.error('[email-unique] status lookup failed', error.message)
    return 'none'
  }
  const s = String(data ?? 'none')
  return s === 'google' || s === 'password' ? s : 'none'
}

// ─── Signup phone verification (WhatsApp OTP via AiSensy) ─────────────────────
// Proves the user OWNS the number BEFORE the account exists: send a code to the
// number's WhatsApp, verify it, and hand back a short-lived signed ticket that
// /register then requires. Reuses the login-OTP rate limiters (phone+IP).

// POST /api/auth/register/otp/send — deliver a code to a number being signed up.
// Only for numbers NOT yet on an account (mirror of /otp/send, which is only for
// numbers that ARE) — rejecting here saves a message and matches what /register
// would say anyway. Note: the official WhatsApp API has no "is this number on
// WhatsApp" lookup, so a WhatsApp-less number is accepted here and simply never
// receives the message (the old Evolution gateway could pre-reject those).
router.post(
  '/register/otp/send',
  otpSendLimiter,
  asyncH(async (req, res) => {
    if (!whatsappOtpEnabled) {
      return res.status(503).json({ error: 'Phone verification is not configured' })
    }
    const phone = normalizeMobile(typeof req.body?.phone === 'string' ? req.body.phone : '')
    if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' })
    if (await phoneTakenByOther(phone)) {
      return res.status(409).json({ error: 'phone_already_registered' })
    }
    const result = await sendSignupOtp(phone)
    if (!result.ok) {
      // Distinct codes so the UI can give a precise nudge.
      if (result.code === 'cooldown') return res.status(429).json({ error: 'otp_cooldown' })
      console.error('[register/otp/send] send failed', phone, result.code)
      return res.status(502).json({ error: 'Could not send the code right now. Please try again.' })
    }
    res.json({ ok: true })
  })
)

// POST /api/auth/register/otp/verify — check the code; success returns the
// phone-verified ticket /register demands.
router.post(
  '/register/otp/verify',
  otpVerifyLimiter,
  asyncH(async (req, res) => {
    if (!whatsappOtpEnabled) {
      return res.status(503).json({ error: 'Phone verification is not configured' })
    }
    const phone = normalizeMobile(typeof req.body?.phone === 'string' ? req.body.phone : '')
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and code are required' })
    const check = await verifySignupOtp(phone, otp)
    if (!check.ok) {
      // 401 invalid guess (retryable), 410 dead code (expired / guess budget
      // spent) — the UI sends the user back to "resend" on 410. A run of wrong
      // guesses is the same signal as a run of wrong passwords, so it feeds the
      // same detector.
      const status = check.code === 'invalid' ? 401 : 410
      recordAuthFailure(clientIp(req), { route: 'register/otp/verify' })
      return res.status(status).json({ error: `otp_${check.code}` })
    }
    res.json({ ticket: issuePhoneVerifyTicket(phone) })
  })
)

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  '/register',
  sensitiveLimiter,
  asyncH(async (req, res) => {
    const { fullName, email, phone, gender, password, targetGroup } = req.body ?? {}
    if (!email || !password || !fullName) {
      console.log('[register-400]', 'missing_fields', { hasEmail: !!email, hasPassword: !!password, hasFullName: !!fullName })
      return res.status(400).json({ error: 'Name, email and password are required' })
    }
    // Server-side floor — the client already enforces this, but that alone is
    // trivially bypassed with curl. Checked before any DB round-trip below.
    const pwCheck = await checkPassword(String(password))
    if (!pwCheck.ok) {
      console.log('[register-400]', `password_${pwCheck.code}`)
      return res.status(400).json({ error: `password_${pwCheck.code}` })
    }
    // One mobile number = one account. Reject BEFORE creating the auth user so a
    // duplicate number never leaves an orphaned GoTrue user behind.
    const normalizedPhone = typeof phone === 'string' ? normalizeMobile(phone) : ''
    if (normalizedPhone && (await phoneTakenByOther(normalizedPhone))) {
      return res.status(409).json({ error: 'phone_already_registered' })
    }
    // WhatsApp-OTP gate: when configured, an account can only be created with a
    // phone whose ownership was JUST proven (the /register/otp/verify ticket).
    // Enforced server-side — the client flow alone would be trivial to curl past.
    if (whatsappOtpEnabled) {
      if (!normalizedPhone) {
        console.log('[register-400]', 'invalid_phone', { rawPhone: phone })
        return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' })
      }
      const ticketPhone = verifyPhoneVerifyTicket(String(req.body?.phoneTicket ?? ''))
      if (!ticketPhone || ticketPhone !== normalizedPhone) {
        return res.status(403).json({ error: 'phone_not_verified' })
      }
    }
    // One email = one account, and an email already registered THROUGH GOOGLE must
    // not become an email/password account — send those users to Google sign-in.
    const emailTrim = String(email).trim()
    const eStatus = await emailStatus(emailTrim)
    if (eStatus === 'google') {
      return res.status(409).json({ error: 'email_registered_google' })
    }
    if (eStatus === 'password') {
      return res.status(409).json({ error: 'email_already_registered' })
    }
    const { data, error } = await supabaseAuthClient.auth.signUp({
      email: emailTrim,
      password: String(password),
      options: { data: { full_name: fullName } },
    })
    if (error || !data.user) {
      // Don't echo GoTrue's message ("User already registered" confirms an email
      // exists → enumeration). Log the real reason server-side, return a soft,
      // non-confirming message to the client.
      console.error('[register] sign-up failed', String(email).trim(), error?.message)
      return res.status(400).json({
        error: 'Could not complete sign up. If you already have an account, please sign in instead.',
      })
    }

    // Enrich the profile row created by the DB trigger (best-effort, but log
    // failures so a silent partial-write — user created with no name/phone —
    // is visible in server logs rather than swallowed entirely).
    const { error: enrichError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName,
      email: String(email).trim(),
      phone: normalizedPhone || null,
      gender: gender ?? null,
      target_group: targetGroup ?? null,
    })
    if (enrichError) {
      console.error('[register] profile enrich failed', data.user.id, enrichError.message)
    }

    auditAuth(req, 'register_success', {
      subjectId: data.user.id,
      status: 200,
      detail: { platform: clientPlatform(req) },
    })

    // Email-confirmation projects return no session on signup — surface that.
    if (!data.session) {
      return res.json({ requiresConfirmation: true })
    }
    // Record this device's session (a brand-new account is never over the limit).
    await registerLoginSession(
      data.session.user.id,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    setRtCookie(res, data.session.refresh_token)
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
  tokenLimiter,
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
      return res.status(401).json({ error: 'Google sign-in failed' })
    }

    // Same TOTP step-up gate as password login, checked before the device cap.
    const totpGate = await requireTotpStepUp(req, data.session.user.id)
    if (totpGate) return res.json(totpGate)

    // Concurrent-device limit (same rule as password login).
    const { blocked } = await registerLoginSession(
      data.session.user.id,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(data.session.user.id))
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
    // Avatar RE-SYNCS on every Google login (unlike name/email, which are set once
    // so a user's in-app edits survive): keep the photo tracking their current
    // Google picture. Only write when it actually changed, to skip a no-op update.
    const googlePic = (meta.avatar_url ?? meta.picture) as string | undefined
    if (googlePic && googlePic !== existing?.avatar_url) {
      patch.avatar_url = googlePic
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

    auditAuth(req, 'oauth_login_success', {
      subjectId: data.user.id,
      status: 200,
      detail: { method: 'google', device: deviceLabel(req.headers['user-agent']), platform: clientPlatform(req) },
    })

    // Returning user: reuse the row we already have (merged with any enrichment).
    // First sign-in only: the handle_new_user trigger may not have committed the
    // row yet when we selected, so fall back to a fresh fetch via sessionPayload.
    if (existing) {
      setRtCookie(res, data.session.refresh_token)
      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user.id },
        profile: stripTotpSecrets({ ...existing, ...patch }),
      })
    } else {
      setRtCookie(res, data.session.refresh_token)
      res.json(await sessionPayload(data.session))
    }
  })
)

// ─── POST /api/auth/google/replace-device ────────────────────────────────────
// Reached after a Google-login `device_limit` block: the user picked a device to
// sign out. Google sign-in has no password, so ownership is re-proven by
// re-verifying the same ID token (a Google ID token stays valid for ~1 hour and
// can be verified more than once). We revoke the chosen session, then claim this
// device's slot — mirroring /login/replace-device.
router.post(
  '/google/replace-device',
  tokenLimiter,
  asyncH(async (req, res) => {
    if (!googleEnabled) {
      return res.status(503).json({ error: 'Google sign-in is not configured' })
    }
    const { idToken, session_id, nonce } = req.body ?? {}
    if (!idToken || !session_id) {
      return res.status(400).json({ error: 'Missing Google credential or session_id' })
    }
    const { data, error } = await supabaseAuthClient.auth.signInWithIdToken({
      provider: 'google',
      token: String(idToken),
      ...(nonce ? { nonce: String(nonce) } : {}),
    })
    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: 'Google sign-in failed' })
    }
    const userId = data.session.user.id
    // revokeSessionById is scoped to userId, so a forged session_id from another
    // account is a no-op rather than a cross-account sign-out.
    await revokeSessionById(userId, String(session_id))
    const { blocked } = await registerLoginSession(
      userId,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(userId))
      return res.status(403).json({ error: 'device_limit', devices })
    }
    setRtCookie(res, data.session.refresh_token)
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post(
  '/refresh',
  tokenLimiter,
  asyncH(async (req, res) => {
    // Web sends the refresh token via the HttpOnly cookie; native sends it in the
    // body. Accept either, preferring the body (native) when both are present.
    const bodyToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : ''
    const cookieToken =
      typeof req.cookies?.[RT_COOKIE] === 'string' ? (req.cookies[RT_COOKIE] as string) : ''
    const refresh_token = bodyToken || cookieToken
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh token' })
    const { data, error } = await supabaseAuthClient.auth.refreshSession({
      refresh_token: String(refresh_token),
    })
    if (error || !data.session) {
      // The refresh token is dead/rotated → drop the cookie so the browser stops
      // sending a stale one on every retry.
      clearRtCookie(res)
      return res.status(401).json({ error: 'Could not refresh session' })
    }
    // Heartbeat this device + honour a remote sign-out (manage-devices revoke):
    // a revoked session fails to refresh, so that device logs out on its next try.
    // The refreshed token keeps the SAME session_id, so this matches the row
    // created at login.
    const { revoked } = await touchSession(
      data.session.user.id,
      deviceKey(data.session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (revoked) {
      clearRtCookie(res)
      return res.status(401).json({ error: 'session_revoked' })
    }
    // Supabase rotates the refresh token on every refresh — persist the new one
    // back to the cookie (web). Native picks the new token up from the body.
    setRtCookie(res, data.session.refresh_token)
    res.json(await sessionPayload(data.session))
  })
)

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post(
  '/forgot-password',
  sensitiveLimiter,
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
    // Audited without the address, for the same non-disclosure reason the
    // response is constant: what matters to an investigation is that a reset was
    // requested from this IP at this time.
    auditAuth(req, 'password_reset_requested', { status: 200 })
    // Always answer { ok: true } regardless of outcome: a differential response
    // (or a raw GoTrue error) would reveal whether the email has an account.
    // Log the real error server-side for diagnostics.
    if (error) console.error('[forgot-password] reset failed', String(email).trim(), error.message)
    res.json({ ok: true })
  })
)

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Completes the flow /forgot-password starts. The browser can't do this itself:
// the SPA has no Supabase client and no anon key (everything goes through this
// API), so the recovery credential from the email has to be redeemed here.
//
// GoTrue verifies the emailed link on its own /auth/v1/verify and then redirects
// to our page with the proof attached. Which form it takes depends on the email
// template, so accept both:
//   #access_token=…&type=recovery   default template, a real (short-lived) session
//   ?token_hash=…&type=recovery     {{ .TokenHash }} template, single-use
router.post(
  '/reset-password',
  sensitiveLimiter,
  asyncH(async (req, res) => {
    const { access_token: accessTokenIn, token_hash: tokenHash, password } = req.body ?? {}
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'A new password is required.' })
    }
    // Same floor /register enforces, so a reset can't set a password that
    // signing up would have rejected.
    const pwCheck = await checkPassword(password)
    if (!pwCheck.ok) {
      return res.status(400).json({
        error:
          pwCheck.code === 'too_short'
            ? 'Password must be at least 8 characters.'
            : 'This password has appeared in a known data breach. Please choose a different one.',
      })
    }
    if (!accessTokenIn && !tokenHash) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    }

    // Redeem a token_hash into a session; an access_token already is one.
    let accessToken = typeof accessTokenIn === 'string' ? accessTokenIn : ''
    if (!accessToken && typeof tokenHash === 'string') {
      const { data, error } = await supabaseAuthClient.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,
      })
      if (error || !data.session) {
        console.error('[reset-password] verifyOtp failed', error?.message)
        return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
      }
      accessToken = data.session.access_token
    }

    // Resolve the token to a user. This is the authorisation check — only the
    // holder of a valid recovery credential for this account gets past here, and
    // an expired or forged one resolves to nothing.
    const { data: userData, error: userErr } = await supabaseAuthClient.auth.getUser(accessToken)
    const user = userData?.user
    if (userErr || !user) {
      console.error('[reset-password] token did not resolve to a user', userErr?.message)
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    }

    // Service-role write: the recovery session is deliberately low-privilege and
    // updating a password through it is refused on some projects.
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: String(password),
    })
    if (updErr) {
      console.error('[reset-password] update failed', user.id, updErr.message)
      // GoTrue's own text here is user-facing and useful ("password is too weak",
      // "New password should be different from the old password").
      return res.status(400).json({ error: updErr.message })
    }

    auditAuth(req, 'password_reset_completed', { status: 200, subjectId: user.id })
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
    res.json({ user: { id: req.userId }, profile: stripTotpSecrets(profile) ?? null })
  })
)

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// The browser drops its tokens; here we also revoke this device's session row so
// it frees a slot for the 2-device limit. Best-effort and never fails the logout.
router.post(
  '/logout',
  asyncH(async (req, res) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    // Bind to the token's session_id (fall back to the client device_id for legacy
    // sessions) so logout revokes the same row login created.
    const key = sessionIdFromToken(token) || deviceId(req)
    let revoked = false
    if (token && key) {
      const { data } = await supabaseAdmin.auth.getUser(token)
      if (data.user) {
        await revokeSession(data.user.id, key)
        revoked = true
      }
    }
    // If the access token was already expired (getUser failed) we couldn't resolve
    // the owner above, so the slot would leak. Fall back to revoking directly by
    // the supplied session key — the caller possesses it, which is enough to free
    // its own row — so an expired-token logout still releases the device slot.
    if (!revoked && key) {
      await revokeSessionByDeviceId(key)
    }
    // Drop the web refresh-token cookie so the browser can't silently re-auth.
    clearRtCookie(res)
    auditAuth(req, 'logout', { status: 200 })
    res.json({ ok: true })
  })
)

// ─── GET /api/auth/sessions ──────────────────────────────────────────────────
// The signed-in user's active device sessions (manage-devices screen).
router.get(
  '/sessions',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Flag the caller's own session via the token's session_id, and strip the raw
    // device_id/session key from the response — the client only needs the opaque
    // row `id` (to revoke) and the `current` flag (to mark "this device").
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    const list = await listSessions(req.userId!, sessionIdFromToken(token))
    const sessions = list.map((d) => ({
      id: d.id,
      label: d.label,
      created_at: d.created_at,
      last_seen_at: d.last_seen_at,
      current: !!d.current,
    }))
    res.json({ sessions })
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

// ─── Phone-OTP login (alternate to email/password) ───────────────────────────
// Identity stays in Supabase: a phone-OTP login proves the user owns the number
// on their profile, then we mint the SAME GoTrue session the password flow
// returns (via an admin magic-link token), so the device cap, refresh cookie and
// every downstream RLS rule behave identically. MSG91 owns the OTP itself.

/**
 * Resolve the single account that owns a phone number. Matches the bare 10-digit
 * form plus the +91/91/0 variants the signup form accepts, so rows stored in any
 * of those shapes still resolve. Returns the AUTH email (the magic-link source of
 * truth), not profiles.email which can be stale/empty.
 */
async function findUserByPhone(
  tenDigit: string
): Promise<{ userId: string; email: string } | { error: 'not_found' | 'ambiguous' }> {
  const variants = [tenDigit, `+91${tenDigit}`, `91${tenDigit}`, `0${tenDigit}`]
  const { data } = await supabaseAdmin.from('profiles').select('id').in('phone', variants)
  if (!data || data.length === 0) return { error: 'not_found' }
  // More than one account on a number is ambiguous — we can't safely pick one, so
  // fall back to email sign-in rather than guess.
  if (data.length > 1) return { error: 'ambiguous' }
  const userId = data[0].id as string
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = userRes?.user?.email ?? ''
  if (!email) return { error: 'not_found' }
  return { userId, email }
}

/**
 * Mint a real GoTrue session for an existing user WITHOUT a password: generate a
 * magic-link token server-side (admin.generateLink does NOT email anything) and
 * immediately exchange it for a session. Caller must have already proven identity
 * (a verified OTP, or a valid OTP ticket). Returns null on any failure.
 */
async function mintSessionForEmail(email: string) {
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashed = link?.properties?.hashed_token
  if (linkErr || !hashed) return null
  const { data: verified, error: verErr } = await supabaseAuthClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  })
  if (verErr || !verified.session) return null
  return verified.session
}

// ─── POST /api/auth/otp/send ─────────────────────────────────────────────────
// Send a login code — but ONLY to a number that already owns an account. That
// gives the user a clear "no account" signal AND stops the endpoint being abused
// to spray SMS at arbitrary numbers (each send costs money).
router.post(
  '/otp/send',
  otpSendLimiter,
  asyncH(async (req, res) => {
    if (!msg91Enabled) return res.status(503).json({ error: 'Phone sign-in is not configured' })
    const phone = normalizeMobile(typeof req.body?.phone === 'string' ? req.body.phone : '')
    if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' })

    const found = await findUserByPhone(phone)
    if ('error' in found) {
      if (found.error === 'ambiguous') {
        return res.status(409).json({
          error: 'This number is linked to more than one account. Please sign in with email.',
        })
      }
      // Distinct code so the UI can nudge the user to sign up / use email.
      return res.status(404).json({ error: 'phone_not_registered' })
    }
    const result = await sendOtp(phone)
    if (!result.ok) {
      console.error('[otp/send] MSG91 send failed', phone, result.message)
      return res.status(502).json({ error: 'Could not send the code right now. Please try again.' })
    }
    res.json({ ok: true })
  })
)

// ─── POST /api/auth/otp/verify ───────────────────────────────────────────────
// Verify the code with MSG91, mint the session, enforce the 2-device limit. On a
// device-limit block we return a short-lived ticket so the client can replace a
// device without re-sending the (now-spent) OTP.
router.post(
  '/otp/verify',
  otpVerifyLimiter,
  asyncH(async (req, res) => {
    if (!msg91Enabled) return res.status(503).json({ error: 'Phone sign-in is not configured' })
    const phone = normalizeMobile(typeof req.body?.phone === 'string' ? req.body.phone : '')
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and code are required' })

    const found = await findUserByPhone(phone)
    if ('error' in found) return res.status(404).json({ error: 'phone_not_registered' })

    const check = await verifyOtp(phone, otp)
    if (!check.ok) {
      auditAuth(req, 'login_failed', {
        subjectId: found.userId,
        status: 401,
        detail: { route: 'otp/verify' },
      })
      recordAuthFailure(clientIp(req), { route: 'otp/verify' })
      return res.status(401).json({ error: 'Invalid or expired code' })
    }

    const session = await mintSessionForEmail(found.email)
    if (!session) {
      console.error('[otp/verify] session mint failed', found.userId)
      return res.status(500).json({ error: 'Could not complete sign in. Please try again.' })
    }

    const { blocked } = await registerLoginSession(
      session.user.id,
      deviceKey(session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(session.user.id))
      auditAuth(req, 'login_device_limit', { subjectId: session.user.id, status: 403 })
      // Ticket lets /otp/replace-device finish without a fresh OTP (already spent).
      return res
        .status(403)
        .json({ error: 'device_limit', devices, ticket: issueOtpTicket(session.user.id) })
    }
    auditAuth(req, 'login_success', {
      subjectId: session.user.id,
      status: 200,
      detail: { method: 'phone_otp', device: deviceLabel(req.headers['user-agent']), platform: clientPlatform(req) },
    })
    setRtCookie(res, session.refresh_token)
    res.json(await sessionPayload(session))
  })
)

// ─── POST /api/auth/otp/replace-device ───────────────────────────────────────
// Reached after an OTP-login device_limit block: the user chose a device to sign
// out. We trust the short-lived ticket (proof the OTP just succeeded) instead of
// a fresh code, revoke the chosen session, then claim this device's slot.
router.post(
  '/otp/replace-device',
  otpVerifyLimiter,
  asyncH(async (req, res) => {
    if (!msg91Enabled) return res.status(503).json({ error: 'Phone sign-in is not configured' })
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket : ''
    const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id : ''
    if (!ticket || !sessionId) {
      return res.status(400).json({ error: 'Missing ticket or session_id' })
    }
    const userId = verifyOtpTicket(ticket)
    if (!userId) {
      return res
        .status(401)
        .json({ error: 'Your sign-in window expired. Please request a new code.' })
    }
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (!email) return res.status(404).json({ error: 'Account not found' })

    // revokeSessionById is scoped to userId, so a forged session_id is a no-op.
    await revokeSessionById(userId, sessionId)
    const session = await mintSessionForEmail(email)
    if (!session) {
      return res.status(500).json({ error: 'Could not complete sign in. Please try again.' })
    }
    const { blocked } = await registerLoginSession(
      session.user.id,
      deviceKey(session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(session.user.id))
      return res
        .status(403)
        .json({ error: 'device_limit', devices, ticket: issueOtpTicket(session.user.id) })
    }
    setRtCookie(res, session.refresh_token)
    res.json(await sessionPayload(session))
  })
)

// ─── TOTP two-factor authentication (admin/superadmin) ───────────────────────
// Enrollment is self-service from Profile → Security (requireAdmin: any admin
// or superadmin may set it up for their OWN account only — req.userId is
// always the acting user, there is no "set up 2FA for someone else" path).
// The login-time challenge itself is issued by requireTotpStepUp() inside
// /login and /google above; /totp/step-up below is where it's redeemed.

router.post(
  '/totp/enroll',
  requireAuth,
  requireAdmin,
  asyncH(async (req: AuthedRequest, res) => {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('email, totp_enabled')
      .eq('id', req.userId!)
      .single()
    if (prof?.totp_enabled) {
      return res.status(409).json({ error: 'Two-factor authentication is already enabled.' })
    }
    const secret = generateSecret()
    // Persisted immediately (but NOT yet active — totp_enabled stays false)
    // so /totp/confirm can verify the first code without the secret ever
    // needing to round-trip through the client in between.
    await supabaseAdmin.from('profiles').update({ totp_secret: secret }).eq('id', req.userId!)
    const qr = await enrollmentQr(prof?.email ?? req.userId!, secret)
    res.json({ secret, qr })
  })
)

router.post(
  '/totp/confirm',
  requireAuth,
  requireAdmin,
  asyncH(async (req: AuthedRequest, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!code) return res.status(400).json({ error: 'Enter the 6-digit code from your app.' })
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('totp_secret')
      .eq('id', req.userId!)
      .single()
    if (!prof?.totp_secret) {
      return res.status(400).json({ error: 'Start enrollment first.' })
    }
    if (!(await verifyTotpToken(prof.totp_secret, code))) {
      recordAuthFailure(clientIp(req), { route: 'totp/confirm' })
      return res.status(401).json({ error: 'Invalid code. Please try again.' })
    }
    const { plain, hashed } = generateBackupCodes()
    await supabaseAdmin
      .from('profiles')
      .update({ totp_enabled: true, totp_backup_codes: hashed })
      .eq('id', req.userId!)
    auditAuth(req, 'totp_enabled', { subjectId: req.userId!, status: 200 })
    // Shown to the user exactly once — the server never displays these again.
    res.json({ backupCodes: plain })
  })
)

router.post(
  '/totp/disable',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { password, backupCode } = req.body ?? {}
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(req.userId!)
    const email = userRes?.user?.email

    let verified = false
    if (typeof password === 'string' && password && email) {
      const { data } = await supabaseAuthClient.auth.signInWithPassword({
        email,
        password: String(password),
      })
      verified = Boolean(data.session)
    }
    if (!verified && typeof backupCode === 'string' && backupCode) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('totp_backup_codes')
        .eq('id', req.userId!)
        .single()
      const stored = (prof?.totp_backup_codes as string[] | null) ?? []
      verified = stored.length > 0 && consumeBackupCode(backupCode, stored) !== null
    }
    if (!verified) {
      recordAuthFailure(clientIp(req), { route: 'totp/disable' })
      return res
        .status(401)
        .json({ error: 'Re-enter your password or a backup code to turn this off.' })
    }

    await supabaseAdmin
      .from('profiles')
      .update({ totp_enabled: false, totp_secret: null, totp_backup_codes: null })
      .eq('id', req.userId!)
    auditAuth(req, 'totp_disabled', { subjectId: req.userId!, status: 200 })
    res.json({ ok: true })
  })
)

// POST /api/auth/totp/step-up — redeems a requireTotpStepUp() ticket + a
// 6-digit code (or a backup code) into the real session, the same way
// /otp/replace-device redeems a spent-OTP ticket: revoke nothing here (no
// device was ever claimed for a step-up-pending login), just verify and mint.
router.post(
  '/totp/step-up',
  tokenLimiter,
  asyncH(async (req, res) => {
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket : ''
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!ticket || !code) return res.status(400).json({ error: 'Missing ticket or code' })

    const userId = verifyTotpStepUpTicket(ticket)
    if (!userId) {
      return res
        .status(401)
        .json({ error: 'Your sign-in window expired. Please sign in again.' })
    }

    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('totp_secret, totp_backup_codes')
      .eq('id', userId)
      .single()
    if (!prof?.totp_secret) {
      return res.status(404).json({ error: 'Two-factor authentication is not set up.' })
    }

    let usedBackup = false
    let ok = await verifyTotpToken(prof.totp_secret, code)
    if (!ok) {
      const stored = (prof.totp_backup_codes as string[] | null) ?? []
      const remaining = stored.length > 0 ? consumeBackupCode(code, stored) : null
      if (remaining) {
        ok = true
        usedBackup = true
        await supabaseAdmin
          .from('profiles')
          .update({ totp_backup_codes: remaining })
          .eq('id', userId)
      }
    }
    if (!ok) {
      recordAuthFailure(clientIp(req), { route: 'totp/step-up' })
      return res.status(401).json({ error: 'Invalid code. Please try again.' })
    }

    // The password/Google session from /login or /google was never returned to
    // the client, and there's no clean way to hand THAT exact session across
    // this second request — redeem a fresh one via the same admin-magiclink
    // trick /otp/verify already uses.
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (!email) return res.status(404).json({ error: 'Account not found' })
    const session = await mintSessionForEmail(email)
    if (!session) {
      return res.status(500).json({ error: 'Could not complete sign in. Please try again.' })
    }

    const { blocked } = await registerLoginSession(
      session.user.id,
      deviceKey(session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(session.user.id))
      // Fresh ticket so /totp/replace-device can finish without re-entering
      // the (now-spent) code — same shape /otp/verify's block response takes.
      return res
        .status(403)
        .json({ error: 'device_limit', devices, ticket: issueTotpStepUpTicket(session.user.id) })
    }
    auditAuth(req, 'login_success', {
      subjectId: session.user.id,
      status: 200,
      detail: { method: usedBackup ? 'totp_backup' : 'totp', device: deviceLabel(req.headers['user-agent']), platform: clientPlatform(req) },
    })
    setRtCookie(res, session.refresh_token)
    res.json(await sessionPayload(session))
  })
)

// POST /api/auth/totp/replace-device — reached after a `device_limit` block on
// /totp/step-up itself: the TOTP code already succeeded, so the fresh ticket
// above stands in for it here, exactly as /otp/replace-device reuses a spent
// OTP's ticket rather than asking for another code.
router.post(
  '/totp/replace-device',
  tokenLimiter,
  asyncH(async (req, res) => {
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket : ''
    const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id : ''
    if (!ticket || !sessionId) {
      return res.status(400).json({ error: 'Missing ticket or session_id' })
    }
    const userId = verifyTotpStepUpTicket(ticket)
    if (!userId) {
      return res
        .status(401)
        .json({ error: 'Your sign-in window expired. Please sign in again.' })
    }
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (!email) return res.status(404).json({ error: 'Account not found' })

    // revokeSessionById is scoped to userId, so a forged session_id is a no-op.
    await revokeSessionById(userId, sessionId)
    const session = await mintSessionForEmail(email)
    if (!session) {
      return res.status(500).json({ error: 'Could not complete sign in. Please try again.' })
    }
    const { blocked } = await registerLoginSession(
      session.user.id,
      deviceKey(session.access_token, req),
      deviceId(req),
      deviceLabel(req.headers['user-agent']),
      clientPlatform(req)
    )
    if (blocked) {
      const devices = publicDevices(await listSessions(session.user.id))
      return res
        .status(403)
        .json({ error: 'device_limit', devices, ticket: issueTotpStepUpTicket(session.user.id) })
    }
    setRtCookie(res, session.refresh_token)
    res.json(await sessionPayload(session))
  })
)

export default router
