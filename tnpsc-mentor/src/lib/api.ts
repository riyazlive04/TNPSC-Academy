// ─── API client ──────────────────────────────────────────────────────────────
// The browser now talks ONLY to the Express API (see /server). Supabase is no
// longer imported in the frontend; this module owns auth tokens, refresh, and
// every data call. A thin typed surface keeps the rest of the app unchanged.

import type {
  Kural,
  MockExam,
  MockExamAdmin,
  Profile,
  Question,
  QuizConfig,
  RevisionAnalytics,
  RevisionTopic,
  SubmitResult,
  TestAnswer,
  TestSeriesAdmin,
  TestSeriesAnalyticsResponse,
  TestSeriesItem,
  UserRole,
  VettriExam,
  VettriExamAdmin,
} from '../types'

import { getDeviceId } from './device'
import { Capacitor } from '@capacitor/core'
import { translate } from './i18n'
import { useLanguageStore } from '../store/languageStore'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

// Web keeps its refresh token in an HttpOnly cookie (set by the server) so a XSS
// can't read it; the native Android WebView can't rely on cross-site cookies, so
// it keeps the refresh token in storage and sends it in the request body.
const isNative = Capacitor.isNativePlatform()
// Web must send credentials so the refresh cookie is set/sent cross-site; native
// uses Bearer tokens only and never depends on the cookie.
const CREDENTIALS: RequestCredentials = isNative ? 'same-origin' : 'include'

/** When false the app runs in "UI-preview" mode (no backend, no auth gate). */
export const isApiConfigured = Boolean(import.meta.env.VITE_API_URL)

/**
 * Which optional auth methods the server currently has configured — phone-OTP
 * login, WhatsApp-OTP signup verification, its Telegram fallback, and Google.
 * Fetched once at boot (see authConfigStore) instead of mirrored by hand
 * through separate VITE_* build flags, which could (and once did) drift out
 * of sync with the server's own AiSensy/MSG91/Telegram-bot config state.
 */
export interface AuthConfig {
  google: boolean
  whatsappOtp: boolean
  telegramVerify: boolean
  phoneOtp: boolean
}

/**
 * Fire-and-forget ping to /api/health on app mount. The API now runs always-on
 * under PM2 on the VPS (no cold starts), so this is just a cheap warm-up: it
 * opens the DNS/TLS/keep-alive connection to the API in parallel with the rest
 * of the boot, shaving a little latency off the first real request.
 */
export function warmApi(): void {
  fetch(`${API_URL}/api/health`).catch(() => {})
}

const ACCESS_KEY = 'tnpsc_access_token'
const REFRESH_KEY = 'tnpsc_refresh_token'

// ─── Token store ─────────────────────────────────────────────────────────────
export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    // Web NEVER persists the refresh token in JS-readable storage - the server's
    // HttpOnly cookie holds it. Only native (no cross-site cookie) stores it.
    if (isNative) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    // Cached reads belong to the session that fetched them. Dropping them here
    // means a sign-out (or a dead session) can never leave one account's data
    // in memory for whoever signs in next on this device.
    invalidateReads()
  },
}

/** Whether a token refresh is worth attempting. Native needs a stored refresh
 * token; web relies on the HttpOnly cookie (invisible to JS), so it always tries
 * and lets the server decide based on the cookie. */
export function canTryRefresh(): boolean {
  return isNative ? !!tokens.refresh : true
}

/**
 * Server error text that is a DATABASE INTERNAL, not copy written for a user.
 *
 * Several screens show `err.message` verbatim, which is right for deliberate
 * server copy ("Invalid coupon code.", "Order not found.") and wrong for
 * anything that escaped from Postgres. On 5 August 2026 a missing `profiles`
 * row surfaced PostgREST's "Cannot coerce the result to a single JSON object"
 * as a toast on the profile screen. The server no longer emits that one (util.ts
 * maps PGRST116 to a 404), and this is the second line of defence: match here
 * and the user sees actionable copy instead, wherever the message is rendered.
 */
const DB_INTERNAL =
  /coerce|JSON object|PGRST|postgres|violates .*constraint|relation ".*" does not exist|column .* does not exist|syntax error at or near|null value in column/i

export class ApiError extends Error {
  status: number
  /** The parsed JSON error body, so callers can read extra fields (e.g. the
   * device list returned with a `device_limit` 403). */
  data: unknown
  /** The server's original text, kept for logs even when `message` is replaced. */
  rawMessage: string
  constructor(message: string, status: number, data?: unknown) {
    const leaked = DB_INTERNAL.test(message)
    super(leaked ? translate('unexpectedError', useLanguageStore.getState().lang) : message)
    this.rawMessage = message
    this.status = status
    this.data = data
    if (leaked) console.error('[api] suppressed DB internal in error message:', message)
  }
}

/**
 * Thrown by request() when the session is gone (refresh failed/unavailable on a
 * 401). Distinct so callers can tell "you're signed out" apart from a raw 401
 * and never act on a half-cleared session - tokens are cleared exactly once
 * inside the shared refresh path, not per concurrent caller.
 */
export class UnauthenticatedError extends Error {
  readonly code = 'unauthenticated'
  constructor(message = 'Session expired. Please sign in again.') {
    super(message)
    this.name = 'UnauthenticatedError'
  }
}

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  if (!canTryRefresh()) {
    // No way to recover this session - clear once, here, so concurrent callers
    // all observe the same cleared state rather than each clearing the tokens.
    tokens.clear()
    return false
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS,
      // Native sends its stored refresh token; web sends none - the HttpOnly
      // cookie carries it automatically with credentials: 'include'.
      body: JSON.stringify(
        isNative ? { refresh_token: tokens.refresh, device_id: getDeviceId() } : { device_id: getDeviceId() }
      ),
    })
    if (!res.ok) {
      tokens.clear()
      return false
    }
    const data = (await res.json()) as SessionResponse
    tokens.set(data.access_token, data.refresh_token)
    return true
  } catch {
    tokens.clear()
    return false
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean // attach bearer token (default true)
  query?: Record<string, string | number | undefined>
  /**
   * Serve this GET from the in-memory read cache for `swr` milliseconds
   * (stale-while-revalidate). Opt-in per endpoint — see the SWR block below for
   * when it is appropriate.
   */
  swr?: number
}

// ─── Read cache (stale-while-revalidate) ────────────────────────────────────
// The API sits in front of Supabase in another region: a data read costs
// ~300-600 ms end to end. Without a cache, every visit to a tab re-pays that
// and shows a skeleton, which is what makes moving around the app feel slow.
//
// So GETs marked `swr` are answered from memory when a recent copy exists, and
// refreshed in the background when that copy is past its TTL — the screen
// paints instantly with real data and quietly corrects itself. Only list/summary
// reads opt in. Anything the user can change from inside the app and must see
// exactly (credits, an in-progress test, payment state) does NOT, and writes
// invalidate what they affect via invalidateReads().
//
// Memory-only and per-tab: a reload starts cold, and signing out clears it.
interface CacheEntry {
  at: number
  data: unknown
}
const readCache = new Map<string, CacheEntry>()
/** In-flight GETs by cache key, so N mounts of the same screen share one call. */
const readInflight = new Map<string, Promise<unknown>>()

/**
 * Drop cached reads whose path starts with any of `prefixes` (or everything
 * when called with none). Call after a write that changes what a cached read
 * would return — a submitted test, a new bookmark, a published material.
 */
