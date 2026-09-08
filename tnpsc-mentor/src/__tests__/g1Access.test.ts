import { describe, expect, it } from 'vitest'
import {
  mockEntryVisible,
  mockOwned,
  mockTap,
  seriesTap,
  showsPrice,
  type G1Entitlement,
  type G1Sales,
} from '../lib/g1Access'

// The two Group 1 buttons route by plan. These pin the matrix, because the
// failure modes are silent: a paying customer sent to a payment sheet for
// something they already own, or a free learner walked into content.

const free: G1Entitlement = { unlimited: false, mockPack: false }
const packOwner: G1Entitlement = { unlimited: false, mockPack: true }
const seriesOwner: G1Entitlement = { unlimited: true, mockPack: false }

const allOnSale: G1Sales = { vettri: true, premium: true, mockPack: true }
const nothingOnSale: G1Sales = { vettri: false, premium: false, mockPack: false }

describe('Group 1 Test Series button', () => {
  it('sells to a free learner', () => {
    expect(seriesTap(free, allOnSale)).toBe('buy')
  })

  it('opens for a ₹1,899 owner instead of selling it again', () => {
    expect(seriesTap(seriesOwner, allOnSale)).toBe('open')
  })

  it('still sells while only Premium is on sale', () => {
    // Premium is a superset of the series, so it is a valid way to buy it.
    expect(seriesTap(free, { ...nothingOnSale, premium: true })).toBe('buy')
  })

  it('opens rather than dead-ending when nothing granting it is on sale', () => {
    // The panel behind it carries its own paywall; a purchase flow with no
    // purchasable plan would just be a broken button.
    expect(seriesTap(free, nothingOnSale)).toBe('open')
  })

  it('is not affected by owning the mock pack', () => {
    // The ₹399 pack does not include the scheduled series.
    expect(seriesTap(packOwner, allOnSale)).toBe('buy')
  })
})

describe('Group 1 Mock Test button', () => {
  it('sells to a free learner', () => {
    expect(mockTap(free, allOnSale)).toBe('buy')
  })

  it('opens for a ₹399 pack owner — the plan that sells these papers', () => {
    expect(mockTap(packOwner, allOnSale)).toBe('open')
  })

  it('opens for a ₹1,899 / Premium owner, who already has them', () => {
    // Mirrors the server's mockUnlocked = premium || mockPack || vettri.
    // Pitching the pack here would be selling a plan they already own.
    expect(mockTap(seriesOwner, allOnSale)).toBe('open')
  })

  it('opens rather than dead-ending when the pack is off sale', () => {
    expect(mockTap(free, nothingOnSale)).toBe('open')
  })
})

describe('mock entry visibility', () => {
  it('shows for an owner even when the pack is withdrawn from sale', () => {
    // Their shortcut must not disappear because the plan stopped being sold.
    expect(mockEntryVisible(packOwner, nothingOnSale)).toBe(true)
    expect(mockEntryVisible(seriesOwner, nothingOnSale)).toBe(true)
  })

  it('shows to a free learner while the pack is on sale', () => {
    expect(mockEntryVisible(free, allOnSale)).toBe(true)
  })

  it('hides when a non-owner cannot buy it either', () => {
    expect(mockEntryVisible(free, nothingOnSale)).toBe(false)
  })
})

describe('price display', () => {
  it('prices a button only when it is actually selling something', () => {
    expect(showsPrice(seriesTap(free, allOnSale))).toBe(true)
    expect(showsPrice(seriesTap(seriesOwner, allOnSale))).toBe(false)
    expect(showsPrice(mockTap(packOwner, allOnSale))).toBe(false)
  })
})

describe('mock ownership', () => {
  it('counts every plan that includes the papers', () => {
    expect(mockOwned(free)).toBe(false)
    expect(mockOwned(packOwner)).toBe(true)
    expect(mockOwned(seriesOwner)).toBe(true)
  })
})
