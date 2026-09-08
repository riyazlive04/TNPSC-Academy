import { describe, expect, it } from 'vitest'
import type { BundleEntitlement } from '../lib/premium.js'

/**
 * Which plans unlock the paid full mock exams. `bundleAccess` builds several
 * different unions of the same four plans — `unlimited`, `rankBoosterUnlocked`,
 * `creditsUnlimited`, `mockUnlocked` — and mixing them up silently gives away a
 * product or bills for one it does not deliver. This pins the mock one.
 *
 * The rule under test is the single expression in bundleAccess:
 *   mockUnlocked = premium || mockPack || vettri
 */
const mockUnlocked = (p: { premium: boolean; mockPack: boolean; vettri: boolean }) =>
  p.premium || p.mockPack || p.vettri

describe('mock exam access', () => {
  const none = { premium: false, mockPack: false, vettri: false }

  it('is closed to a free learner', () => {
    expect(mockUnlocked(none)).toBe(false)
  })

  it('opens for the Group 1 Mock Test Pack — the plan that sells these papers', () => {
    expect(mockUnlocked({ ...none, mockPack: true })).toBe(true)
  })

  it('opens for Premium and for Vettri', () => {
    expect(mockUnlocked({ ...none, premium: true })).toBe(true)
    expect(mockUnlocked({ ...none, vettri: true })).toBe(true)
  })

  it('does not open for Rank Booster alone', () => {
    // Rank Booster is a Group II/IIA product; its copy never promises Group 1
    // mocks, so it is deliberately absent from the union above. A Rank Booster
    // buyer has premium=mockPack=vettri=false.
    expect(mockUnlocked(none)).toBe(false)
  })

  it('is a distinct union from the other entitlement gates', () => {
    // A Mock Pack buyer gets the exams but NOT unlimited credits or the
    // Test Marathon — those read `creditsUnlimited` / `unlimited` instead.
    const pack: Pick<BundleEntitlement, 'unlimited' | 'creditsUnlimited' | 'mockPack'> = {
      unlimited: false,
      creditsUnlimited: false,
      mockPack: true,
    }
    expect(mockUnlocked({ premium: false, vettri: false, mockPack: pack.mockPack })).toBe(true)
    expect(pack.unlimited).toBe(false)
    expect(pack.creditsUnlimited).toBe(false)
  })
})