export function invalidateReads(...prefixes: string[]): void {
  if (!prefixes.length) {
    readCache.clear()
    return
  }
  for (const key of [...readCache.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) readCache.delete(key)
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, swr } = opts

  let url = `${API_URL}${path}`
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
  }

  // Cached reads are keyed by path + query (never the absolute URL), so a
  // different query is a different entry AND invalidateReads('/api/analytics')
  // matches the way a caller would write it. POST "reads" (a filter/config
  // body instead of a query string, e.g. countQuestions) fold the body into
  // the key too, so distinct configs don't collide.
  const cacheKey = url.slice(API_URL.length) + (method === 'POST' && body ? `:${JSON.stringify(body)}` : '')
  const cacheable = swr !== undefined && (method === 'GET' || method === 'POST')
  if (cacheable) {
    // The real network call, storing what it gets. `swr: undefined` on the inner
    // call is what stops this from recursing.
    const fetchAndStore = (): Promise<T> =>
      request<T>(path, { ...opts, swr: undefined }).then((data) => {
        readCache.set(cacheKey, { at: Date.now(), data })
        return data
      })

    const hit = readCache.get(cacheKey)
    if (hit) {
      // Past its TTL: hand back the stale copy now and refresh behind it, so the
      // next visit is already correct. A failed refresh keeps the old value.
      if (Date.now() - hit.at > swr && !readInflight.has(cacheKey)) {
        const p = fetchAndStore()
          .catch(() => hit.data as T)
          .finally(() => readInflight.delete(cacheKey))
        readInflight.set(cacheKey, p)
      }
      return hit.data as T
    }
    // Cold: share one request across every caller that asks while it is open.
    const pending = readInflight.get(cacheKey)
    if (pending) return pending as Promise<T>
    const p = fetchAndStore().finally(() => readInflight.delete(cacheKey))
    readInflight.set(cacheKey, p)
    return p
  }

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`
    return fetch(url, {
      method,
      headers,
      // Web includes credentials so the auth endpoints can set/read the HttpOnly
      // refresh cookie; the cookie is Path-scoped to /api/auth, so data routes
      // carry nothing extra.
      credentials: CREDENTIALS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await send()

  // Transparent one-shot refresh on expiry. Concurrent 401s share the single
  // in-flight refresh; the shared doRefresh() clears tokens exactly once on
  // failure, and we surface a distinct UnauthenticatedError so no caller acts on
  // a half-cleared session.
  if (res.status === 401 && auth) {
    if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null))
    const ok = await refreshing
    if (ok) res = await send()
    else throw new UnauthenticatedError()
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status, data)
  }
  return data as T
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface SessionResponse {
  access_token: string
  refresh_token: string
  user: { id: string }
  profile: Profile | null
}

/** Returned by /login and /google instead of a session when the account is
 * admin/superadmin with TOTP enabled — the ticket proves password/Google
 * already succeeded and is redeemed by totpStepUp(). */
export interface TotpRequiredResponse {
  totpRequired: true
  ticket: string
}

/** One active device session (manage-devices screen). The raw device/session key
 * is never sent to the client; `current` (set by the server from the request's own
 * session) marks "this device". */
export interface DeviceSession {
  id: string
  label: string | null
  created_at: string
  last_seen_at: string
  current?: boolean
}

/** An uploaded Android build (superadmin App tab + version history). */
export interface AppRelease {
  id: string
  version_name: string
  file_name: string
  file_size: number
  notes: string | null
  created_at: string
  url: string
}

/** The current build the public landing page links to (no `id`). */
export type LatestRelease = Omit<AppRelease, 'id'>

export const api = {
  auth: {
    /** Which optional auth methods are live right now — see AuthConfig. */
    async config(): Promise<AuthConfig> {
      return request('/api/auth/config', { auth: false })
    },
    async login(
      email: string,
      password: string
    ): Promise<SessionResponse | TotpRequiredResponse> {
      const data = await request<SessionResponse | TotpRequiredResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password, device_id: getDeviceId() },
      })
      if ('access_token' in data) tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** After a `device_limit` block: sign out the chosen device and sign in here.
     * Re-sends the credentials (no app token exists yet). */
    async replaceDevice(
      email: string,
      password: string,
      sessionId: string
    ): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/login/replace-device', {
        method: 'POST',
        auth: false,
        body: { email, password, session_id: sessionId, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    async register(params: {
      fullName: string
      email: string
      phone: string
      gender?: string
      password: string
      targetGroup: string
      /** Proof the phone passed WhatsApp OTP (from registerOtpVerify). The
       * server demands it whenever its WhatsApp gateway is configured. */
      phoneTicket?: string
    }): Promise<SessionResponse | { requiresConfirmation: true }> {
      const data = await request<SessionResponse | { requiresConfirmation: true }>(
        '/api/auth/register',
        { method: 'POST', auth: false, body: { ...params, device_id: getDeviceId() } }
      )
      if ('access_token' in data) tokens.set(data.access_token, data.refresh_token)
      return data
    },
    // ─── Signup phone verification (WhatsApp OTP) ─────────────────────────────
    /** Send a WhatsApp code to a number being registered. Throws ApiError with
     * 'phone_already_registered' (409) or 'otp_cooldown' (429).
     * ('phone_no_whatsapp' (404) is legacy: the official WhatsApp API behind
     * AiSensy has no exists-on-WhatsApp lookup, so the server no longer emits
     * it — the store/pages keep their handling as a harmless dead path.) */
    async registerOtpSend(phone: string): Promise<{ ok: true }> {
      return request('/api/auth/register/otp/send', {
        method: 'POST',
        auth: false,
        body: { phone },
      })
    },
    /** Verify the signup code; returns the short-lived ticket register() needs.
     * Throws ApiError with 'otp_invalid' (401), 'otp_expired' or
     * 'otp_too_many_attempts' (410). */
    async registerOtpVerify(phone: string, otp: string): Promise<{ ticket: string }> {
      return request('/api/auth/register/otp/verify', {
        method: 'POST',
        auth: false,
        body: { phone, otp },
      })
    },
    /** Telegram fallback (numbers with no WhatsApp): start a verification and
     * get the bot deep link + polling token. Throws ApiError with
     * 'phone_already_registered' (409). */
    async telegramVerifyStart(phone: string): Promise<{ token: string; url: string }> {
      return request('/api/telegram/start', { method: 'POST', auth: false, body: { phone } })
    },
    /** Poll a Telegram verification; 'verified' carries the same ticket the
     * WhatsApp flow issues. */
    async telegramVerifyStatus(
      token: string
    ): Promise<{ status: 'pending' | 'verified' | 'mismatch' | 'expired'; ticket?: string }> {
      return request('/api/telegram/status', { method: 'POST', auth: false, body: { token } })
    },
    /** Exchange a Google ID token (from Google Identity Services in the browser)
     * for the same session the email/password flow returns. Auto-creates the
     * account on first sign-in. */
    async google(idToken: string): Promise<SessionResponse | TotpRequiredResponse> {
      const data = await request<SessionResponse | TotpRequiredResponse>('/api/auth/google', {
        method: 'POST',
        auth: false,
        body: { idToken, device_id: getDeviceId() },
      })
      if ('access_token' in data) tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** After a Google `device_limit` block: sign out the chosen device and finish
     * signing in by re-verifying the same Google ID token (still valid for ~1h). */
    async googleReplaceDevice(idToken: string, sessionId: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/google/replace-device', {
        method: 'POST',
        auth: false,
        body: { idToken, session_id: sessionId, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    async forgotPassword(email: string, redirectTo?: string): Promise<void> {
      await request('/api/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email, redirectTo },
      })
    },
    /**
     * Set a new password using the credential the emailed reset link carried
     * back — an `access_token` from the URL hash, or a `token_hash` from the
     * query string, depending on the email template. The browser cannot do this
     * itself: there is no Supabase client here, so the server redeems it.
     */
    async resetPassword(
      creds: { access_token?: string; token_hash?: string },
      password: string
    ): Promise<void> {
      await request('/api/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { ...creds, password },
      })
    },
    // ─── Phone-OTP login (alternate to email/password) ───────────────────────
    /** Send a login code to a registered phone. Throws ApiError(404,
     * 'phone_not_registered') when no account owns the number. */
    async otpSend(phone: string): Promise<{ ok: true }> {
      return request('/api/auth/otp/send', { method: 'POST', auth: false, body: { phone } })
    },
    /** Verify the code and sign in (mints the same session the password flow does). */
    async otpVerify(phone: string, otp: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/otp/verify', {
        method: 'POST',
        auth: false,
        body: { phone, otp, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** After an OTP `device_limit` block: sign out the chosen device and finish
     * signing in using the short-lived ticket (no fresh OTP needed). */
    async otpReplaceDevice(ticket: string, sessionId: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/otp/replace-device', {
        method: 'POST',
        auth: false,
        body: { ticket, session_id: sessionId, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    // ─── TOTP two-factor authentication (admin/superadmin) ───────────────────
    /** Redeem a totpRequired ticket + a 6-digit (or backup) code into the
     * real session that /login or /google withheld. */
    async totpStepUp(ticket: string, code: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/totp/step-up', {
        method: 'POST',
        auth: false,
        body: { ticket, code, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** After a device_limit block on totpStepUp itself: sign out the chosen
     * device and finish using the fresh ticket that block returned (the code
     * was already spent, no need to re-enter it). */
    async totpReplaceDevice(ticket: string, sessionId: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/totp/replace-device', {
        method: 'POST',
        auth: false,
        body: { ticket, session_id: sessionId, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** Start enrollment for the SIGNED-IN admin/superadmin: a fresh secret +
     * a scannable QR data-URI. Not yet active — totpConfirm() activates it. */
    async totpEnroll(): Promise<{ secret: string; qr: string }> {
      return request('/api/auth/totp/enroll', { method: 'POST' })
    },
    /** Verify the first code from the authenticator app and activate 2FA.
     * Returns the one-time backup codes — shown to the user exactly once. */
    async totpConfirm(code: string): Promise<{ backupCodes: string[] }> {
      return request('/api/auth/totp/confirm', { method: 'POST', body: { code } })
    },
    /** Turn 2FA off. Requires re-proving ownership with the current password
     * or an unused backup code. */
    async totpDisable(params: { password?: string; backupCode?: string }): Promise<{ ok: true }> {
      return request('/api/auth/totp/disable', { method: 'POST', body: params })
    },
    async me(): Promise<{ user: { id: string }; profile: Profile | null }> {
      return request('/api/auth/me')
    },
    async logout() {
      // Revoke this device's session server-side (frees a slot for the 2-device
      // limit), then drop tokens locally. Best-effort - never block sign-out.
      try {
        await request('/api/auth/logout', { method: 'POST', body: { device_id: getDeviceId() } })
      } catch {
        /* ignore network/SSR failures */
      }
      tokens.clear()
    },
    /** Active device sessions for the manage-devices screen. */
    listSessions(): Promise<{ sessions: DeviceSession[] }> {
      return request('/api/auth/sessions')
    },
    /** Sign out one device by session id. */
    async revokeSession(id: string): Promise<void> {
      await request('/api/auth/sessions/revoke', { method: 'POST', body: { id } })
    },
  },

  // ─── Questions / tests ─────────────────────────────────────────────────────
  async quizQuestions(config: QuizConfig): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/quiz', {
      method: 'POST',
      body: { config },
    })
    return data.questions
  },
  /** Practice-mode instant reveal for ONE already-served question (see
   *  supabase/check_answer.sql - server-gated on seen_questions, not a bare
   *  answer-key lookup). Never call this for Mock/PYQ; they stay exam-style. */
  async checkAnswer(
    questionId: string
  ): Promise<
    Pick<
      Question,
      'correct_answer' | 'explanation' | 'explanation_ta' | 'explanation_video_url' | 'why_wrong' | 'why_wrong_ta'
    >
  > {
    return request('/api/questions/check-answer', {
      method: 'POST',
      body: { questionId },
    })
  },
  /** The new-user Starter Challenge paper (fixed hard mixed set, ≤18 questions). */
  async starterQuestions(count: number): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/starter-test', {
      method: 'POST',
      body: { count },
    })
    return data.questions
  },
  async countQuestions(config: QuizConfig): Promise<number> {
    const data = await request<{ count: number }>('/api/questions/count', {
      method: 'POST',
      body: { config },
      swr: 60_000,
    })
    return data.count
  },
  /** Exam years present in a bank (newest first) with question counts — sources
   *  the PYQ year chips from the DB so importing a new year's paper puts its
   *  chip in the UI without a redeploy. Pass `subject` to get only the years
   *  that one section has. */
  async questionYears(params: {
    category: string
    subject?: string
    aptitude_type?: string
  }): Promise<{ year: number; count: number }[]> {
    const data = await request<{ years: { year: number; count: number }[] }>(
      '/api/questions/years',
      { method: 'POST', body: params }
    )
    return data.years
  },
  /** Months available in the CA bank (chronological) with question counts —
   *  sources the /current-affairs month picker from the DB so a new month
   *  appears without a redeploy. */
  async caMonths(): Promise<{ label: string; year: number; count: number }[]> {
    const data = await request<{ months: { label: string; year: number; count: number }[] }>(
      '/api/questions/ca-months'
    )
    return data.months
  },
  async submitTest(session: Record<string, unknown>, answers: unknown[]): Promise<SubmitResult> {
    const result = await request<SubmitResult>('/api/tests/submit', {
      method: 'POST',
      body: { session, answers },
    })
    // A finished test changes the dashboard, Insights, the revision queue and
    // every exam list's attempt state — drop those so the next screen reads
    // fresh rather than showing the user a total that excludes what they just did.
    invalidateReads('/api/analytics', '/api/revisions', '/api/questions/')
    return result
  },
  async abandonTest(session: Record<string, unknown>): Promise<void> {
    await request('/api/tests/abandon', { method: 'POST', body: { session } })
  },
  /** The signed-in user's explanation-PDF download allowance (premium = unlimited). */
  async pdfQuota(): Promise<PdfQuota> {
    return request<PdfQuota>('/api/tests/pdf-quota')
  },
  /** Reserve one PDF download slot. `allowed:false` means the free cap is used up. */
  async recordPdfDownload(): Promise<PdfDownloadResult> {
    return request<PdfDownloadResult>('/api/tests/pdf-download', { method: 'POST' })
  },
  async distinctTopics(params: {
    category: string
    subject?: string
    standard?: number | null
    ca_type?: string
    aptitude_type?: string
  }): Promise<string[]> {
    const data = await request<{ topics: string[] }>('/api/questions/topics', {
      method: 'POST',
      body: params,
    })
    return data.topics
  },
  // ─── Subject Practice (rewritten bank) ──────────────────────────────────────
  async subjects(): Promise<{ subject: string; total: number }[]> {
    const data = await request<{ subjects: { subject: string; total: number }[] }>(
      '/api/questions/subjects',
      { method: 'POST', body: {} }
    )
    return data.subjects
  },
  /**
   * Subject Practice access state: whether the caller is premium and which
   * subjects have used their one free test (locked for free users). Drives the
   * lock badges on the subject picker; the /quiz endpoint enforces it for real.
   */
  async subjectAccess(): Promise<{ premium: boolean; usedSubjects: string[] }> {
    return request<{ premium: boolean; usedSubjects: string[] }>('/api/questions/subject-access')
  },
  async questionTypeCounts(params: { subject: string; topic?: string }): Promise<Record<string, number>> {
    const data = await request<{ counts: Record<string, number> }>('/api/questions/qtypes', {
      method: 'POST',
      body: params,
    })
    return data.counts
  },
  /** Per-topic question counts for a category's topic picker (count on each row). */
  async topicCounts(params: {
    category: string
    subject?: string
    standard?: number | null
    aptitude_type?: string
    ca_month?: string
    /** Group 2 PYQ: restrict the per-topic counts to one exam year. */
    year?: number
  }): Promise<Record<string, number>> {
    const data = await request<{ counts: Record<string, number> }>('/api/questions/topic-counts', {
      method: 'POST',
      body: params,
    })
    return data.counts
  },
  /** PYQ History bank counts per period ('ancient' | 'medieval' | 'modern'). */
  async historyPeriods(): Promise<Record<string, number>> {
    const data = await request<{ counts: Record<string, number> }>(
      '/api/questions/history-periods',
      { method: 'POST', body: {} }
    )
    return data.counts
  },

  // ─── Thirukural ─────────────────────────────────────────────────────────────
  /** All 1330 kurals (public reference content). */
  async thirukural(): Promise<Kural[]> {
    const data = await request<{ kurals: Kural[] }>('/api/thirukural', { auth: false })
    return data.kurals
  },

  // ─── Mock tests ─────────────────────────────────────────────────────────────
  /** Full group-exam mock (2024/2025 pattern): questions pooled per subject slot. */
  async mockGroupQuestions(groupType: string): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/mock-group', {
      method: 'POST',
      body: { group_type: groupType },
    })
    return data.questions
  },
  /** Subject/topic mock with optional difficulty (easy/medium/hard). */
  async subjectMockQuestions(params: {
    subject?: string
    topic?: string
    difficulty?: string
    count?: number
  }): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/subject-mock', {
      method: 'POST',
      body: params,
    })
    return data.questions
  },
  /** Full mock exams visible to this user (enabled only) + lock/attempt state. */
  async mockExams(): Promise<{ exams: MockExam[]; premium: boolean }> {
    return request<{ exams: MockExam[]; premium: boolean }>('/api/questions/mock-exams', {
      swr: 60_000,
    })
  },
  /** The fixed question set for one exam. Server re-checks tier/enabled/attempts. */
  async mockExamQuestions(examId: string): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/mock-exam', {
      method: 'POST',
      body: { exam_id: examId },
    })
    return data.questions
  },
  /** Record a completed exam attempt (counts toward the per-exam attempt cap). */
  async recordMockExamAttempt(p: {
    exam_id: string
    session_id?: string | null
    score?: number
    total?: number
  }): Promise<void> {
    await request('/api/questions/mock-exam/attempt', { method: 'POST', body: p })
  },
  /** Scheduled test-series papers visible to this user + lock/schedule/attempts.
   *  `series` defaults server-side to the original Group 1 Marathon. */
  async testSeries(series?: string): Promise<{ tests: TestSeriesItem[]; premium: boolean }> {
    return request<{ tests: TestSeriesItem[]; premium: boolean }>(
      `/api/questions/test-series${series ? `?series=${series}` : ''}`,
      { swr: 60_000 }
    )
  },
  /** The fixed question set for one test. Server re-checks premium/date/attempts. */
  async testSeriesQuestions(testId: string, series?: string): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/test-series', {
      method: 'POST',
      body: { test_id: testId, series },
    })
    return data.questions
  },
  /** Record a completed test-series attempt (counts toward the attempt cap). */
  async recordTestSeriesAttempt(p: {
    test_id: string
    session_id?: string | null
    score?: number
    total?: number
  }): Promise<void> {
    await request('/api/questions/test-series/attempt', { method: 'POST', body: p })
  },
  /** This user's attempt history for one series + per-answer weak-area breakdown. */
  async testSeriesAnalytics(series?: string): Promise<TestSeriesAnalyticsResponse> {
    return request<TestSeriesAnalyticsResponse>(
      `/api/questions/test-series/analytics${series ? `?series=${series}` : ''}`,
      { swr: 60_000 }
    )
  },
  /** Combined attempt history + weak-area breakdown across EVERY scheduled
   *  test series (Vettri Nichayam + Rank Booster + any future series). */
  async testSeriesAnalyticsOverall(): Promise<TestSeriesAnalyticsResponse> {
    return request<TestSeriesAnalyticsResponse>('/api/questions/test-series/analytics/overall', {
      swr: 60_000,
    })
  },
  /** Vettri Nichayam exams visible to this user (enabled only) + lock state. */
  async vettriExams(): Promise<{ exams: VettriExam[]; unlocked: boolean }> {
    return request<{ exams: VettriExam[]; unlocked: boolean }>('/api/questions/vettri-exams', {
      swr: 60_000,
    })
  },
  /** The fixed question set for one Vettri exam. Server re-checks the bundle gate. */
  async vettriExamQuestions(examId: string): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/questions/vettri-exam', {
      method: 'POST',
      body: { exam_id: examId },
    })
    return data.questions
  },
  /**
   * PYQ + Current Affairs lock state: whether the caller is unlimited (premium/
   * vettri) and, if not, which topic keys have used their one free test. The
   * client derives each row's key with lib/freeGate.ts and checks membership.
   */
  async topicAccess(): Promise<{ unlimited: boolean; usedKeys: string[] }> {
    return request<{ unlimited: boolean; usedKeys: string[] }>('/api/questions/topic-access')
  },
  /** Public client-facing feature flags (e.g. which Mock Test sections show). */
  async appSettings(): Promise<AppSettings> {
    const data = await request<{ settings: AppSettings }>('/api/app/settings', { auth: false })
    return data.settings
  },

  // ─── Analytics ─────────────────────────────────────────────────────────────
  // The dashboard AND the Insights tab both derive everything from this one
  // read, so it is the single most re-fetched call in the app. Cached briefly:
  // revisiting a tab paints from memory, and submitTest() invalidates it.
  async analytics(): Promise<{ sessions: unknown[]; answers: unknown[] }> {
    return request('/api/analytics', { swr: 60_000 })
  },

  // ─── Bookmarks ─────────────────────────────────────────────────────────────
  async bookmarkIds(): Promise<string[]> {
    const data = await request<{ ids: string[] }>('/api/bookmarks/ids')
    return data.ids
  },
  async bookmarkedQuestions(): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/bookmarks')
    return data.questions
  },
  async addBookmark(questionId: string): Promise<void> {
    await request('/api/bookmarks', { method: 'POST', body: { questionId } })
  },
  async removeBookmark(questionId: string): Promise<void> {
    await request(`/api/bookmarks/${questionId}`, { method: 'DELETE' })
  },

  // ─── Spaced revision ───────────────────────────────────────────────────────
  async dueReviews(limit = 30): Promise<unknown[]> {
    const data = await request<{ items: unknown[] }>('/api/reviews/due', { query: { limit } })
    return data.items
  },
  async reviewCount(): Promise<number> {
    const data = await request<{ count: number }>('/api/reviews/count')
    return data.count
  },
  async enqueueReviews(questionIds: string[]): Promise<void> {
    await request('/api/reviews/enqueue', { method: 'POST', body: { questionIds } })
  },
  async gradeReview(itemId: string, selected: string): Promise<unknown> {
    return request('/api/reviews/grade', { method: 'POST', body: { itemId, selected } })
  },

  // ─── Topic revision (study-gate + similar-question re-tests) ────────────────
  async revisions(): Promise<RevisionTopic[]> {
    const data = await request<{ items: RevisionTopic[] }>('/api/revisions', { swr: 60_000 })
    return data.items
  },
  async revisionAnalytics(): Promise<RevisionAnalytics> {
    const data = await request<{ analytics: RevisionAnalytics }>('/api/revisions/analytics', {
      swr: 60_000,
    })
    return data.analytics
  },
  /** Open the study gate: returns a ready QuizConfig + similar questions, or throws
   *  ApiError(423) when the re-test is still locked. */
  async startRevision(
    id: string
  ): Promise<{ revisionId: string; label: string | null; config: QuizConfig; questions: Question[] }> {
    return request(`/api/revisions/${id}/start`, { method: 'POST' })
  },
  async dismissRevision(id: string): Promise<void> {
    await request(`/api/revisions/${id}/dismiss`, { method: 'POST' })
  },

  // ─── Profile / activity ────────────────────────────────────────────────────
  async getProfile(): Promise<Profile> {
    const data = await request<{ profile: Profile }>('/api/profile')
    return data.profile
  },
  async updateProfile(fields: Record<string, unknown>): Promise<Profile> {
    const data = await request<{ profile: Profile }>('/api/profile', { method: 'PATCH', body: fields })
    return data.profile
  },
  async percentile(): Promise<number | null> {
    const data = await request<{ percentile: number | null }>('/api/profile/percentile', { swr: 60_000 })
    return data.percentile
  },
  async activityRows(days = 60): Promise<{ activity_date: string; questions: number; tests: number }[]> {
    const data = await request<{
      rows: { activity_date: string; questions: number; tests: number }[]
    }>('/api/profile/activity', { query: { days }, swr: 60_000 })
    return data.rows
  },
  async recordActivity(questions: number, tests = 1): Promise<void> {
    await request('/api/profile/activity', { method: 'POST', body: { questions, tests } })
  },
  /**
   * Permanently delete the signed-in account and every row that hangs off it.
   * Required in-app by Apple 5.1.1(v) and Google Play's User Data policy. The
   * caller is expected to sign out immediately after — the session it is holding
   * refers to a user that no longer exists.
   */
  async deleteAccount(): Promise<void> {
    await request('/api/profile/account', { method: 'DELETE' })
  },

  // ─── Admin ─────────────────────────────────────────────────────────────────
  async adminListQuestions(config: QuizConfig): Promise<Question[]> {
    const data = await request<{ questions: Question[] }>('/api/admin/questions/list', {
      method: 'POST',
      body: { config },
    })
    return data.questions
  },
  async adminUpsertQuestion(draft: Record<string, unknown>): Promise<Question> {
    const data = await request<{ question: Question }>('/api/admin/questions', {
      method: 'POST',
      body: { draft },
    })
    return data.question
  },
  async adminDeleteQuestion(id: string): Promise<void> {
    await request(`/api/admin/questions/${id}`, { method: 'DELETE' })
  },
  /** Admin/superadmin: enable/disable a question for students (toggles active). */
  async adminSetQuestionActive(id: string, active: boolean): Promise<Question> {
    const data = await request<{ question: Question }>('/api/admin/questions/active', {
      method: 'POST',
      body: { id, active },
    })
    return data.question
  },
  async adminBulkInsert(rows: Record<string, unknown>[]): Promise<{ inserted?: number }> {
    const data = await request<{ result: { inserted?: number } | null }>(
      '/api/admin/questions/bulk',
      { method: 'POST', body: { rows } }
    )
    return data.result ?? {}
  },
  /** Admin/superadmin: student-reported questions for triage (default: open). */
  async adminQuestionReports(status: ReportStatus = 'open', limit = 200): Promise<ReportedQuestion[]> {
    const data = await request<{ reports: ReportedQuestion[] }>('/api/admin/question-reports', {
      query: { status, limit },
    })
    return data.reports
  },
  /** Admin/superadmin: count of currently-open question reports (nav badge). */
  async adminOpenReportCount(): Promise<number> {
    const data = await request<{ count: number }>('/api/admin/question-reports/count')
    return data.count
  },
  /**
   * Admin/superadmin: set a reported question's triage state. Resolving also
   * messages the students who flagged it (copy is superadmin-editable); the
   * returned `notified` is how many were reached.
   */
  async adminSetReportStatus(
    questionId: string,
    status: ReportStatus,
    note?: string
  ): Promise<{ notified: number }> {
    const data = await request<{ notified?: number }>('/api/admin/question-reports/status', {
      method: 'POST',
      body: { questionId, status, note },
    })
    return { notified: data.notified ?? 0 }
  },

  // ─── Superadmin console ──────────────────────────────────────────────────
  superadmin: {
    async metrics(): Promise<PlatformMetrics> {
      const data = await request<{ metrics: PlatformMetrics }>('/api/superadmin/metrics')
      return data.metrics
    },
    /** Revenue / founder analytics (all amounts in paise). */
    async revenue(): Promise<RevenueMetrics> {
      const data = await request<{ revenue: RevenueMetrics }>('/api/superadmin/revenue')
      return data.revenue
    },
    // ─── Direct messaging: one shared thread per student ────────────────────
    messages: {
      /** Full thread with one student, oldest first. Marks their messages read. */
      async thread(userId: string): Promise<{ messages: MessageItem[]; name: string | null }> {
        return request<{ messages: MessageItem[]; name: string | null }>(
          `/api/superadmin/messages/${userId}`
        )
      },
      /** Reply in that thread as the acting superadmin; pings the student. */
      async send(
        userId: string,
        params: { body: string; body_ta?: string }
      ): Promise<{ message: MessageItem }> {
        return request<{ message: MessageItem }>(`/api/superadmin/messages/${userId}`, {
          method: 'POST',
          body: params,
        })
      },
    },
    /** One page of accounts + the size of the whole (optionally searched) set. */
    async users(
      search?: string,
      limit = 200,
      offset = 0
    ): Promise<{ users: AdminUserRow[]; total: number }> {
      return request<{ users: AdminUserRow[]; total: number }>('/api/superadmin/users', {
        query: { search: search || undefined, limit, offset },
      })
    },
    /**
     * EVERY account, fetched a page at a time. The console filters and sorts
     * across the whole user base client-side, so it needs the full set in hand;
     * asking for one fixed page was what hid every user past the first 200.
     * The loop is bounded by the server-reported total and stops on a short page.
     */
    async allUsers(search?: string): Promise<AdminUserRow[]> {
      const PAGE = 1000 // the server's per-request ceiling
      const first = await this.users(search, PAGE, 0)
      const out = [...first.users]
      while (out.length < first.total && first.users.length === PAGE) {
        const next = await this.users(search, PAGE, out.length)
        if (!next.users.length) break // nothing more to read - don't spin
        out.push(...next.users)
      }
      return out
    },
    async setRole(userId: string, role: UserRole): Promise<void> {
      await request('/api/superadmin/users/role', { method: 'POST', body: { userId, role } })
    },
    /** Withdraw a user's premium (revokes their paid premium rows). Returns the count revoked. */
    async revokePremium(userId: string): Promise<number> {
      const data = await request<{ revoked: number }>('/api/superadmin/users/revoke-premium', {
        method: 'POST',
        body: { userId },
      })
      return data.revoked
    },
    /** Withdraw a user's Vettri Nichayam (revokes their paid vettri rows). */
    async revokeVettri(userId: string): Promise<number> {
      const data = await request<{ revoked: number }>('/api/superadmin/users/revoke-vettri', {
        method: 'POST',
        body: { userId },
      })
      return data.revoked
    },
    /** Withdraw a user's Rank Booster plan (revokes their paid rank_booster_g2 rows). */
    async revokeRankBooster(userId: string): Promise<number> {
      const data = await request<{ revoked: number }>(
        '/api/superadmin/users/revoke-rank-booster',
        { method: 'POST', body: { userId } }
      )
      return data.revoked
    },
    /** Comp a plan (₹0 paid ledger row) — entitlement starts now for the plan's window. */
    async grantPlan(userId: string, plan: GrantablePlan): Promise<void> {
      await request('/api/superadmin/users/grant-plan', { method: 'POST', body: { userId, plan } })
    },
    /** Hard-delete a user account and all their data. Irreversible. */
    async deleteUser(userId: string): Promise<void> {
      await request('/api/superadmin/users/delete', { method: 'POST', body: { userId } })
    },
    async feedback(limit = 100): Promise<FeedbackRow[]> {
      const data = await request<{ feedback: FeedbackRow[] }>('/api/superadmin/feedback', {
        query: { limit },
      })
      return data.feedback
    },
    /** Activity + credits snapshot for the user-detail popup. */
    async userInsights(userId: string): Promise<UserInsights | null> {
      const data = await request<{ insights: UserInsights | null }>(
        `/api/superadmin/users/${userId}/insights`
      )
      return data.insights
    },
    /** A user's active device sessions (where they're signed in). */
    async userSessions(userId: string): Promise<DeviceSession[]> {
      const data = await request<{ sessions: DeviceSession[] }>(
        `/api/superadmin/users/${userId}/sessions`
      )
      return data.sessions
    },
    /** Remotely sign a user out of one device (frees a slot; device logs out on next refresh). */
    async revokeUserSession(userId: string, id: string): Promise<void> {
      await request('/api/superadmin/users/sessions/revoke', {
        method: 'POST',
        body: { userId, id },
      })
    },
    /** All full mock exams (incl. disabled), with loaded-question counts. */
    async mockExams(): Promise<MockExamAdmin[]> {
      const data = await request<{ exams: MockExamAdmin[] }>('/api/superadmin/mock-exams')
      return data.exams
    },
    /** Patch an exam's gating/metadata. Only the supplied fields change. */
    async setMockExam(
      id: string,
      patch: Partial<{
        enabled: boolean
        tier: 'free' | 'paid'
        title: string
        duration_seconds: number
        negative_mark: number
      }>
    ): Promise<MockExamAdmin> {
      const data = await request<{ exam: MockExamAdmin }>(`/api/superadmin/mock-exams/${id}`, {
        method: 'POST',
        body: patch,
      })
      return data.exam
    },
    /** All tests for one series (incl. disabled), with loaded counts. `series`
     *  defaults server-side to the original Group 1 Marathon. */
    async testSeries(series?: string): Promise<TestSeriesAdmin[]> {
      const data = await request<{ tests: TestSeriesAdmin[] }>(
        `/api/superadmin/test-series${series ? `?series=${series}` : ''}`
      )
      return data.tests
    },
    /** Patch a test's gating/schedule. Only the supplied fields change. */
    async setTestSeries(
      id: string,
      patch: Partial<{
        enabled: boolean
        open_override: 'auto' | 'open' | 'closed'
        scheduled_date: string
        duration_seconds: number
        negative_mark: number
        title: string
        tier: 'free' | 'paid'
      }>
    ): Promise<TestSeriesAdmin> {
      const data = await request<{ test: TestSeriesAdmin }>(`/api/superadmin/test-series/${id}`, {
        method: 'POST',
        body: patch,
      })
      return data.test
    },
    /** All Vettri Nichayam exams (incl. disabled), with loaded-question counts. */
    async vettriExams(): Promise<VettriExamAdmin[]> {
      const data = await request<{ exams: VettriExamAdmin[] }>('/api/superadmin/vettri-exams')
      return data.exams
    },
    /** Patch a Vettri exam's gating/metadata. Only the supplied fields change. */
    async setVettriExam(
      id: string,
      patch: Partial<{
        enabled: boolean
        title: string
        total_questions: number
        duration_seconds: number
        negative_mark: number
      }>
    ): Promise<VettriExamAdmin> {
      const data = await request<{ exam: VettriExamAdmin }>(`/api/superadmin/vettri-exams/${id}`, {
        method: 'POST',
        body: patch,
      })
      return data.exam
    },
    /** All app-settings rows as a raw key→value map. */
    async settings(): Promise<Record<string, unknown>> {
      const data = await request<{ settings: Record<string, unknown> }>('/api/superadmin/settings')
      return data.settings
    },
    /** Upsert one app setting (key must be server-side allow-listed). */
    async setSetting(key: string, value: unknown): Promise<void> {
      await request('/api/superadmin/settings', { method: 'POST', body: { key, value } })
    },
  },

  // ─── App / APK releases ──────────────────────────────────────────────────
  // `latest` is public (the landing page reads it); list/upload/remove are
  // superadmin-only (the server enforces the role).
  appReleases: {
    /** Public: the current build (or null when none uploaded). Used by the landing page. */
    async latest(): Promise<LatestRelease | null> {
      const data = await request<{ release: LatestRelease | null }>('/api/app/latest', {
        auth: false,
      })
      return data.release
    },
    /** Superadmin: full version history, newest first. */
    async list(): Promise<AppRelease[]> {
      const data = await request<{ releases: AppRelease[] }>('/api/superadmin/apk')
      return data.releases
    },
    /**
     * Superadmin: upload a new .apk. Sent as the raw request body (not JSON), so
     * this bypasses the shared request() helper; version + notes ride in the
     * query string and the filename in a header.
     */
    async upload(file: File, versionName: string, notes: string): Promise<AppRelease> {
      const qs = new URLSearchParams({ version: versionName })
      if (notes) qs.set('notes', notes)
      const headers: Record<string, string> = {
        'Content-Type': 'application/vnd.android.package-archive',
        'x-file-name': file.name,
      }
      if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`
      const res = await fetch(`${API_URL}/api/superadmin/apk?${qs.toString()}`, {
        method: 'POST',
        headers,
        credentials: CREDENTIALS,
        body: file,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status, data)
      }
      return (data as { release: AppRelease }).release
    },
    /** Superadmin: delete a release (deleting the current one rolls back to the previous). */
    async remove(id: string): Promise<void> {
      await request(`/api/superadmin/apk/${id}`, { method: 'DELETE' })
    },
  },

  // ─── Materials (study material hub: videos, images, PDFs, documents) ──────
  materials: {
    /** Active items for a placement: 'materials' (nav tab) or 'profile' screen. */
    async list(placement: MaterialPlacement = 'materials'): Promise<Material[]> {
      // Superadmin-curated and rarely changed, but read by the Materials tab,
      // the CA-questions page and the nav's "has materials" check — worth a
      // longer window than the per-user reads.
      const data = await request<{ materials: Material[] }>(`/api/materials?placement=${placement}`, {
        swr: 5 * 60_000,
      })
      return data.materials
    },
    /** A short-lived signed URL for an uploaded file. 'download' is gated server-side. */
    async fileUrl(id: string, mode: 'view' | 'download' = 'view'): Promise<string> {
      const data = await request<{ url: string }>(`/api/materials/${id}/file?mode=${mode}`)
      return data.url
    },
    /** Superadmin: every item (active or hidden), all placements. */
    async adminList(): Promise<Material[]> {
      // Never cached: this is the console's working list, and it must reflect an
      // edit the moment it is made. `invalidateMaterials()` below keeps the
      // STUDENT-facing list() honest after any change made here.
      const data = await request<{ materials: Material[] }>('/api/materials/admin')
      return data.materials
    },
    /** Superadmin: add a YouTube video. */
    async createVideo(input: {
      title: string
      title_ta?: string | null
      url: string
      description?: string | null
      placement: MaterialPlacement
      sort_order?: number
    }): Promise<Material> {
      const data = await request<{ material: Material }>('/api/materials/video', { method: 'POST', body: input })
      invalidateReads('/api/materials')
      return data.material
    },
    /**
     * Superadmin: upload an image/PDF/document. Sent as the raw body (not JSON),
     * so it bypasses request(); metadata rides in the query string and the
     * filename in a header — same shape as the APK upload.
     */
    async uploadFile(
      file: File,
      meta: { title: string; title_ta?: string | null; description?: string | null; downloadable: boolean; sort_order?: number }
    ): Promise<Material> {
      const qs = new URLSearchParams({ title: meta.title, downloadable: String(meta.downloadable) })
      if (meta.title_ta) qs.set('title_ta', meta.title_ta)
      if (meta.description) qs.set('description', meta.description)
      if (meta.sort_order != null) qs.set('sort_order', String(meta.sort_order))
      const headers: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
        'x-file-name': file.name,
      }
      if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`
      const res = await fetch(`${API_URL}/api/materials/file?${qs.toString()}`, {
        method: 'POST',
        headers,
        credentials: CREDENTIALS,
        body: file,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status, data)
      invalidateReads('/api/materials')
      return (data as { material: Material }).material
    },
    /** Superadmin: edit fields / toggle active+downloadable / change placement / reorder. */
    async update(id: string, patch: Partial<MaterialPatch>): Promise<Material> {
      const data = await request<{ material: Material }>(`/api/materials/${id}`, { method: 'PATCH', body: patch })
      invalidateReads('/api/materials')
      return data.material
    },
    async remove(id: string): Promise<void> {
      await request(`/api/materials/${id}`, { method: 'DELETE' })
      invalidateReads('/api/materials')
    },
  },

  // ─── CA Magazine (pipeline-pushed daily/monthly issues) ────────────────────
  // Superadmins review issues and "publish" one, which creates a kind='magazine'
  // materials row; students read items through that row (hide/delete it via
  // api.materials to unpublish).
  caMagazine: {
    /**
     * Recent PUBLISHED daily issues + their signed news-image URLs, in one call
     * (the dashboard carousel). `newsImage` is null when the pipeline produced
     * no image for that date.
     */
    async recent(limit = 7): Promise<CaRecentIssue[]> {
      const data = await request<{ issues: CaRecentIssue[] }>(`/api/ca-magazine/recent?limit=${limit}`)
      return data.issues
    },
    /** Items of a PUBLISHED issue, addressed by its materials row id. */
    async items(materialId: string): Promise<CaMagazineItem[]> {
      const data = await request<{ items: CaMagazineItem[] }>(`/api/ca-magazine/${materialId}/items`)
      return data.items
    },
    /**
     * A short-lived signed URL for a published DAILY issue's news image, or null
     * when there's no image for that date (holiday / before the morning push) —
     * drop it straight into an <img src>.
     */
    async newsImage(materialId: string): Promise<string | null> {
      const data = await request<{ url: string | null }>(`/api/ca-magazine/${materialId}/news-image`)
      return data.url
    },
    /**
     * Every published issue's cover, keyed by its materials row id — one call
     * for the whole Materials grid instead of a news-image fetch per card.
     * Issues with no image are simply absent from the map.
     */
    async thumbnails(): Promise<Record<string, string>> {
      const data = await request<{ thumbs: Record<string, string> }>('/api/ca-magazine/thumbnails')
      return data.thumbs
    },
    /** Superadmin: every pushed issue with item count + publication state. */
    async adminIssues(): Promise<CaMagazineIssue[]> {
      const data = await request<{ issues: CaMagazineIssue[] }>('/api/ca-magazine/admin/issues')
      return data.issues
    },
    /** Superadmin: preview an issue's items before approving it. */
    async adminItems(caType: CaMagazineType, date: string): Promise<CaMagazineItem[]> {
      const qs = new URLSearchParams({ ca_type: caType, date })
      const data = await request<{ items: CaMagazineItem[] }>(`/api/ca-magazine/admin/items?${qs.toString()}`)
      return data.items
    },
    /** Superadmin: an issue's news image (works before approval; null = none). */
    async adminNewsImage(caType: CaMagazineType, date: string): Promise<string | null> {
      const qs = new URLSearchParams({ ca_type: caType, date })
      const data = await request<{ url: string | null }>(`/api/ca-magazine/admin/news-image?${qs.toString()}`)
      return data.url
    },
    /**
     * Superadmin: set the issue's thumbnail from a picked image. Sent as the raw
     * body (not JSON), so it bypasses request() — same shape as the materials
     * upload. Returns the new signed URL, ready to drop into an <img src>.
     */
    async uploadNewsImage(caType: CaMagazineType, date: string, file: File): Promise<string | null> {
      const qs = new URLSearchParams({ ca_type: caType, date })
      const headers: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' }
      if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`
      const res = await fetch(`${API_URL}/api/ca-magazine/admin/news-image?${qs.toString()}`, {
        method: 'POST',
        headers,
        credentials: CREDENTIALS,
        body: file,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status, data)
      invalidateReads('/api/ca-magazine/recent')
      return (data as { url: string | null }).url
    },
    /** Superadmin: drop the custom thumbnail. Returns what the issue falls back
     * to — the pipeline's own image for a daily issue, or null. */
    async removeNewsImage(caType: CaMagazineType, date: string): Promise<string | null> {
      const qs = new URLSearchParams({ ca_type: caType, date })
      const data = await request<{ url: string | null }>(
        `/api/ca-magazine/admin/news-image?${qs.toString()}`,
        { method: 'DELETE' }
      )
      invalidateReads('/api/ca-magazine/recent')
      return data.url
    },
    /** Superadmin: approve an issue → it appears in the Materials tab. */
    async publish(caType: CaMagazineType, date: string): Promise<Material> {
      const data = await request<{ material: Material }>('/api/ca-magazine/admin/publish', {
        method: 'POST',
        body: { ca_type: caType, date },
      })
      // Approving adds a materials row students read — don't let them keep a
      // cached list that predates it.
      invalidateReads('/api/materials', '/api/ca-magazine/recent')
      return data.material
    },
    /** Superadmin: add a new item to an issue. */
    async adminAddItem(input: {
      ca_type: CaMagazineType
      date: string
      topic: string
      title: string
      content: string
      title_ta?: string | null
      content_ta?: string | null
    }): Promise<CaMagazineItem> {
      const data = await request<{ item: CaMagazineItem }>('/api/ca-magazine/admin/items', {
        method: 'POST',
        body: input,
      })
      return data.item
    },
    /** Superadmin: edit an item's section/title/content (either language). */
    async adminUpdateItem(
      id: string,
      patch: Partial<Pick<CaMagazineItem, 'topic' | 'title' | 'title_ta' | 'content' | 'content_ta'>>
    ): Promise<CaMagazineItem> {
      const data = await request<{ item: CaMagazineItem }>(`/api/ca-magazine/admin/items/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      return data.item
    },
    /** Superadmin: delete an item. */
    async adminDeleteItem(id: string): Promise<void> {
      await request(`/api/ca-magazine/admin/items/${id}`, { method: 'DELETE' })
    },
  },

  // ─── CA → Telegram channel (superadmin broadcast) ──────────────────────────
  // An issue goes out as two documents — the English PDF and the Tamil PDF —
  // each with its own caption. The PDFs are rendered HERE (only the browser can
  // shape Tamil), uploaded raw, then posted by the server.
  caTelegram: {
    /** Channel + saved caption templates for the send dialog. */
    async config(): Promise<CaTelegramConfig> {
      return request<CaTelegramConfig>('/api/ca-telegram/admin/config')
    },
    /** Save the channel and/or the default caption templates. */
    async saveConfig(patch: {
      channel?: string
      caption_en?: string
      caption_ta?: string
    }): Promise<CaTelegramConfig> {
      return request<CaTelegramConfig>('/api/ca-telegram/admin/config', { method: 'PUT', body: patch })
    },
    /** The send history of one issue (newest first). */
    async posts(caType: CaMagazineType, date: string): Promise<CaTelegramPost[]> {
      const qs = new URLSearchParams({ ca_type: caType, date })
      const data = await request<{ posts: CaTelegramPost[] }>(`/api/ca-telegram/admin/posts?${qs.toString()}`)
      return data.posts
    },
    /** Latest send per issue+language, keyed `${ca_type}|${date}` — list chips. */
    async sent(): Promise<Record<string, { en?: string; ta?: string }>> {
      const data = await request<{ sent: Record<string, { en?: string; ta?: string }> }>(
        '/api/ca-telegram/admin/sent'
      )
      return data.sent
    },
    /**
     * Upload one language's rendered PDF. Raw body (not JSON), so it bypasses
     * request() — same shape as the materials upload.
     */
    async upload(
      caType: CaMagazineType,
      date: string,
      lang: 'en' | 'ta',
      pdf: Blob
    ): Promise<{ path: string; size: number }> {
      const qs = new URLSearchParams({ ca_type: caType, date, lang })
      const headers: Record<string, string> = { 'Content-Type': 'application/pdf' }
      if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`
      const res = await fetch(`${API_URL}/api/ca-telegram/admin/upload?${qs.toString()}`, {
        method: 'POST',
        headers,
        credentials: CREDENTIALS,
        body: pdf,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status, data)
      return data as { path: string; size: number }
    },
    /** Post the uploaded PDFs to the channel, one message per language. */
    async send(input: {
      ca_type: CaMagazineType
      date: string
      langs: ('en' | 'ta')[]
      captions: Partial<Record<'en' | 'ta', string>>
    }): Promise<CaTelegramSendResponse> {
      return request<CaTelegramSendResponse>('/api/ca-telegram/admin/send', {
        method: 'POST',
        body: input,
      })
    },
  },

  // ─── CA Questions (pipeline-generated daily sets + monthly banks) ──────────
  // Read-only superadmin viewer over the questions the VPS pipeline generates.
  caQuestions: {
    /** Daily sets (per day) + monthly banks (per month), with counts. */
    async adminSets(): Promise<CaQuestionSets> {
      return request<CaQuestionSets>('/api/ca-questions/admin/sets')
    },
    /** Every question in one set (bilingual), for the preview. */
    async adminItems(set: CaQuestionSet): Promise<CaQuestionItem[]> {
      const qs = new URLSearchParams({ source: set.source })
      if (set.source === 'daily') qs.set('date', set.key)
      else qs.set('ca_month', set.key)
      const data = await request<{ items: CaQuestionItem[] }>(`/api/ca-questions/admin/items?${qs.toString()}`)
      return data.items
    },
    // ─ DAILY-only curation (ca_daily_questions). Monthly bank is read-only. ─
    /** Add a hand-authored question to a day (auto-verified). */
    async addDailyItem(date: string, fields: Partial<CaQuestionItem>): Promise<CaQuestionItem> {
      const data = await request<{ item: CaQuestionItem }>('/api/ca-questions/admin/daily/items', {
        method: 'POST',
        body: { date, ...fields },
      })
      return data.item
    },
    /** Edit fields and/or toggle `verified` on a daily question. */
    async updateDailyItem(id: number, patch: Partial<CaQuestionItem>): Promise<CaQuestionItem> {
      const data = await request<{ item: CaQuestionItem }>(`/api/ca-questions/admin/daily/items/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      return data.item
    },
    /** Remove a daily question. */
    async deleteDailyItem(id: number): Promise<void> {
      await request(`/api/ca-questions/admin/daily/items/${id}`, { method: 'DELETE' })
    },
    /** Superadmin: turn ON the student PDF for a set (creates the Materials card). */
    async publish(set: CaQuestionSet): Promise<Material> {
      const data = await request<{ material: Material }>('/api/ca-questions/admin/publish', {
        method: 'POST',
        body: { source: set.source, key: set.key },
      })
      return data.material
    },
    /** Student: the questions behind a published+downloadable set (for the PDF). */
    async items(materialId: string): Promise<CaQuestionItem[]> {
      const data = await request<{ items: CaQuestionItem[] }>(`/api/ca-questions/${materialId}/items`)
      return data.items
    },
    // ─ Daily CA test (the published daily sets, playable) ────────────────────
    /** Student: recent published daily sets, newest first (dashboard strip). */
    async dailyPublished(limit = 7): Promise<CaDailySet[]> {
      const data = await request<{ sets: CaDailySet[] }>('/api/ca-questions/daily/published', {
        query: { limit },
      })
      return data.sets
    },
    /** Start a daily test: that day's questions with the answers stripped. */
    async dailyQuiz(materialId: string, count?: number): Promise<Question[]> {
      const data = await request<{ questions: Question[] }>(
        `/api/ca-questions/daily/${materialId}/quiz`,
        { method: 'POST', body: count ? { count } : {} }
      )
      return data.questions
    },
    /** Grade a finished daily test (the server is the only holder of the keys). */
    async dailySubmit(
      materialId: string,
      payload: {
        answers: { question_id: string; selected_answer: string | null }[]
        time_limit_seconds: number
        time_taken_seconds: number
      }
    ): Promise<SubmitResult> {
      return request<SubmitResult>(`/api/ca-questions/daily/${materialId}/submit`, {
        method: 'POST',
        body: payload,
      })
    },
  },

  // ─── Feedback (student-submitted) ────────────────────────────────────────
  feedback: {
    async submit(rating: number, message: string, page: string): Promise<void> {
      await request('/api/feedback', { method: 'POST', body: { rating, message, page } })
    },
    /** Thumbs up/down on a single explanation ('down' = needs work). */
    async explanation(questionId: string, vote: 'up' | 'down'): Promise<void> {
      await request('/api/feedback/explanation', {
        method: 'POST',
        body: { questionId, vote },
      })
    },
    /** Mark a question for correction (reported=false re-taps to remove it). */
    async reportQuestion(questionId: string, reported: boolean, reason?: string): Promise<void> {
      await request('/api/feedback/question-report', {
        method: 'POST',
        body: { questionId, reported, reason },
      })
    },
  },

  // ─── Payments (Razorpay) ─────────────────────────────────────────────────
  // The browser only ever sees the PUBLIC key id (returned with the order); the
  // secret stays on the server, which also verifies the checkout signature.
  payments: {
    /**
     * Create a Razorpay order (amount in paise). Returns the order + public key.
     * An optional `couponCode` is validated + applied server-side; the server is
     * the source of truth for the final price (the browser never sends it).
     */
    async createOrder(
      amount: number,
      notes?: Record<string, string>,
      couponCode?: string
    ): Promise<CreateOrderResponse> {
      return request<CreateOrderResponse>('/api/payments/order', {
        method: 'POST',
        body: { amount, notes, couponCode },
      })
    },
    /** Verify the checkout callback server-side; marks the payment paid on success. */
    async verify(params: {
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
    }): Promise<{ verified: boolean }> {
      const result = await request<{ verified: boolean }>('/api/payments/verify', {
        method: 'POST',
        body: params,
      })
      // A successful purchase unlocks content: every gated list (mock exams,
      // test series, Vettri) must be re-read rather than served from the copy
      // fetched while the user was still locked.
      if (result.verified) invalidateReads('/api/questions/', '/api/payments')
      return result
    },
    /** The signed-in user's payment history. */
    async list(): Promise<PaymentRow[]> {
      const data = await request<{ payments: PaymentRow[] }>('/api/payments')
      return data.payments
    },
    /** Premium entitlement, derived server-side from the ledger. */
    async premiumStatus(): Promise<PremiumStatus> {
      return request<PremiumStatus>('/api/payments/premium')
    },
    /** Full bundle entitlement (premium + vettri + derived `unlimited`) in one call. */
    async entitlements(): Promise<BundleEntitlement> {
      return request<BundleEntitlement>('/api/payments/entitlements')
    },
    /**
     * Hand an App Store / Play receipt to the server, which verifies it with the
     * store and writes the `paid` row. The native counterpart of `verify()`.
     *
     * `plan` and `productId` are hints for logging and Play's lookup; the server
     * re-derives the granted plan from the verified receipt, so a tampered body
     * cannot buy the cheap SKU and claim the expensive plan.
     */
    async verifyIap(params: {
      platform: 'ios' | 'android'
      plan: string
      productId: string
      transactionId?: string
      jws?: string
      purchaseToken?: string
    }): Promise<{ verified: boolean; plan?: string; alreadyRecorded?: boolean }> {
      const result = await request<{
        verified: boolean
        plan?: string
        alreadyRecorded?: boolean
      }>('/api/iap/verify', { method: 'POST', body: params })
      if (result.verified) invalidateReads('/api/questions/', '/api/payments')
      return result
    },
  },

  // ─── Credits (free-tier test balance) ────────────────────────────────────
  credits: {
    /** Current balance + whether the caller is unlimited (paid/staff). */
    async balance(): Promise<{ balance: number; unlimited: boolean }> {
      return request<{ balance: number; unlimited: boolean }>('/api/credits')
    },
    /** Grant the +10 daily bonus if due, then return the balance. Call on app load. */
    async checkin(): Promise<{ balance: number; granted: boolean; unlimited: boolean }> {
      return request('/api/credits/checkin', { method: 'POST' })
    },
  },

  // ─── Coupons (promoter / affiliate discount codes) ───────────────────────
  // `validate` is open to any signed-in user (checkout preview); the rest are
  // superadmin-only (the server enforces the role).
  coupons: {
    /** Preview a code's discount for a plan/amount before paying. Never throws. */
    async validate(input: {
      code: string
      plan?: string
      amount?: number
    }): Promise<CouponValidation> {
      return request<CouponValidation>('/api/coupons/validate', { method: 'POST', body: input })
    },
    /** Superadmin: list all coupons with paid-redemption stats. */
    async list(): Promise<CouponWithStats[]> {
      const data = await request<{ coupons: CouponWithStats[] }>('/api/coupons')
      return data.coupons
    },
    /** Superadmin: create a coupon (code auto-generated if omitted). */
    async create(input: CouponInput): Promise<Coupon> {
      const data = await request<{ coupon: Coupon }>('/api/coupons', { method: 'POST', body: input })
      return data.coupon
    },
    /** Superadmin: edit a coupon / toggle active. */
    async update(id: string, patch: Partial<CouponInput>): Promise<Coupon> {
      const data = await request<{ coupon: Coupon }>(`/api/coupons/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      return data.coupon
    },
    /** Superadmin: delete a coupon (past payments keep their coupon_code). */
    async remove(id: string): Promise<void> {
      await request(`/api/coupons/${id}`, { method: 'DELETE' })
    },
  },

  // ─── Notifications (Web Push + in-app feed) ──────────────────────────────
  notifications: {
    /** The VAPID public key needed to create a push subscription (null = off). */
    async vapidKey(): Promise<string | null> {
      const data = await request<{ key: string | null }>('/api/notifications/vapid-public-key')
      return data.key
    },
    /** Register this browser's push subscription with the server. */
    async subscribe(subscription: unknown): Promise<void> {
      await request('/api/notifications/subscribe', { method: 'POST', body: { subscription } })
    },
    async unsubscribe(endpoint: string): Promise<void> {
      await request('/api/notifications/unsubscribe', { method: 'POST', body: { endpoint } })
    },
    /**
     * Register this device's APNs/FCM token — the native counterpart of
     * `subscribe`. The installed apps cannot use Web Push (no Push API in
     * WKWebView), so they go through the OS push service instead.
     */
    async registerDevice(params: { token: string; platform: 'ios' | 'android' }): Promise<void> {
      await request('/api/notifications/device', { method: 'POST', body: params })
    },
    /** Stop pushing to this account's devices (all of them when no token given). */
    async unregisterDevice(token?: string): Promise<void> {
      await request('/api/notifications/device', { method: 'DELETE', body: { token } })
    },
    /** The user's in-app feed + unread count. */
    async feed(): Promise<{ notifications: NotificationItem[]; unread: number }> {
      return request('/api/notifications')
    },
    async markRead(ids: string[]): Promise<void> {
      await request('/api/notifications/read', { method: 'POST', body: { ids } })
    },
    /** Superadmin: create a notification (push kind also delivers to devices). */
    async create(input: NotificationInput): Promise<{ pushSent: number; pushEnabled: boolean }> {
      return request('/api/notifications', { method: 'POST', body: input })
    },
    /** Superadmin: authored-notification history. */
    async adminList(): Promise<AdminNotification[]> {
      const data = await request<{ notifications: AdminNotification[] }>('/api/notifications/admin')
      return data.notifications
    },
    async remove(id: string): Promise<void> {
      await request(`/api/notifications/${id}`, { method: 'DELETE' })
    },
  },

  // ─── Direct messages (two-way thread with the admin team) ─────────────────
  messages: {
    /** My own thread, oldest first. Marks the admin team's messages read. */
    async thread(): Promise<{ messages: MessageItem[] }> {
      return request<{ messages: MessageItem[] }>('/api/messages')
    },
    async send(body: string): Promise<{ message: MessageItem }> {
      return request<{ message: MessageItem }>('/api/messages', { method: 'POST', body: { body } })
    },
    /** Cheap poll target for the header icon's unread badge. */
    async unreadCount(): Promise<number> {
      const data = await request<{ count: number }>('/api/messages/unread-count')
      return data.count
    },
  },

  // ─── Popup alerts (superadmin-authored modal announcements) ───────────────
  alerts: {
    /** Pending popup alerts for the signed-in user (active, audience-matched, undismissed). */
    async active(): Promise<ActiveAlert[]> {
      const data = await request<{ alerts: ActiveAlert[] }>('/api/alerts/active')
      return data.alerts
    },
    /** "Got it" — never show this alert to this account again (any device). */
    async dismiss(id: string): Promise<void> {
      await request(`/api/alerts/${id}/dismiss`, { method: 'POST' })
    },
    /** Superadmin: publish a popup alert. */
    async create(input: AlertInput): Promise<void> {
      await request('/api/alerts', { method: 'POST', body: input })
    },
    /** Superadmin: authored-alert history with per-alert seen counts. */
    async adminList(): Promise<AdminAlert[]> {
      const data = await request<{ alerts: AdminAlert[] }>('/api/alerts/admin')
      return data.alerts
    },
    /** Superadmin: pull (or re-publish) an alert without deleting it. */
    async setActive(id: string, active: boolean): Promise<AdminAlert> {
      const data = await request<{ alert: AdminAlert }>(`/api/alerts/${id}`, {
        method: 'PATCH',
        body: { active },
      })
      return data.alert
    },
    async remove(id: string): Promise<void> {
      await request(`/api/alerts/${id}`, { method: 'DELETE' })
    },
  },
}

// ─── Material shapes ────────────────────────────────────────────────────────────
export type MaterialKind = 'video' | 'image' | 'pdf' | 'document' | 'magazine' | 'questions'
export type MaterialPlacement = 'materials' | 'profile'

/** One curated study-material item (metadata only — file URLs are minted on demand). */
export interface Material {
  id: string
  kind: MaterialKind
  placement: MaterialPlacement
  title: string
  title_ta: string | null
  description: string | null
  youtube_id: string | null
  file_name: string | null
  file_size: number
  mime_type: string | null
  magazine_ca_type: CaMagazineType | null
  magazine_date: string | null
  /** kind='questions': which CA question set this card publishes. */
  questions_source: 'daily' | 'monthly' | null
  questions_key: string | null
  downloadable: boolean
  active: boolean
  sort_order: number
  created_at: string
  /**
   * kind='image' only: a short-lived signed URL of the picture itself, so the
   * card can show the infographic instead of a file icon. Null for every other
   * kind (magazine covers come from caMagazine.thumbnails()).
   */
  thumb_url?: string | null
}

// ─── CA Magazine shapes ─────────────────────────────────────────────────────────
export type CaMagazineType = 'day_wise' | 'month_wise'

/** One recent published daily issue for the dashboard carousel. */
export interface CaRecentIssue {
  /** The publishing materials row id — addresses items/news-image reads. */
  id: string
  date: string
  downloadable: boolean
  /** Signed news-image URL, or null when there's no image for that date. */
  newsImage: string | null
}

/** One pushed issue (a day's paper or a month's consolidation) in the console. */
export interface CaMagazineIssue {
  ca_type: CaMagazineType
  date: string
  ca_month: string
  ca_year: number | null
  items: number
  /** The materials row publishing this issue, or null while unapproved. */
  material: { id: string; active: boolean; downloadable: boolean } | null
}

/** One magazine news item; content is markdown bullets (`- ` lines, `**bold**`). */
export interface CaMagazineItem {
  id: string
  external_id: string
  ca_type: CaMagazineType
  date: string
  ca_month: string
  topic: string
  title: string
  title_ta: string | null
  content: string
  content_ta: string | null
}

// ─── CA → Telegram shapes ───────────────────────────────────────────────────────
/** The channel + the saved caption templates, with server defaults applied. */
export interface CaTelegramConfig {
  /** False when no bot token is configured — the send action is unavailable. */
  enabled: boolean
  /** '@tnpscmentors', or a numeric id for a private channel. */
  channel: string
  captions: { en: string; ta: string }
  /** Telegram's caption limit, so the dialog can count down to it. */
  captionMax: number
}

/** One document that actually reached the channel. */
export interface CaTelegramPost {
  id: string
  lang: 'en' | 'ta'
  chat_id: string
  message_id: number | null
  caption: string | null
  file_name: string | null
  file_size: number | null
  sent_at: string
}

/** Per-language outcome — languages succeed or fail independently. */
export interface CaTelegramSendResponse {
  chatId: string
  results: { lang: 'en' | 'ta'; ok: boolean; messageId?: number; error?: string }[]
}

// ─── CA Questions shapes ────────────────────────────────────────────────────────
/** One generated set: a day's daily drop, or a month's 240-question bank. */
export interface CaQuestionSet {
  source: 'daily' | 'monthly'
  /** date (YYYY-MM-DD) for daily, ca_month ('July 2026') for monthly. */
  key: string
  date: string | null
  ca_month: string
  ca_year: number | null
  total: number
  /** The materials row exposing this set's PDF to students, or null when off. */
  material: { id: string; active: boolean; downloadable: boolean } | null
}

export interface CaQuestionSets {
  daily: CaQuestionSet[]
  monthly: CaQuestionSet[]
}

/** One PUBLISHED daily set as a student sees it — a day's playable test. */
export interface CaDailySet {
  /** The publishing materials row id — addresses the quiz/submit endpoints. */
  id: string
  /** The paper's day, YYYY-MM-DD. */
  date: string
  /** Whether that day's answer PDF is also offered. */
  downloadable: boolean
  total: number
}

/** One bilingual MCQ as stored (EN fields + *_ta twins in one row). */
export interface CaQuestionItem {
  /** bigint PK — present for DAILY rows only (the curate/verify key). */
  id?: number
  /** Review state — DAILY rows only. */
  verified?: boolean
  verified_at?: string | null
  external_id: string
  topic: string
  question_type: string
  difficulty: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string
  why_wrong: Record<string, string> | null
  question_text_ta: string | null
  option_a_ta: string | null
  option_b_ta: string | null
  option_c_ta: string | null
  option_d_ta: string | null
  explanation_ta: string | null
}

/** Editable fields accepted by the PATCH endpoint. */
export interface MaterialPatch {
  title: string
  title_ta: string | null
  description: string | null
  placement: MaterialPlacement
  active: boolean
  downloadable: boolean
  sort_order: number
  url: string
}

// ─── Notification shapes ────────────────────────────────────────────────────────
export type NotificationKind = 'push' | 'system'
export type NotificationAudience = 'all' | 'premium' | 'free' | 'group'

/** One entry in a user's in-app feed. Tamil variants (when authored) let the
 *  bell render by the user's live language choice. */
export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  title_ta: string | null
  body_ta: string | null
  url: string | null
  created_at: string
  read: boolean
}

// ─── Direct-message thread shapes ───────────────────────────────────────────
/** One message in a student's shared thread with the admin team. */
export interface MessageItem {
  id: string
  sender: 'user' | 'admin'
  body: string
  body_ta: string | null
  created_at: string
}

/** Body sent by the superadmin composer. Tamil fields are optional — Tamil-
 *  language users receive them; blank sends English to everyone. */
export interface NotificationInput {
  kind: NotificationKind
  title: string
  body: string
  titleTa?: string | null
  bodyTa?: string | null
  url?: string | null
  audience: NotificationAudience
  audienceValue?: string | null
}

/** Full authored row in the admin history list. */
export interface AdminNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  title_ta: string | null
  body_ta: string | null
  url: string | null
  audience: NotificationAudience
  audience_value: string | null
  push_sent: number
  created_at: string
}

