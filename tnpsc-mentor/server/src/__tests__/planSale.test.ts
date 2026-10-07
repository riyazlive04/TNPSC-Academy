import { describe, expect, it } from 'vitest'
import {
  GROUP1_PLANS,
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
      target_g2_sale_enabled: true,
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
    expect(planOnSale(settings(), 'target_g2_en')).toBe(true)
    expect(planOnSale(settings(), 'target_g2_ta')).toBe(true)
  })

  it('maps both Vettri tiers onto the one Vettri switch', () => {
    const off = settings({ vettri_sale_enabled: false })
    expect(planOnSale(off, 'vettri_nichayam')).toBe(false)
    expect(planOnSale(off, 'vettri_month')).toBe(false)
  })

  it('maps both Target Group 2 tracks onto the one series switch', () => {
    // They are two purchases but one product: withdrawing the series has to
    // close both pay links, not leave one of them still taking money.
    const off = settings({ target_g2_sale_enabled: false })
    expect(off.target_g2_sale_enabled).toBe(false)
    expect(planOnSale(off, 'target_g2_en')).toBe(false)
    expect(planOnSale(off, 'target_g2_ta')).toBe(false)
  })

  it('covers every known plan, so none can slip through ungated', () => {
    for (const plan of KNOWN_PLANS) expect(PLAN_SALE_FLAG[plan]).toBeDefined()
  })
})

/**
 * Retiring Group 1 once its exam has been sat (27 Sep 2026).
 *
 * The failure this pins is taking money for a finished exam: the UI greys the
 * papers out and drops every price, so the only thing that still COULD charge is
 * a replayed order request, and that is exactly the path these cover.
 */
describe('planOnSale with Group 1 archived', () => {
  const archived = settings({
    group1_archived: true,
    // Every Group 1 switch deliberately left ON, which is the state the flag has
    // to survive: archiving is one toggle, and if it only worked once somebody
    // had also turned these three off by hand it would not be worth having.
    vettri_sale_enabled: true,
    mock_pack_sale_enabled: true,
  })

  it('withdraws every Group 1 plan even with its own switch still on', () => {
    for (const plan of GROUP1_PLANS) expect(planOnSale(archived, plan)).toBe(false)
  })

  it('withdraws the Group 1 plans by name, so none is missed', () => {
    expect(planOnSale(archived, 'vettri_nichayam')).toBe(false)
    expect(planOnSale(archived, 'vettri_month')).toBe(false)
    expect(planOnSale(archived, 'group1_mock_pack')).toBe(false)
  })

  it('leaves every other exam selling — retiring Group 1 is not a shutdown', () => {
    // Group 2 / 2A is the live exam and pays for the lights; an archive flag that
    // leaked onto it would silently close the whole business.
    expect(planOnSale(archived, 'rank_booster_g2')).toBe(true)
    expect(planOnSale(archived, 'target_g2_en')).toBe(true)
    expect(planOnSale(archived, 'target_g2_ta')).toBe(true)
    expect(planOnSale({ ...archived, premium_sale_enabled: true }, 'premium_annual')).toBe(true)
    expect(planOnSale(archived, null)).toBe(true)
  })

  it('cannot be reopened by turning a Group 1 sale switch back on', () => {
    // The archive check runs BEFORE the per-plan flag. Without that ordering,
    // flipping vettri_sale_enabled in the Payments tab would quietly put a
    // finished exam back on sale from a screen that says nothing about Group 1.
    const reopened = settings({ group1_archived: true, vettri_sale_enabled: true })
    expect(planOnSale(reopened, 'vettri_nichayam')).toBe(false)
  })

  it('sells Group 1 again once the flag is cleared, so this is reversible', () => {
    // A Group 1 2027 edition has to be able to turn this back off.
    const live = settings({ group1_archived: false })
    for (const plan of GROUP1_PLANS) expect(planOnSale(live, plan)).toBe(true)
  })

  it('defaults to NOT archived, so the flag is opt-in', () => {
    expect(PUBLIC_SETTING_DEFAULTS.group1_archived).toBe(false)
    for (const plan of GROUP1_PLANS) expect(planOnSale(settings(), plan)).toBe(true)
  })

  it('lists only real plan ids, so a rename cannot empty the list', () => {
    // GROUP1_PLANS is matched against the ledger's plan ids by string. If one
    // were renamed in pricing.ts and not here, this suite would still pass every
    // test above while the archive silently stopped withdrawing anything.
    for (const plan of GROUP1_PLANS) {
      expect(KNOWN_PLANS.has(plan)).toBe(true)
    }
  })
})
