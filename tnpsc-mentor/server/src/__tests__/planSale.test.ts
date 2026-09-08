import { describe, expect, it } from 'vitest'
import {
  PLAN_SALE_FLAG,
  PUBLIC_SETTING_DEFAULTS,
  planOnSale,
  type PublicSettings,
} from '../lib/settings.js'
import { KNOWN_PLANS } from '../pricing.js'

/**
 * The rule POST /api/payments/order enforces before creating a Razorpay order.
 * These switches are what makes hiding a plan's card a real withdrawal from
 * sale rather than a cosmetic change, so the mapping is worth pinning down.
 */

const settings = (over: Partial<PublicSettings> = {}): PublicSettings => ({
  ...PUBLIC_SETTING_DEFAULTS,
  ...over,
})

describe('planOnSale', () => {
  it('refuses a plan whose own switch is off', () => {
    expect(planOnSale(settings({ premium_sale_enabled: false }), 'premium_annual')).toBe(false)
    expect(planOnSale(settings({ premium_sale_enabled: true }), 'premium_annual')).toBe(true)
  })

  it('lets the master switch veto every plan', () => {
    const allOn = settings({
      premium_sale_enabled: true,
      vettri_sale_enabled: true,
      rank_booster_sale_enabled: true,
      mock_pack_sale_enabled: true,
      payments_enabled: false,
    })
    for (const plan of KNOWN_PLANS) expect(planOnSale(allOn, plan)).toBe(false)
    // …including the generic contribution path, which has no plan id.
    expect(planOnSale(allOn, null)).toBe(false)
  })

  it('governs the generic contribution path by the master switch alone', () => {
    expect(planOnSale(settings(), null)).toBe(true)
    expect(planOnSale(settings(), undefined)).toBe(true)
    expect(planOnSale(settings({ payments_enabled: false }), null)).toBe(false)
  })

  it('ships with Premium withdrawn and every other plan selling', () => {
    expect(planOnSale(settings(), 'premium_annual')).toBe(false)
    expect(planOnSale(settings(), 'vettri_nichayam')).toBe(true)
    expect(planOnSale(settings(), 'vettri_month')).toBe(true)
    expect(planOnSale(settings(), 'rank_booster_g2')).toBe(true)
    expect(planOnSale(settings(), 'group1_mock_pack')).toBe(true)
  })

  it('maps both Vettri tiers onto the one Vettri switch', () => {
    const off = settings({ vettri_sale_enabled: false })
    expect(planOnSale(off, 'vettri_nichayam')).toBe(false)
    expect(planOnSale(off, 'vettri_month')).toBe(false)
  })

  it('covers every known plan, so none can slip through ungated', () => {
    for (const plan of KNOWN_PLANS) expect(PLAN_SALE_FLAG[plan]).toBeDefined()
  })
})
