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

export type HubTab = 'vettri' | 'rankbooster' | 'overall'

export interface TestSeriesFlags {
  /** Group 1 Test Marathon (settings.test_series_enabled). */
  marathon: boolean
  /** Group II/IIA Rank Booster (settings.rank_booster_enabled). */
  rankBooster: boolean
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
  if (requested === 'rankbooster' && !flags.rankBooster && flags.marathon) return 'vettri'
  if (requested === 'vettri' && !flags.marathon && flags.rankBooster) return 'rankbooster'
  return requested
}
