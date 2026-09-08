import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bundleAccess } from '../lib/premium.js'
import { MOCK_PACK_FREE_CATEGORIES, RANK_BOOSTER_FREE_CATEGORIES } from '../lib/credits.js'
import { RANK_BOOSTER_VALIDITY_MS } from '../pricing.js'

/**
 * The ₹1,249 "Group 2 Test Series" (plan id rank_booster_g2) draws Group 2 / 2A
 * previous-year questions without spending credits, for its whole 90-day window.
 *
 * Unlike the sibling mock-pack test, this one runs the REAL bundleAccess over a
 * stubbed payments ledger, so the half that actually decays — a paid row ageing
 * past its plan's validity — is exercised rather than assumed. Only the final
 * "does this draw cost credits" expression is mirrored, because the function
 * holding it (isUnlimited) also resolves the caller's staff role from the DB.
 */

type Row = { created_at: string; notes: { plan?: string } | null }

/** Minimal stand-in for the one query bundleAccess makes:
 *  from('payments').select(...).eq(...).gte(...).order(...) */
function ledger(rows: Row[]): SupabaseClient {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.gte = () => chain
  chain.order = () => Promise.resolve({ data: rows, error: null })
  return { from: () => chain } as unknown as SupabaseClient
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
const paid = (plan: string, days: number): Row => ({ created_at: daysAgo(days), notes: { plan } })

/** The rule in routes/questions.ts isUnlimited(), for a non-staff caller. */
const drawsFree = (
  b: { creditsUnlimited: boolean; mockPack: boolean; rankBooster: boolean },
  category?: string
): boolean => {
  if (b.creditsUnlimited) return true
  if (!category) return false
  if (b.mockPack && MOCK_PACK_FREE_CATEGORIES.includes(category)) return true
  return b.rankBooster && RANK_BOOSTER_FREE_CATEGORIES.includes(category)
}

describe('Group 2 Test Series — free Group 2 PYQ draws', () => {
  it('does not charge an enrolled member for Group 2 PYQ', async () => {
    const b = await bundleAccess(ledger([paid('rank_booster_g2', 10)]))
    expect(b.rankBooster).toBe(true)
    expect(drawsFree(b, 'pyq2')).toBe(true)
  })

  it('charges a free learner for the same bank', async () => {
    const b = await bundleAccess(ledger([]))
    expect(drawsFree(b, 'pyq2')).toBe(false)
  })

  it('keeps the bank free for the whole 90-day window, and stops after it', async () => {
    const nearEnd = RANK_BOOSTER_VALIDITY_MS / (24 * 60 * 60 * 1000) - 1 // day 89
    const inside = await bundleAccess(ledger([paid('rank_booster_g2', nearEnd)]))
    expect(drawsFree(inside, 'pyq2')).toBe(true)

    // A lapsed plan must fall back to credits — the ledger row is still there,
    // so "did we check its own validity" is the only thing standing between an
    // expired member and free draws forever.
    const lapsed = await bundleAccess(ledger([paid('rank_booster_g2', 120)]))
    expect(lapsed.rankBooster).toBe(false)
    expect(drawsFree(lapsed, 'pyq2')).toBe(false)
  })

  it('rides on creditsUnlimited today, so every bank is free either way', async () => {
    // Rank Booster currently sits inside creditsUnlimited, which is why the
    // category clause above is belt-and-braces rather than the live rule. If
    // this ever flips, the pyq2 assertions above are what keeps the banner
    // honest — and this expectation is the flag that it flipped.
    const b = await bundleAccess(ledger([paid('rank_booster_g2', 10)]))
    expect(b.creditsUnlimited).toBe(true)
    expect(drawsFree(b, 'current_affairs')).toBe(true)
  })

  it('does not hand the Group 1 mock papers to a Group 2 member', async () => {
    // Different product. mockUnlocked = premium || mockPack || vettri, and the
    // Group 2 series is none of those.
    const b = await bundleAccess(ledger([paid('rank_booster_g2', 10)]))
    expect(b.mockUnlocked).toBe(false)
    expect(b.unlimited).toBe(false)
  })

  it('does not let the ₹399 Group 1 pack into the Group 2 bank', async () => {
    // The two category lists are deliberately disjoint: each plan's own PYQs.
    const b = await bundleAccess(ledger([paid('group1_mock_pack', 10)]))
    expect(b.mockPack).toBe(true)
    expect(drawsFree(b, 'pyq2')).toBe(false)
    expect(drawsFree(b, 'pyq')).toBe(true)
  })
})