// ─── Popup alert shapes ─────────────────────────────────────────────────────────
/** Type of announcement — drives the popup's icon / colour / label. */
export type AlertKind = 'info' | 'alert' | 'update' | 'success'

/** One pending popup alert for the signed-in user. */
export interface ActiveAlert {
  id: string
  kind: AlertKind
  title: string
  body: string
  title_ta: string | null
  body_ta: string | null
  url: string | null
  created_at: string
}

/** Body sent by the superadmin alert composer. */
export interface AlertInput {
  kind: AlertKind
  title: string
  body: string
  titleTa?: string | null
  bodyTa?: string | null
  url?: string | null
  audience: NotificationAudience
  audienceValue?: string | null
  /** ISO datetime after which the alert stops showing (optional). */
  expiresAt?: string | null
}

/** Full authored row in the superadmin alert list. */
export interface AdminAlert {
  id: string
  kind: AlertKind
  title: string
  body: string
  title_ta: string | null
  body_ta: string | null
  url: string | null
  audience: NotificationAudience
  audience_value: string | null
  active: boolean
  expires_at: string | null
  created_at: string
  /** How many users have tapped "Got it". */
  dismissed_count: number
}

export interface PremiumStatus {
  premium: boolean
  /** ISO expiry of the active premium year, or null when not premium. */
  until: string | null
}

