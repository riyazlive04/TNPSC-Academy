import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, tokens, UnauthenticatedError } from '../lib/api'

// In-memory localStorage so the token store works in the node test env.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemStorage())
  // Web mode (canTryRefresh always true) needs an access token to send auth.
  tokens.set('access-1', 'refresh-1')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api request() - single-flight refresh', () => {
  it('coalesces N concurrent 401s into exactly ONE refresh call, then retries', async () => {
    let refreshCalls = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/refresh')) {
        refreshCalls++
        return new Response(
          JSON.stringify({ access_token: 'access-2', refresh_token: 'refresh-2', user: { id: 'u' }, profile: null }),
          { status: 200 }
        )
      }
      // First attempt 401s (expired access token); the post-refresh retry succeeds.
      const headers = (init?.headers ?? {}) as Record<string, string>
      if (headers.Authorization === 'Bearer access-2') {
        return new Response(JSON.stringify({ count: 7 }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'expired' }), { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    // Fire several auth'd calls at once - all hit the same in-flight refresh.
    const results = await Promise.all([
      api.reviewCount(),
      api.reviewCount(),
      api.reviewCount(),
      api.reviewCount(),
    ])

    expect(refreshCalls).toBe(1)
    expect(results).toEqual([7, 7, 7, 7])
    // Tokens were rotated by the successful refresh.
    expect(tokens.access).toBe('access-2')
  })

  it('on refresh failure: clears tokens once and throws UnauthenticatedError', async () => {
    const clearSpy = vi.spyOn(tokens, 'clear')
    let refreshCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/auth/refresh')) {
        refreshCalls++
        return new Response(JSON.stringify({ error: 'no session' }), { status: 401 })
      }
      return new Response(JSON.stringify({ error: 'expired' }), { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const settled = await Promise.allSettled([api.reviewCount(), api.reviewCount(), api.reviewCount()])

    // Exactly one refresh attempt despite three concurrent 401s.
    expect(refreshCalls).toBe(1)
    // Every caller saw the distinct signed-out error, not a raw 401.
    for (const s of settled) {
      expect(s.status).toBe('rejected')
      const reason = (s as PromiseRejectedResult).reason
      expect(reason).toBeInstanceOf(UnauthenticatedError)
      expect(reason.code).toBe('unauthenticated')
    }
    // Tokens cleared exactly once (inside the shared refresh path), not per caller.
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(tokens.access).toBeNull()
  })
})
