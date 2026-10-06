import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bundleAccess } from '../lib/premium.js'
import { TEST_SERIES_CONFIG } from '../lib/testSeriesCatalog.js'

/**
 * Target Group 2 2026 is the one plan on the ledger that is standalone in BOTH
 * directions: no other plan grants it, and it grants no other plan. Every other
 * entitlement on BundleEntitlement is some union of the paid plans, so the easy
 * mistake when the next plan is added is to fold these in with the rest — which
 * would silently hand ₹849 buyers the Group 1 marathon, or hand Premium buyers
 * a series they were never sold.
 *
 * The two tracks are also separate purchases, so owning English must never
 * unlock Tamil. That one is worth pinning because the papers are served by a
 * SHARED question category (`testseries_g2t`) — only the entitlement field in
 * TEST_SERIES_CONFIG keeps the two apart.
 */

type Row = { created_at: string; notes: { plan?: string } | null }

/** The slice of the Supabase client bundleAccess actually uses. */
function dbWith(rows: Row[]): SupabaseClient {
  const result = { data: rows, error: null }
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => Promise.resolve(result),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

const paidNow = (plan: string): Row => ({ created_at: new Date().toISOString(), notes: { plan } })

describe('Target Group 2 2026 entitlement', () => {
  it('unlocks only the track that was actually bought', async () => {
    const en = await bundleAccess(dbWith([paidNow('target_g2_en')]))
    expect(en.targetG2English).toBe(true)
    expect(en.targetG2Tamil).toBe(false)
    expect(en.targetG2).toBe(true)

    const ta = await bundleAccess(dbWith([paidNow('target_g2_ta')]))
    expect(ta.targetG2Tamil).toBe(true)
    expect(ta.targetG2English).toBe(false)
    expect(ta.targetG2).toBe(true)
  })

  it('is granted by no other plan — not even Premium', async () => {
    for (const plan of [
      'premium_annual',
      'vettri_nichayam',
      'vettri_month',
      'rank_booster_g2',
      'group1_mock_pack',
    ]) {
      const e = await bundleAccess(dbWith([paidNow(plan)]))
      expect(e.targetG2English, plan).toBe(false)
      expect(e.targetG2Tamil, plan).toBe(false)
      expect(e.targetG2, plan).toBe(false)
    }
  })

  it('grants no other plan, including the credit-gate bypass', async () => {
    for (const plan of ['target_g2_en', 'target_g2_ta']) {
      const e = await bundleAccess(dbWith([paidNow(plan)]))
      expect(e.premium, plan).toBe(false)
      expect(e.vettri, plan).toBe(false)
      expect(e.unlimited, plan).toBe(false)
      expect(e.rankBooster, plan).toBe(false)
      expect(e.rankBoosterUnlocked, plan).toBe(false)
      expect(e.mockUnlocked, plan).toBe(false)
      expect(e.mockPack, plan).toBe(false)
      // The series never spends credits, so folding it into the bypass would
      // hand out unlimited practice app-wide for the cheapest plan we sell.
      expect(e.creditsUnlimited, plan).toBe(false)
    }
  })

  it('lapses with its own 90-day window', async () => {
    const old = {
      created_at: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
      notes: { plan: 'target_g2_en' },
    }
    const e = await bundleAccess(dbWith([old]))
    expect(e.targetG2English).toBe(false)
  })

  it('keeps the two tracks on different entitlement fields in one category', () => {
    const en = TEST_SERIES_CONFIG.g2_target_en
    const ta = TEST_SERIES_CONFIG.g2_target_ta
    expect(en.category).toBe(ta.category)
    expect(en.entitlementField).toBe('targetG2English')
    expect(ta.entitlementField).toBe('targetG2Tamil')
  })
})