/** Full bundle entitlement from GET /api/payments/entitlements. */
export interface BundleEntitlement {
  premium: boolean
  premiumUntil: string | null
  vettri: boolean
  vettriUntil: string | null
  /** premium || vettri — unlocks the Vettri bank (Test Marathon). */
  unlimited: boolean
  rankBooster: boolean
  rankBoosterUntil: string | null
  /** premium || rankBooster — unlocks the Group II/IIA Rank Booster series. */
  rankBoosterUnlocked: boolean
  /** unlimited || rankBooster — the credit-gate bypass (unlimited PYQ/CA/
   *  Subject-practice). Mirrors GET /api/credits' own `unlimited` field. */
  creditsUnlimited: boolean
  /** The standalone ₹399/80-day Group 1 Mock Test Pack. Grants a boosted daily
   *  credit allowance (50 instead of 10), not unlimited credits. */
  mockPack: boolean
  mockPackUntil: string | null
}

/** Public, superadmin-controlled feature flags (defaults applied server-side). */
export interface AppSettings {
  /** Show the random-sampled Group Exam mock tab. */
  mock_group_enabled: boolean
  /** Show the Subject / Topic mock tab. */
  mock_subject_enabled: boolean
  /** Show the scheduled Test Series (Group 1 Marathon) nav tab + Test Arena tile. */
  test_series_enabled: boolean
  /** Show the Vettri Nichayam nav tab + Test Arena tile. */
  vettri_enabled: boolean
  /** Show the Group II/IIA Rank Booster nav tab + Test Arena tile. */
  rank_booster_enabled: boolean
}

