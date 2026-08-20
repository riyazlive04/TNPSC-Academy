// ─── Store product catalog (server mirror) ──────────────────────────────────
// Mirrors src/lib/iapCatalog.ts on the client. The server keeps its own copy so
// a tampered client cannot claim that some cheap product id maps to the premium
// plan — the plan is always re-derived HERE from the product id inside the
// store-verified receipt, never taken from the request body.
//
// Change both files together.

import type { PlanId } from './pricing.js'

export interface CatalogEntry {
  plan: PlanId
  productId: string
  label: string
}

export const IAP_CATALOG: readonly CatalogEntry[] = [
  {
    plan: 'premium_annual',
    productId: 'com.tnpscmentor.app.premium90',
    label: 'TNPSC Mentors Premium - 6 months',
  },
  {
    plan: 'vettri_nichayam',
    productId: 'com.tnpscmentor.app.vettri60',
    label: 'Vettri Nichayam - full programme',
  },
  {
    plan: 'vettri_month',
    productId: 'com.tnpscmentor.app.vettri30',
    label: 'Vettri Nichayam - 1 month',
  },
  {
    plan: 'rank_booster_g2',
    productId: 'com.tnpscmentor.app.rankbooster90',
    label: 'Group II/ IIA- Rank Booster - 90 days',
  },
  {
    plan: 'group1_mock_pack',
    productId: 'com.tnpscmentor.app.mockpack80',
    label: 'Group 1 Mock Test Pack - 80 days',
  },
] as const

const BY_PRODUCT = new Map<string, CatalogEntry>(IAP_CATALOG.map((e) => [e.productId, e]))

/** The plan a store product grants, or undefined if we don't sell that id. */
export function planForProduct(productId: string): CatalogEntry | undefined {
  return BY_PRODUCT.get(productId)
}
