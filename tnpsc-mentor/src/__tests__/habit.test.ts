import { describe, it, expect } from 'vitest'
import { daysBetween, longestRun } from '../lib/habit'

describe('daysBetween', () => {
  it('counts whole days between two ISO dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('crosses month and year boundaries correctly', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1) // 2026 is not a leap year
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1)
  })
})

describe('longestRun', () => {
  it('is 0 for no activity and 1 for a single day', () => {
    expect(longestRun([])).toBe(0)
    expect(longestRun(['2026-01-01'])).toBe(1)
  })

  it('counts a fully consecutive run', () => {
    expect(longestRun(['2026-01-01', '2026-01-02', '2026-01-03'])).toBe(3)
  })

  it('resets the run on a gap and reports the longest streak', () => {
    expect(longestRun(['2026-01-01', '2026-01-03'])).toBe(1)
    expect(
      longestRun(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07'])
    ).toBe(3)
  })

  it('treats month/year boundaries as consecutive', () => {
    expect(longestRun(['2026-01-31', '2026-02-01'])).toBe(2)
    expect(longestRun(['2025-12-31', '2026-01-01'])).toBe(2)
  })
})
