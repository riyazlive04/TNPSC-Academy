import type { BundleEntitlement } from './premium.js'

/**
 * Config for one scheduled "Test Series" product. The `test_series` catalog
 * table holds rows for every series (discriminated by its `series` column);
 * the question rows for each series live under their own `questions.category`
 * (the same partition pattern already used for pyq/pyq2/mock/vettri/testseries)
 * rather than a `series` column on `questions`.
 *
 * A category is normally one series' private bank. The two Target Group 2
 * tracks are the exception: they SHARE `testseries_g2t`, because their three
 * Grand Mocks sit the same General Studies paper and only differ in the
 * language half. Which banks make up a paper is therefore the catalog row's
 * `question_sets` (see supabase/target_g2_2026.sql), not its `test_set`.
 */
export interface SeriesConfig {
  category: string
  label: string
  /** Which field of BundleEntitlement (see lib/premium.ts) unlocks this series. */
  entitlementField: keyof BundleEntitlement
}

export const TEST_SERIES_CONFIG = {
  g1_marathon: {
    category: 'testseries',
    label: 'Test Marathon 2026',
    // Premium OR Vettri Nichayam unlocks the Group 1 Marathon.
    entitlementField: 'unlimited',
  },
  g2a_rankbooster: {
    category: 'testseries_g2',
    label: 'Group II/ IIA- Rank Booster',
    // Premium OR the standalone Rank Booster plan — deliberately NOT Vettri.
    entitlementField: 'rankBoosterUnlocked',
  },
  g2_target_en: {
    category: 'testseries_g2t',
    label: 'Target Group 2 2026 — General English',
    // Standalone: ONLY the ₹849 English-track plan. Premium does not include
    // it, and the Tamil track does not either — they are two purchases.
    entitlementField: 'targetG2English',
  },
  g2_target_ta: {
    category: 'testseries_g2t',
    label: 'Target Group 2 2026 — General Tamil',
    entitlementField: 'targetG2Tamil',
  },
} as const satisfies Record<string, SeriesConfig>

export type SeriesKey = keyof typeof TEST_SERIES_CONFIG

/** Existing clients (older Android bundles with no OTA) never send a `series`
 *  param — they mean the original Group 1 Marathon. Keep that the default. */
export const DEFAULT_SERIES: SeriesKey = 'g1_marathon'

/** Validates an incoming `series` value; returns null when unrecognized. */
export function resolveSeries(input: unknown): SeriesKey | null {
  const key = String(input ?? DEFAULT_SERIES)
  return Object.prototype.hasOwnProperty.call(TEST_SERIES_CONFIG, key) ? (key as SeriesKey) : null
}
