// ─── Test Series product switches ────────────────────────────────────────────
// Whether each scheduled test-series product is switched on (Group 1 Test
// Marathon, Group II/IIA Rank Booster), and which /test-series tab to show given
// those switches.
//
// Both switches load together, in one request, because /test-series decides
// between them: a tab whose product is off falls back to the other one. When
// they were two independent requests the Group 1 answer could land first — and
// always did when the app header had already fetched it — so the page briefly
// read "Group II/IIA off, Group 1 on" and parked the learner on Group 1. Everyone
// sent to the Group II/IIA tab (the /group-2-test-series pay link, the Test
// Arena banner) could end up looking at the Group 1 series instead.

import { api } from './api'

export type HubTab = 'vettri' | 'rankbooster' | 'targetg2' | 'overall'

export interface TestSeriesFlags {
  /** Group 1 Test Marathon (settings.test_series_enabled). */
  marathon: boolean
  /** Group II/IIA Rank Booster (settings.rank_booster_enabled). */
  rankBooster: boolean
  /** Target Group 2 2026 language series, both tracks (settings.target_g2_enabled). */
  targetG2: boolean
}

/** The product tabs, in the order the hub shows them. `overall` is not a
 *  product and never participates in the fallback below. */
const PRODUCT_TABS = ['vettri', 'rankbooster', 'targetg2'] as const

/** Whether the product behind a tab is switched on. */
function tabEnabled(tab: HubTab, flags: TestSeriesFlags): boolean {
  if (tab === 'vettri') return flags.marathon
  if (tab === 'rankbooster') return flags.rankBooster
  if (tab === 'targetg2') return flags.targetG2
  return true
}

let cache: TestSeriesFlags | null = null
let inflight: Promise<TestSeriesFlags | null> | null = null

/** The flags if this session has already loaded them, else null. */
export function cachedTestSeriesFlags(): TestSeriesFlags | null {
  return cache
}

/**
 * Both flags from one request, shared by every caller while it is open, so the
 * two hooks built on this are always loaded or unloaded together and settle in
 * the same render. Resolves null on failure without caching it — a transient
 * error must not hide both products for the rest of the session — so the next
 * caller retries.
 */
export function loadTestSeriesFlags(): Promise<TestSeriesFlags | null> {
  if (cache) return Promise.resolve(cache)
  inflight =
    inflight ??
    api
      .appSettings()
      .then((s) => {
        cache = {
          marathon: Boolean(s.test_series_enabled),
          rankBooster: Boolean(s.rank_booster_enabled),
          targetG2: Boolean(s.target_g2_enabled),
        }
        return cache
      })
      .catch(() => {
        inflight = null
        return null
      })
  return inflight
}

/**
 * The tab /test-series shows for the one that was asked for (by URL, router
 * state or a tap). A product tab whose product is switched off falls back to
 * the other product, when that one is on.
 *
 * Worked out on every render instead of being written back into state: the
 * flags read false until they load, and a correction saved from a half-loaded
 * answer outlives the answer that made it wrong.
 */
export function shownHubTab(requested: HubTab, flags: TestSeriesFlags): HubTab {
  if (tabEnabled(requested, flags)) return requested
  // The asked-for product is off. Fall back to another product that is on,
  // keeping the hub's own left-to-right order so the choice is predictable.
  return PRODUCT_TABS.find((t) => tabEnabled(t, flags)) ?? requested
}