/** Explanation-PDF download allowance. Premium users are unlimited (remaining
 *  is null); free users get `cap` downloads in total. */
export interface PdfQuota {
  premium: boolean
  used: number
  cap: number
  /** Remaining free downloads, or null when unlimited (premium). */
  remaining: number | null
}

/** Result of reserving a download slot. `allowed:false` → free cap exhausted. */
export interface PdfDownloadResult extends PdfQuota {
  allowed: boolean
}

// ─── Coupon shapes ─────────────────────────────────────────────────────────────
export type DiscountType = 'flat' | 'percent'

export interface Coupon {
  id: string
  code: string
  promoter_name: string
  discount_type: DiscountType
  /** flat → paise; percent → whole-number 1..100. */
  discount_value: number
  /** Cap (paise) for percentage discounts; null = uncapped. */
  max_discount: number | null
  /** Cap on successful redemptions; null = unlimited. */
  max_redemptions: number | null
  expires_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface CouponWithStats extends Coupon {
  redemptions: number
  /** Total discount given across paid redemptions, in paise. */
  total_discount: number
}

/** Body for create/update. Amounts (discount_value flat, max_discount) in paise. */
export interface CouponInput {
  code?: string
  promoterName: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number | null
  maxRedemptions?: number | null
  expiresAt?: string | null
  active?: boolean
}

export type CouponValidation =
  | { valid: false; reason: string }
  | {
      valid: true
      code: string
      promoterName: string
      discountType: DiscountType
      discountValue: number
      /** All in paise. */
      baseAmount: number
      discount: number
      finalAmount: number
    }

// ─── Payment data shapes ───────────────────────────────────────────────────────
export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt?: string
  status: string
}

