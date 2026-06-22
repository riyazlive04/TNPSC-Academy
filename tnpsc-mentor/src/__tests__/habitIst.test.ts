import { describe, it, expect, afterEach, vi } from 'vitest'
import { computeStreak, todayIso } from '../lib/habit'

// computeStreak is exercised against a fixed clock so the IST day boundary is
// deterministic regardless of where the test runner's local zone sits.

afterEach(() => {
  vi.useRealTimers()
})

/** Set the wall clock to a precise UTC instant. */
function freezeUtc(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe('todayIso (IST day boundary)', () => {
  it('rolls to the next day at IST midnight, not UTC midnight', () => {
    // 2026-06-21 19:00 UTC = 2026-06-22 00:30 IST → already the 22nd in India.
    freezeUtc('2026-06-21T19:00:00Z')
    expect(todayIso()).toBe('2026-06-22')
  })

  it('is still the prior IST day just before IST midnight', () => {
    // 2026-06-21 18:00 UTC = 2026-06-21 23:30 IST → still the 21st.
    freezeUtc('2026-06-21T18:00:00Z')
    expect(todayIso()).toBe('2026-06-21')
  })
})

describe('computeStreak (IST)', () => {
  it('counts consecutive IST days ending today', () => {
    freezeUtc('2026-06-22T05:00:00Z') // 10:30 IST on the 22nd
    const dates = new Set(['2026-06-20', '2026-06-21', '2026-06-22'])
    expect(computeStreak(dates)).toBe(3)
  })

  it('continues from yesterday when today has no activity yet', () => {
    freezeUtc('2026-06-22T05:00:00Z')
    const dates = new Set(['2026-06-20', '2026-06-21'])
    expect(computeStreak(dates)).toBe(2)
  })

  it('breaks the streak on a gap', () => {
    freezeUtc('2026-06-22T05:00:00Z')
    const dates = new Set(['2026-06-19', '2026-06-22'])
    expect(computeStreak(dates)).toBe(1)
  })

  it('uses the IST calendar day at a UTC/IST boundary instant', () => {
    // 2026-06-21 20:00 UTC = 2026-06-22 01:30 IST. Activity on the IST 22nd
    // should count even though UTC still reads the 21st.
    freezeUtc('2026-06-21T20:00:00Z')
    const dates = new Set(['2026-06-21', '2026-06-22'])
    expect(computeStreak(dates)).toBe(2)
  })

  it('is 0 with no activity', () => {
    freezeUtc('2026-06-22T05:00:00Z')
    expect(computeStreak(new Set())).toBe(0)
  })
})
