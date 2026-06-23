import { describe, it, expect, afterEach, vi } from 'vitest'
import { getDeviceId } from '../lib/device'

afterEach(() => {
  vi.unstubAllGlobals()
})

// A localStorage whose every operation throws - the private/blocked-storage mode
// that previously made getDeviceId() mint a fresh UUID per call (device-cap
// lockout). The module-level cache must keep the id stable across calls instead.
const throwingStorage = {
  getItem() {
    throw new Error('storage blocked')
  },
  setItem() {
    throw new Error('storage blocked')
  },
  removeItem() {
    throw new Error('storage blocked')
  },
}

describe('getDeviceId stability with blocked storage', () => {
  it('returns the same id across calls even when localStorage throws', () => {
    vi.stubGlobal('localStorage', throwingStorage)
    const first = getDeviceId()
    const second = getDeviceId()
    const third = getDeviceId()
    expect(first).toBeTruthy()
    expect(second).toBe(first)
    expect(third).toBe(first)
  })
})