/**
 * Order-creation result. A coupon that fully covers the price yields `free`
 * (the server already recorded a paid ₹0 row - no Razorpay order to open);
 * otherwise a real Razorpay order + public key for Checkout.
 */
export type CreateOrderResponse =
  | { free: true }
  | { free?: false; order: RazorpayOrder; keyId: string }

export interface PaymentRow {
  id: string
  razorpay_order_id: string
  razorpay_payment_id: string | null
  amount: number
  currency: string
  status: 'created' | 'paid' | 'failed'
  created_at: string
}

// ─── Superadmin / feedback data shapes ─────────────────────────────────────────
export interface PlatformMetrics {
  totalUsers: number
  activeToday: number
  active7d: number
  active30d: number
  testsCompleted: number
  testsAbandoned: number
  totalQuestions: number
  feedbackCount: number
  avgRating: number
  roleBreakdown: Record<string, number>
  questionsByCategory: Record<string, number>
  signups14d: { date: string; count: number }[]
}

/** Founder revenue analytics. All monetary fields are in paise (₹1 = 100). */
export interface RevenueMetrics {
  currency: string
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  revenueYear: number
  revenueAllTime: number
  paidOrders: number
  payingCustomers: number
  premiumActive: number
  avgOrderValue: number
  totalDiscount: number
  couponOrders: number
  failedPayments: number
  totalUsers: number
  revenueByMonth: { month: string; revenue: number }[]
  topPromoters: { promoter: string; code: string; revenue: number; redemptions: number }[]
}

