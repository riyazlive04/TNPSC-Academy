// ─── Server-side pricing (single source of truth) ───────────────────────────
// Real prices live on the server so a hostile client can't send a cheaper
// amount. The frontend mirrors PREMIUM_PRICE_PAISE for display only — the order
// route recomputes the base here before applying any coupon.

/** Premium plan price in paise (₹1 = 100). Mirrors PremiumCard.tsx (₹1,699). */
export const PREMIUM_PRICE_PAISE = 169900 // ₹1,699

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
  const n = Math.trunc(Number(clientAmount))
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, MIN_CHARGE_PAISE), 10_000_000)
}
