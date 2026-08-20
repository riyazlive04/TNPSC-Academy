// ─── Server-side pricing (single source of truth) ───────────────────────────
// Real prices live on the server so a hostile client can't send a cheaper
// amount. The frontend mirrors PREMIUM_PRICE_PAISE for display only — the order
// route recomputes the base here before applying any coupon.

/** Premium plan price in paise (₹1 = 100). Mirrors PremiumCard.tsx (₹1,699). */
export const PREMIUM_PRICE_PAISE = 169900 // ₹1,699

/** Vettri Nichayam FULL price in paise (single payment, two months). Mirrors ₹899. */
export const VETTRI_PRICE_PAISE = 89900 // ₹899

/** Vettri Nichayam MONTHLY price in paise (30-day; pay again to renew). ₹499. */
export const VETTRI_MONTH_PRICE_PAISE = 49900 // ₹499

/** Group II/ IIA- Rank Booster — standalone plan (90-day; pay again to renew).
 *  Mirrors Vettri, single tier only. ₹1,800 MRP, ₹1,249 Independence Day
 *  offer price (valid till 31 Aug 2026 per the marketing flyer — the price
 *  itself is not auto-reverting; update this constant by hand when the offer
 *  window ends). This is the amount actually charged. */
export const RANK_BOOSTER_MRP_PAISE = 180000 // ₹1,800
export const RANK_BOOSTER_PRICE_PAISE = 124900 // ₹1,249

/** Group 1 Mock Test Pack — standalone plan (80-day; pay again to renew).
 *  Mirrors Rank Booster's shape: single tier, no MRP/discount. ₹399 flat. */
export const MOCK_PACK_PRICE_PAISE = 39900 // ₹399

/** Razorpay needs a positive order; never charge below ₹1. */
export const MIN_CHARGE_PAISE = 100

/**
 * Premium entitlement window. Premium is a 6-MONTH plan, so a paid order older
 * than this has lapsed. Single source of truth shared by the entitlement check
 * (payments.ts) and the premium-audience resolution (notifications.ts) so the
 * two can never drift.
 */
export const PREMIUM_VALIDITY_MS = 180 * 24 * 60 * 60 * 1000 // 6 months

/**
 * Vettri Nichayam FULL entitlement window — the ₹899 plan is a TWO-MONTH program.
 * This diverges from PREMIUM_VALIDITY_MS (180d), which is fine: bundleAccess queries
 * on max(the two) and then bounds each plan against its OWN window, so a shorter
 * Vettri validity lapses correctly.
 */
export const VETTRI_VALIDITY_MS = 60 * 24 * 60 * 60 * 1000 // 2 months

/** Vettri MONTHLY entitlement window — one paid ₹499 grants 30 days (ONE month, the
 *  first half of the two-month program); paying again grants another 30 days from
 *  that payment, unlocking the second half. */
export const VETTRI_MONTH_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/** Rank Booster entitlement window — one paid order grants 90 days; paying
 *  again grants another 90 days from that payment. */
export const RANK_BOOSTER_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

/** Mock Pack entitlement window — one paid order grants 80 days; paying again
 *  grants another 80 days from that payment. */
export const MOCK_PACK_VALIDITY_MS = 80 * 24 * 60 * 60 * 1000 // 80 days

/**
 * Free users may download this many explanation PDFs in total (mirrors the
 * 3-test free allowance). Downloading is open to everyone once a test is ≥80%
 * attempted; premium users are unlimited and never touch the counter.
 */
export const FREE_PDF_DOWNLOADS = 3

/**
 * Each user may attempt a given full mock exam at most this many times. Enforced
 * server-side at exam start (POST /mock-exam) by counting completed submissions
 * in mock_exam_attempts; the picker UI mirrors it for display only.
 */
export const MAX_MOCK_EXAM_ATTEMPTS = 2

/**
 * Each user may attempt a given scheduled Test Series paper at most this many
 * times. Enforced server-side at start (POST /test-series) by counting recorded
 * submissions in test_series_attempts; the picker UI mirrors it for display.
 */
export const MAX_TEST_SERIES_ATTEMPTS = 2

/**
 * Trusted base amount for an order. For a known plan we use the server price and
 * ignore the client amount entirely; for the generic contribution path we accept
 * the client amount, clamped to a sane range.
 */
export function baseAmountForPlan(plan: string | undefined, clientAmount: number): number {
  if (plan === 'premium_annual') return PREMIUM_PRICE_PAISE
  if (plan === 'vettri_nichayam') return VETTRI_PRICE_PAISE
  if (plan === 'vettri_month') return VETTRI_MONTH_PRICE_PAISE
  if (plan === 'rank_booster_g2') return RANK_BOOSTER_PRICE_PAISE
  if (plan === 'group1_mock_pack') return MOCK_PACK_PRICE_PAISE
  const n = Math.trunc(Number(clientAmount))
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, MIN_CHARGE_PAISE), 10_000_000)
}

/** Plan ids the order route will honour (anything else → generic contribution). */
export const KNOWN_PLANS = new Set([
  'premium_annual',
  'vettri_nichayam',
  'vettri_month',
  'rank_booster_g2',
  'group1_mock_pack',
])

/** The paid plans, as a type. Shared with the IAP catalog so a store product
 *  can only ever map onto a plan the ledger already understands. */
export type PlanId =
  | 'premium_annual'
  | 'vettri_nichayam'
  | 'vettri_month'
  | 'rank_booster_g2'
  | 'group1_mock_pack'
