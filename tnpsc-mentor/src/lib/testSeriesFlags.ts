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
  /**
   * Group 1 2026 is over (settings.group1_archived). The Group 1 tab, its papers
   * and the Test Arena tile all STAY — people paid for them and they are still
   * good practice — but they render greyed out and labelled as a finished exam,
   * and nothing Group 1 is offered for sale any more.
   *
   * Orthogonal to `marathon` above: `marathon` answers "does this product area
   * exist", this answers "is it still a live exam". Archived-but-on is the whole
   * point — turning `marathon` off instead would take a paying customer's papers
   * away along with the pitch.
   */
  group1Archived: boolean
}

/**
 * Just the switches that say whether a product AREA exists. The tab fallback
 * below is only ever asking "is there a tab here", so it takes this and not the
 * whole flag set: `group1Archived` says an exam is finished, not that its tab is
 * gone, and a retired product keeps its tab so the people who paid for it can
 * still reach their papers. Narrowing the parameter makes that structural — the
 * fallback cannot start reacting to the archive by accident.
 */
export type ProductAreaFlags = Pick<TestSeriesFlags, 'marathon' | 'rankBooster' | 'targetG2'>

/** The product tabs, in the order the hub shows them. `overall` is not a
 *  product and never participates in the fallback below. */
const PRODUCT_TABS = ['vettri', 'rankbooster', 'targetg2'] as const

/** Whether the product behind a tab is switched on. */
function tabEnabled(tab: HubTab, flags: ProductAreaFlags): boolean {
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
          group1Archived: Boolean(s.group1_archived),
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
export function shownHubTab(requested: HubTab, flags: ProductAreaFlags): HubTab {
  if (tabEnabled(requested, flags)) return requested
  // The asked-for product is off. Fall back to another product that is on,
  // keeping the hub's own left-to-right order so the choice is predictable.
  return PRODUCT_TABS.find((t) => tabEnabled(t, flags)) ?? requested
}
