// ─── Group 1 entry routing ───────────────────────────────────────────────────
// Which of the two Group 1 products a tap opens, and which it sells.
//
// There are two purchases behind one page: the ₹1,899 scheduled Test Series
// (13 dated papers) and the ₹399 Mock Test Pack (6 full-length papers). Getting
// the split wrong is expensive in both directions — pitch a plan to someone who
// already owns it and the button dead-ends in a payment sheet; open content for
// someone who has not bought it and the paywall is decorative. Both rules live
// here, as pure functions, so they can be pinned by tests instead of only ever
// being exercised by clicking through the live app with a real plan.

/** What tapping a Group 1 entry button does. */
export type G1Tap = 'open' | 'buy'

export interface G1Entitlement {
  /** premium || vettri — the ₹1,899 (or Premium) window. */
  unlimited: boolean
  /** An active ₹399 Group 1 Mock Test Pack. */
  mockPack: boolean
}

export interface G1Sales {
  vettri: boolean
  premium: boolean
  mockPack: boolean
}

/**
 * The scheduled Group 1 Test Series (this page's `vettri` tab).
 *
 * Opens for anyone whose plan already includes it. Also opens — rather than
 * dead-ending — when nothing that grants it is on sale: the panel behind it
 * carries its own paywall and is the honest thing to show, where a purchase
 * flow with no purchasable plan is not.
 */
export function seriesTap(e: G1Entitlement, sales: G1Sales): G1Tap {
  if (e.unlimited) return 'open'
  return sales.vettri || sales.premium ? 'buy' : 'open'
}

/**
 * The Group 1 mock papers (/mock).
 *
 * Ownership mirrors the server's `mockUnlocked` (premium || mockPack ||
 * vettri): a Vettri or Premium buyer already has these papers, so they must not
 * be pitched the pack on top of a plan that includes it.
 */
export function mockTap(e: G1Entitlement, sales: G1Sales): G1Tap {
  if (mockOwned(e)) return 'open'
  return sales.mockPack ? 'buy' : 'open'
}

/** Whether this account can already open the mock papers. */
export function mockOwned(e: G1Entitlement): boolean {
  return e.mockPack || e.unlimited
}

/**
 * Whether to show the mock entry at all: a shortcut for an owner, a pitch for
 * anyone who could buy it. Hidden only when a non-owner cannot buy it either,
 * where the button would have nothing to offer and nowhere useful to go.
 */
export function mockEntryVisible(e: G1Entitlement, sales: G1Sales): boolean {
  return mockOwned(e) || sales.mockPack
}

/** Whether to print a price on a button — only while that plan is still sellable
 *  to this account. An owner's button shows a chevron instead. */
export function showsPrice(tap: G1Tap): boolean {
  return tap === 'buy'
}
