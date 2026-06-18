// ─── Server-side pricing (single source of truth) ───────────────────────────
// Real prices live on the server so a hostile client can't send a cheaper
// amount. The frontend mirrors PREMIUM_PRICE_PAISE for display only — the order
// route recomputes the base here before applying any coupon.

/** Premium annual plan price in paise (₹1 = 100). Mirrors PremiumCard.tsx. */
export const PREMIUM_PRICE_PAISE = 139900 // ₹1,299

/** Razorpay needs a positive order; never charge below ₹1. */
export const MIN_CHARGE_PAISE = 100

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
