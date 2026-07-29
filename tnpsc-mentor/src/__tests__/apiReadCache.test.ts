import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, invalidateReads, tokens } from '../lib/api'

// The stale-while-revalidate read cache in lib/api.ts. It exists because a data
// read costs ~300-600 ms against the live API, which is what made moving between
// tabs feel slow — so the rules it must obey are worth pinning down:
//   • a repeat read inside the TTL makes NO request;
//   • past the TTL the caller still gets an answer immediately, and the copy is
//     refreshed behind them;
//   • a write that changes the data invalidates it;
//   • it never survives a session change.

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

/** api.analytics() is cached with a 60 s window — the app's hottest read. */
const TTL_MS = 60_000

/** Counts calls and serves an incrementing payload, so a refetch is visible. */
function countingFetch() {
  let calls = 0
  const mock = vi.fn(async () => {
    calls += 1
    return new Response(JSON.stringify({ sessions: [calls], answers: [] }), { status: 200 })
  })
  return { mock, calls: () => calls }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemStorage())
  tokens.set('access-1', 'refresh-1')
  // tokens.set() does not clear the cache (only a sign-out does), so start clean.
  invalidateReads()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api read cache', () => {
  it('serves a repeat read from memory instead of the network', async () => {
    const { mock, calls } = countingFetch()
    vi.stubGlobal('fetch', mock)

    const first = await api.analytics()
    const second = await api.analytics()

    expect(calls()).toBe(1)
    expect(second).toEqual(first)
  })

  it('coalesces concurrent cold reads into one request', async () => {
    const { mock, calls } = countingFetch()
    vi.stubGlobal('fetch', mock)

    const [a, b, c] = await Promise.all([api.analytics(), api.analytics(), api.analytics()])

    expect(calls()).toBe(1)
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('past the TTL: answers instantly with the stale copy, then refreshes it', async () => {
    const { mock, calls } = countingFetch()
    vi.stubGlobal('fetch', mock)

    const fresh = await api.analytics()
    expect(fresh).toEqual({ sessions: [1], answers: [] })

    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + TTL_MS + 1_000)

    // The caller does NOT wait on the network — it still gets the old value.
    const stale = await api.analytics()
    expect(stale).toEqual({ sessions: [1], answers: [] })
    expect(calls()).toBe(2) // ...but the refresh behind it has started

    // Let the refresh finish (response parsing is several microtasks deep).
    // Back on the real clock the entry it just wrote reads as fresh, so this
    // last call is served from cache and starts nothing new.
    vi.useRealTimers()
    await new Promise((r) => setTimeout(r, 0))

    expect(await api.analytics()).toEqual({ sessions: [2], answers: [] })
    expect(calls()).toBe(2)
  })

  it('a failed background refresh keeps the last good copy', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) return new Response(JSON.stringify({ sessions: ['good'], answers: [] }), { status: 200 })
        return new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
      })
    )

    await api.analytics()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + TTL_MS + 1_000)

    await expect(api.analytics()).resolves.toEqual({ sessions: ['good'], answers: [] })
    expect(calls).toBe(2)

    vi.useRealTimers()
    await new Promise((r) => setTimeout(r, 0))

    // The 500 must not poison the cache or reject a caller.
    await expect(api.analytics()).resolves.toEqual({ sessions: ['good'], answers: [] })
  })

  it('invalidateReads() drops matching paths only', async () => {
    const { mock, calls } = countingFetch()
    vi.stubGlobal('fetch', mock)

    await api.analytics()
    invalidateReads('/api/materials')
    await api.analytics()
    expect(calls()).toBe(1) // untouched by an unrelated prefix

    invalidateReads('/api/analytics')
    await api.analytics()
    expect(calls()).toBe(2)
  })

  it('never outlives the session: clearing tokens empties the cache', async () => {
    const { mock, calls } = countingFetch()
    vi.stubGlobal('fetch', mock)

    await api.analytics()
    tokens.clear()
    tokens.set('access-2', 'refresh-2')
    await api.analytics()

    // A second account on this device must not read the first one's data.
    expect(calls()).toBe(2)
  })
})
