// ─── Store product catalog ──────────────────────────────────────────────────
// The one place that maps our internal plan ids onto App Store / Play Store
// product ids. The SAME product id is used on both stores so the server can key
// off it without caring which platform a purchase came from.
//
// Product TYPE, and why:
//   • App Store → "Non-Renewing Subscription". Access is a fixed window the
//     server owns (see server/src/pricing.ts), users re-buy deliberately, and
//     nothing auto-debits. Apple designates exactly this type for time-limited
//     access to content; auto-renewable would also drag in India's RBI e-mandate
//     friction for a product nobody expects to renew silently.
//   • Play Store → one-time in-app product, CONSUMABLE, so it can be bought again
//     when the window lapses.
// Both are fetched as PURCHASE_TYPE.INAPP and finished/consumed after our server
// records them.
//
// The server mirrors this table in server/src/iapCatalog.ts — change both.

/** Internal plan ids, matching `notes.plan` on the payments ledger. */
export type PlanId =
  | 'premium_annual'
  | 'vettri_nichayam'
  | 'vettri_month'
  | 'rank_booster_g2'
  | 'group1_mock_pack'

export interface CatalogEntry {
  plan: PlanId
  /** Product id registered in BOTH App Store Connect and Play Console. */
  productId: string
  /** Rupee price the web/Razorpay flow charges. Native shows the STORE price. */
  webPricePaise: number
  /** English label used in confirmation copy and the payments ledger note. */
  label: string
}

export const IAP_CATALOG: readonly CatalogEntry[] = [
  {
    plan: 'premium_annual',
    productId: 'com.tnpscmentor.app.premium90',
    webPricePaise: 169900,
    label: 'TNPSC Mentors Premium - 6 months',
  },
  {
    plan: 'vettri_nichayam',
    productId: 'com.tnpscmentor.app.vettri60',
    webPricePaise: 89900,
    label: 'Group 1 Test Series - full programme',
  },
  {
    plan: 'vettri_month',
    productId: 'com.tnpscmentor.app.vettri30',
    webPricePaise: 49900,
    label: 'Group 1 Test Series - 1 month',
  },
  {
    plan: 'rank_booster_g2',
    productId: 'com.tnpscmentor.app.rankbooster90',
    webPricePaise: 124900,
    label: 'Group II/ IIA- Rank Booster - 90 days',
  },
  {
    plan: 'group1_mock_pack',
    productId: 'com.tnpscmentor.app.mockpack80',
    webPricePaise: 39900,
    label: 'Group 1 Mock Test Pack - 80 days',
  },
] as const

const BY_PLAN = new Map<PlanId, CatalogEntry>(IAP_CATALOG.map((e) => [e.plan, e]))
const BY_PRODUCT = new Map<string, CatalogEntry>(IAP_CATALOG.map((e) => [e.productId, e]))

export function catalogForPlan(plan: PlanId): CatalogEntry | undefined {
  return BY_PLAN.get(plan)
}

export function catalogForProduct(productId: string): CatalogEntry | undefined {
  return BY_PRODUCT.get(productId)
}

/** Every product id, for the one getProducts() call that warms the price cache. */
export const ALL_PRODUCT_IDS: readonly string[] = IAP_CATALOG.map((e) => e.productId)
