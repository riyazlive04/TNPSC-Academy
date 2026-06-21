// ─── API client ──────────────────────────────────────────────────────────────
// The browser now talks ONLY to the Express API (see /server). Supabase is no
// longer imported in the frontend; this module owns auth tokens, refresh, and
// every data call. A thin typed surface keeps the rest of the app unchanged.

import type {
  Kural,
  Profile,
  Question,
  QuizConfig,
  RevisionAnalytics,
  RevisionTopic,
  SubmitResult,
  TestAnswer,
  UserRole,
} from '../types'

import { getDeviceId } from './device'
import { Capacitor } from '@capacitor/core'

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
 * Fire-and-forget ping to /api/health. The API runs on Render's free plan, which
 * spins the container down after ~15 min idle and takes 30-60s to cold-start.
 * Calling this on app mount starts that wake-up in parallel with the rest of the
 * boot, so the server is (often already) warm by the time the user navigates.
 * A scheduled cron (see .github/workflows/keep-alive.yml) keeps it warm even
 * when no one is on the site.
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
    // Web NEVER persists the refresh token in JS-readable storage — the server's
    // HttpOnly cookie holds it. Only native (no cross-site cookie) stores it.
    if (isNative) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

/** Whether a token refresh is worth attempting. Native needs a stored refresh
 * token; web relies on the HttpOnly cookie (invisible to JS), so it always tries
 * and lets the server decide based on the cookie. */
export function canTryRefresh(): boolean {
  return isNative ? !!tokens.refresh : true
}

export class ApiError extends Error {
  status: number
  /** The parsed JSON error body, so callers can read extra fields (e.g. the
   * device list returned with a `device_limit` 403). */
  data: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  if (!canTryRefresh()) return false
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS,
      // Native sends its stored refresh token; web sends none — the HttpOnly
      // cookie carries it automatically with credentials: 'include'.
      body: JSON.stringify(
        isNative ? { refresh_token: tokens.refresh, device_id: getDeviceId() } : { device_id: getDeviceId() }
      ),
    })
    if (!res.ok) return false
    const data = (await res.json()) as SessionResponse
    tokens.set(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean // attach bearer token (default true)
  query?: Record<string, string | number | undefined>
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts

  let url = `${API_URL}${path}`
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
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

  // Transparent one-shot refresh on expiry.
  if (res.status === 401 && auth && canTryRefresh()) {
    if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null))
    const ok = await refreshing
    if (ok) res = await send()
    else tokens.clear()
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

export const api = {
  auth: {
    async login(email: string, password: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password, device_id: getDeviceId() },
      })
      tokens.set(data.access_token, data.refresh_token)
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
    }): Promise<SessionResponse | { requiresConfirmation: true }> {
      const data = await request<SessionResponse | { requiresConfirmation: true }>(
        '/api/auth/register',
        { method: 'POST', auth: false, body: { ...params, device_id: getDeviceId() } }
      )
      if ('access_token' in data) tokens.set(data.access_token, data.refresh_token)
      return data
    },
    /** Exchange a Google ID token (from Google Identity Services in the browser)
     * for the same session the email/password flow returns. Auto-creates the
     * account on first sign-in. */
    async google(idToken: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/google', {
        method: 'POST',
        auth: false,
        body: { idToken, device_id: getDeviceId() },
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
    async me(): Promise<{ user: { id: string }; profile: Profile | null }> {
      return request('/api/auth/me')
    },
    async logout() {
      // Revoke this device's session server-side (frees a slot for the 2-device
      // limit), then drop tokens locally. Best-effort — never block sign-out.
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
  async countQuestions(config: QuizConfig): Promise<number> {
    const data = await request<{ count: number }>('/api/questions/count', {
      method: 'POST',
      body: { config },
    })
    return data.count
  },
  async submitTest(session: Record<string, unknown>, answers: unknown[]): Promise<SubmitResult> {
    return request<SubmitResult>('/api/tests/submit', {
      method: 'POST',
      body: { session, answers },
    })
  },
  async abandonTest(session: Record<string, unknown>): Promise<void> {
    await request('/api/tests/abandon', { method: 'POST', body: { session } })
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

  // ─── Analytics ─────────────────────────────────────────────────────────────
  async analytics(): Promise<{ sessions: unknown[]; answers: unknown[] }> {
    return request('/api/analytics')
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
    const data = await request<{ items: RevisionTopic[] }>('/api/revisions')
    return data.items
  },
  async revisionAnalytics(): Promise<RevisionAnalytics> {
    const data = await request<{ analytics: RevisionAnalytics }>('/api/revisions/analytics')
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
    const data = await request<{ percentile: number | null }>('/api/profile/percentile')
    return data.percentile
  },
  async activityRows(days = 60): Promise<{ activity_date: string; questions: number; tests: number }[]> {
    const data = await request<{
      rows: { activity_date: string; questions: number; tests: number }[]
    }>('/api/profile/activity', { query: { days } })
    return data.rows
  },
  async recordActivity(questions: number, tests = 1): Promise<void> {
    await request('/api/profile/activity', { method: 'POST', body: { questions, tests } })
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
  /** Admin/superadmin: set a reported question's triage state. */
  async adminSetReportStatus(
    questionId: string,
    status: ReportStatus,
    note?: string
  ): Promise<void> {
    await request('/api/admin/question-reports/status', {
      method: 'POST',
      body: { questionId, status, note },
    })
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
    async users(search?: string, limit = 200): Promise<AdminUserRow[]> {
      const data = await request<{ users: AdminUserRow[] }>('/api/superadmin/users', {
        query: { search: search || undefined, limit },
      })
      return data.users
    },
    async setRole(userId: string, role: UserRole): Promise<void> {
      await request('/api/superadmin/users/role', { method: 'POST', body: { userId, role } })
    },
    async feedback(limit = 100): Promise<FeedbackRow[]> {
      const data = await request<{ feedback: FeedbackRow[] }>('/api/superadmin/feedback', {
        query: { limit },
      })
      return data.feedback
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
      return request('/api/payments/verify', { method: 'POST', body: params })
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
}

// ─── Notification shapes ────────────────────────────────────────────────────────
export type NotificationKind = 'push' | 'system'
export type NotificationAudience = 'all' | 'premium' | 'free' | 'group'

/** One entry in a user's in-app feed. */
export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  url: string | null
  created_at: string
  read: boolean
}

/** Body sent by the superadmin composer. */
export interface NotificationInput {
  kind: NotificationKind
  title: string
  body: string
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
  url: string | null
  audience: NotificationAudience
  audience_value: string | null
  push_sent: number
  created_at: string
}

export interface PremiumStatus {
  premium: boolean
  /** ISO expiry of the active premium year, or null when not premium. */
  until: string | null
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
 * (the server already recorded a paid ₹0 row — no Razorpay order to open);
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
  role: UserRole
  created_at: string
  tests_taken: number
  last_active: string | null
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
  /** Effective triage state — reopens automatically on a fresh report. */
  status: ReportStatus
  /** Admin triage note, if any. */
  note: string | null
  resolved_at: string | null
  /** Name of the admin who last resolved/dismissed it. */
  resolver_name: string | null
  /** The full question row, or null if it has since been deleted. */
  question: Question | null
}
