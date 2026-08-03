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

/** Razorpay needs a positive order; never charge below ₹1. */
export const MIN_CHARGE_PAISE = 100

/**
 * Premium entitlement window. Premium is a 3-MONTH plan, so a paid order older
 * than this has lapsed. Single source of truth shared by the entitlement check
 * (payments.ts) and the premium-audience resolution (notifications.ts) so the
 * two can never drift.
 */
export const PREMIUM_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000 // 3 months

/**
 * Vettri Nichayam FULL entitlement window — the ₹899 plan is a TWO-MONTH program.
 * This diverges from PREMIUM_VALIDITY_MS (90d), which is fine: bundleAccess queries
 * on max(the two) and then bounds each plan against its OWN window, so a shorter
 * Vettri validity lapses correctly.
 */
export const VETTRI_VALIDITY_MS = 60 * 24 * 60 * 60 * 1000 // 2 months

/** Vettri MONTHLY entitlement window — one paid ₹499 grants 30 days (ONE month, the
 *  first half of the two-month program); paying again grants another 30 days from
 *  that payment, unlocking the second half. */
export const VETTRI_MONTH_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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
  const n = Math.trunc(Number(clientAmount))
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, MIN_CHARGE_PAISE), 10_000_000)
}

/** Plan ids the order route will honour (anything else → generic contribution). */
export const KNOWN_PLANS = new Set(['premium_annual', 'vettri_nichayam', 'vettri_month'])

/** The three paid plans, as a type. Shared with the IAP catalog so a store
 *  product can only ever map onto a plan the ledger already understands. */
export type PlanId = 'premium_annual' | 'vettri_nichayam' | 'vettri_month'