export interface AdminUserRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  target_group: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  tests_taken: number
  last_active: string | null
  premium: boolean
  premium_until: string | null
  vettri: boolean
  vettri_until: string | null
  rank_booster: boolean
  rank_booster_until: string | null
}

/** Plans a superadmin can comp to a user (mirrors the server allow-list). */
export type GrantablePlan =
  | 'premium_annual'
  | 'vettri_nichayam'
  | 'vettri_month'
  | 'rank_booster_g2'

/** Per-user activity + credit snapshot (superadmin user-detail popup).
 *  Mirrors the superadmin_user_insights RPC. Accuracy is null until the user
 *  has attempted at least one question in that slice. */
export interface UserInsights {
  totals: {
    tests: number
    questions: number
    correct: number
    accuracy: number | null
    time_seconds: number
    tests_7d: number
    tests_30d: number
    last_test_at: string | null
  }
  subjects: {
    subject: string
    tests: number
    questions: number
    accuracy: number | null
    time_seconds: number
  }[]
  categories: {
    category: string
    tests: number
    questions: number
    accuracy: number | null
  }[]
  credits: {
    balance: number
    daily_left: number
    spent: number
    expired: number
    granted: number
  }
  /** Segmentation & reachability profile (insights v2; absent on an old RPC). */
  targeting?: {
    language: 'en' | 'ta' | 'both' | null
    gender: string | null
    exam_date: string | null
    daily_goal: number | null
    signup_at: string
    streak: number
    active_days_30d: number
    last_login_at: string | null
    devices: { label: string | null; last_seen_at: string }[]
    push_devices: number
    payments: {
      orders: number
      lifetime_rupees: number
      last_plan: string | null
      last_paid_at: string | null
    }
    feedback_count: number
    report_count: number
    bookmark_count: number
    revision_pending: number
    seen_questions: number
  }
}

