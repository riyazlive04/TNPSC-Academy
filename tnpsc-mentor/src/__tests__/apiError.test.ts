import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError } from '../lib/api'

// The language store persists through localStorage; give it somewhere to live.
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
  // The suppression path logs the original; keep the test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ApiError', () => {
  // The 5 Aug 2026 regression: a missing profiles row made PostgREST return
  // "Cannot coerce the result to a single JSON object", which reached the user
  // as a toast on the profile screen.
  it('replaces a leaked PostgREST message with user-facing copy', () => {
    const e = new ApiError('Cannot coerce the result to a single JSON object', 400)
    expect(e.message).toBe('Something went wrong. Please try again.')
    // The original is still available for logs and debugging.
    expect(e.rawMessage).toBe('Cannot coerce the result to a single JSON object')
  })

  it.each([
    'duplicate key value violates unique constraint "profiles_pkey"',
    'relation "public.foo" does not exist',
    'null value in column "user_id" violates not-null constraint',
    'PGRST202: function not found',
  ])('suppresses other database internals: %s', (raw) => {
    expect(new ApiError(raw, 400).message).toBe('Something went wrong. Please try again.')
  })

  // Deliberate server copy must survive — several screens rely on showing it.
  it.each([
    'Invalid coupon code.',
    'Order not found.',
    'Staff accounts cannot be deleted from the app. Ask a superadmin to remove this account.',
    'Not found.',
  ])('keeps server copy meant for users verbatim: %s', (msg) => {
    expect(new ApiError(msg, 400).message).toBe(msg)
  })

  it('preserves status and body for callers that read them', () => {
    const e = new ApiError('device_limit', 403, { devices: [1, 2] })
    expect(e.status).toBe(403)
    expect(e.data).toEqual({ devices: [1, 2] })
    expect(e.message).toBe('device_limit')
  })
})
