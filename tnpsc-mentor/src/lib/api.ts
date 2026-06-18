// ─── API client ──────────────────────────────────────────────────────────────
// The browser now talks ONLY to the Express API (see /server). Supabase is no
// longer imported in the frontend; this module owns auth tokens, refresh, and
// every data call. A thin typed surface keeps the rest of the app unchanged.

import type {
  Profile,
  Question,
  QuizConfig,
  SubmitResult,
  TestAnswer,
  UserRole,
} from '../types'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

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
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refresh_token = tokens.refresh
  if (!refresh_token) return false
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
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
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await send()

  // Transparent one-shot refresh on expiry.
  if (res.status === 401 && auth && tokens.refresh) {
    if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null))
    const ok = await refreshing
    if (ok) res = await send()
    else tokens.clear()
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status)
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

export const api = {
  auth: {
    async login(email: string, password: string): Promise<SessionResponse> {
      const data = await request<SessionResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      })
      tokens.set(data.access_token, data.refresh_token)
      return data
    },
    async register(params: {
      fullName: string
      email: string
      phone: string
      password: string
      targetGroup: string
    }): Promise<SessionResponse | { requiresConfirmation: true }> {
      const data = await request<SessionResponse | { requiresConfirmation: true }>(
        '/api/auth/register',
        { method: 'POST', auth: false, body: params }
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
        body: { idToken },
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
    logout() {
      tokens.clear()
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
  /** PYQ History bank counts per period ('ancient' | 'medieval' | 'modern'). */
  async historyPeriods(): Promise<Record<string, number>> {
    const data = await request<{ counts: Record<string, number> }>(
      '/api/questions/history-periods',
      { method: 'POST', body: {} }
    )
    return data.counts
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
  async adminBulkInsert(rows: Record<string, unknown>[]): Promise<{ inserted?: number }> {
    const data = await request<{ result: { inserted?: number } | null }>(
      '/api/admin/questions/bulk',
      { method: 'POST', body: { rows } }
    )
    return data.result ?? {}
  },

  // ─── Superadmin console ──────────────────────────────────────────────────
  superadmin: {
    async metrics(): Promise<PlatformMetrics> {
      const data = await request<{ metrics: PlatformMetrics }>('/api/superadmin/metrics')
      return data.metrics
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
  },

  // ─── Payments (Razorpay) ─────────────────────────────────────────────────
  // The browser only ever sees the PUBLIC key id (returned with the order); the
  // secret stays on the server, which also verifies the checkout signature.
  payments: {
    /** Create a Razorpay order (amount in paise). Returns the order + public key. */
    async createOrder(amount: number, notes?: Record<string, string>): Promise<CreateOrderResponse> {
      return request<CreateOrderResponse>('/api/payments/order', {
        method: 'POST',
        body: { amount, notes },
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
  },
}

// ─── Payment data shapes ───────────────────────────────────────────────────────
export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt?: string
  status: string
}

export interface CreateOrderResponse {
  order: RazorpayOrder
  keyId: string
}

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