export interface FeedbackRow {
  id: string
  rating: number
  message: string | null
  page: string | null
  created_at: string
  user_name: string | null
  user_email: string | null
}

// ─── Question reports (admin triage) ───────────────────────────────────────────
export type ReportStatus = 'open' | 'resolved' | 'dismissed'

/** One reported question (aggregated across all students who flagged it). */
export interface ReportedQuestion {
  question_id: string
  /** Number of distinct students who reported this question. */
  report_count: number
  /** Reasons students gave (newest first); may be empty if none added notes. */
  reasons: string[]
  first_reported: string
  last_reported: string
  /** Effective triage state - reopens automatically on a fresh report. */
  status: ReportStatus
  /** Admin triage note, if any. */
  note: string | null
  resolved_at: string | null
  /** Name of the admin who last resolved/dismissed it. */
  resolver_name: string | null
  /**
   * The students who flagged this question, newest first — superadmin only.
   * Null for plain admins, who keep the anonymous `reasons` view.
   */
  reporters: ReportReporter[] | null
  /** The full question row, or null if it has since been deleted. */
  question: Question | null
}

/** One student who reported a question, with the note they left. */
export interface ReportReporter {
  user_id: string
  name: string | null
  email: string | null
  /** Used for the WhatsApp / call links; null on accounts with no phone. */
  phone: string | null
  reason: string | null
  reported_at: string
}

/**
 * Superadmin-editable copy for the message students receive when the question
 * they reported is marked resolved. Stored as one jsonb row in app_settings
 * under `report_resolved_message`; `{subject}` and `{note}` are substituted at
 * send time. Blank Tamil fields mean "send English only".
 */
export interface ReportResolvedMessage {
  enabled: boolean
  title: string
  body: string
  title_ta: string
  body_ta: string
}

/** Server-side defaults, mirrored for the editor's "Reset to default" action. */
export const REPORT_RESOLVED_MESSAGE_DEFAULT: ReportResolvedMessage = {
  enabled: true,
  title: 'The question you reported has been fixed',
  body: 'Thanks for flagging it. Our team reviewed the question and made the correction. Please keep reporting anything that looks wrong.',
  title_ta: 'நீங்கள் தெரிவித்த வினா சரிசெய்யப்பட்டது',
  body_ta:
    'தவறைச் சுட்டிக்காட்டியதற்கு நன்றி. எங்கள் குழு அந்த வினாவைப் பரிசீலித்துத் திருத்தியுள்ளது. தவறாகத் தோன்றும் எதையும் தொடர்ந்து தெரிவியுங்கள்.',
}
