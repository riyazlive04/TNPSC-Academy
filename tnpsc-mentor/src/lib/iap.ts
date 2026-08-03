// ─── Native in-app purchases (StoreKit 2 / Google Play Billing) ─────────────
// The native half of the paid plans. On iOS and Android the stores REQUIRE their
// own billing for digital content — Apple guideline 3.1.1 and Play's Payments
// policy — so Razorpay is unreachable inside the app (see lib/purchase.ts).
//
// The trust model is the same as the Razorpay flow: the client never decides that
// something was paid for. It hands the store's signed proof to our server, the
// server verifies it directly with Apple/Google, and only then writes the `paid`
// row that every entitlement gate reads.
//
// ORDER OF OPERATIONS matters and is deliberate:
//   1. purchase (autoAcknowledgePurchases: false)
//   2. server verifies + records
//   3. only then finish/consume the transaction
// If step 2 fails we leave the purchase UNfinished. StoreKit re-delivers it on
// next launch, and Play auto-refunds anything unacknowledged after 3 days — so a
// user can never end up charged with no access and no recourse.

import { Capacitor } from '@capacitor/core'
import { api } from './api'
import { catalogForPlan, catalogForProduct, ALL_PRODUCT_IDS, type PlanId } from './iapCatalog'

export type IapErrorCode = 'unsupported' | 'unavailable' | 'cancelled' | 'verify' | 'pay'

export type IapResult =
  | { status: 'paid' }
  | { status: 'dismissed' }
  | { status: 'failed'; error: string; code?: IapErrorCode }

/** Store-localized price for a plan, e.g. "₹1,699.00". */
export interface StorePrice {
  productId: string
  priceString: string
  currencyCode: string
}

const isNative = Capacitor.isNativePlatform()

function platform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
}

/** Lazy import keeps the billing plugin out of the web bundle entirely. */
async function plugin() {
  const mod = await import('@capgo/native-purchases')
  return mod
}

// ─── Prices ─────────────────────────────────────────────────────────────────

let priceCache: Map<string, StorePrice> | null = null

/**
 * Fetch the store's own localized prices. Apple requires the price shown in the
 * app to be the App Store price, which will not always equal the rupee figure the
 * website charges (store price tiers, local tax, currency of the user's
 * storefront). Returns an empty map on any failure — callers fall back to the web
 * price rather than blocking the paywall.
 */
export async function storePrices(): Promise<Map<string, StorePrice>> {
  if (!isNative) return new Map()
  if (priceCache) return priceCache
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin()
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [...ALL_PRODUCT_IDS],
      productType: PURCHASE_TYPE.INAPP,
    })
    const map = new Map<string, StorePrice>()
    for (const p of products ?? []) {
      map.set(p.identifier, {
        productId: p.identifier,
        priceString: p.priceString,
        currencyCode: p.currencyCode,
      })
    }
    priceCache = map
    return map
  } catch {
    return new Map()
  }
}

/** True when the device can actually transact (Play services present, etc.). */
export async function billingAvailable(): Promise<boolean> {
  if (!isNative) return false
  try {
    const { NativePurchases } = await plugin()
    const { isBillingSupported } = await NativePurchases.isBillingSupported()
    return !!isBillingSupported
  } catch {
    return false
  }
}

// ─── Purchase ───────────────────────────────────────────────────────────────

// StoreKit 2 requires appAccountToken to be a UUID and throws on anything else,
// which would make the plan unbuyable rather than merely unbound. Supabase user
// ids ARE uuids, so this only ever trips on a malformed session — in which case
// omitting the token is the safe failure: the purchase still completes, and the
// server simply has no account claim to cross-check (see routes/iap.ts).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cancellation surfaces as a thrown error with no stable code; match on text. */
function isCancellation(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return (
    msg.includes('cancel') ||
    msg.includes('userc') || // StoreKit `userCancelled`
    msg.includes('aborted') ||
    msg.includes('code=2') // Play BillingResponse USER_CANCELED
  )
}

/**
 * Run the full native purchase for `plan` and resolve with the outcome. Never
 * throws: every path resolves to paid/dismissed/failed so callers can toast.
 *
 * `userId` is passed to the store as `appAccountToken`, which puts our account id
 * inside Apple's signed transaction. The server checks it, so a receipt lifted
 * from one account cannot be replayed to credit another.
 */
export async function purchasePlan(plan: PlanId, userId: string | null): Promise<IapResult> {
  if (!isNative) return { status: 'failed', error: 'Not a native build.', code: 'unsupported' }

  const entry = catalogForPlan(plan)
  if (!entry) return { status: 'failed', error: 'Unknown plan.', code: 'unsupported' }

  const { NativePurchases, PURCHASE_TYPE } = await plugin()

  if (!(await billingAvailable())) {
    return {
      status: 'failed',
      error: 'In-app purchases are unavailable on this device.',
      code: 'unavailable',
    }
  }

  let tx
  try {
    tx = await NativePurchases.purchaseProduct({
      productIdentifier: entry.productId,
      productType: PURCHASE_TYPE.INAPP,
      quantity: 1,
      isConsumable: true,
      // Hold the transaction open until our server has recorded it (see header).
      autoAcknowledgePurchases: false,
      // Stamps our account id into the store's own signed record, so a receipt
      // lifted from another account can't be replayed onto this one. Android
      // maps it to setObfuscatedAccountId(); iOS to Transaction.appAccountToken.
      ...(userId && UUID_RE.test(userId) ? { appAccountToken: userId } : {}),
    })
  } catch (e) {
    if (isCancellation(e)) return { status: 'dismissed' }
    const msg = e instanceof Error ? e.message : ''
    return msg
      ? { status: 'failed', error: msg }
      : { status: 'failed', error: 'Payment failed.', code: 'pay' }
  }

  // ── Server-side verification. This is the only thing that grants access. ──
  try {
    const { verified } = await api.payments.verifyIap({
      platform: platform(),
      plan,
      productId: tx.productIdentifier || entry.productId,
      transactionId: tx.transactionId,
      // iOS: the StoreKit 2 signed transaction. Android: the Play purchase token.
      jws: tx.jwsRepresentation,
      purchaseToken: tx.purchaseToken,
    })
    if (!verified) {
      return { status: 'failed', error: 'We could not verify that purchase.', code: 'verify' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      status: 'failed',
      error: msg || 'We could not verify that purchase.',
      code: 'verify',
    }
  }

  // Recorded server-side — safe to release the transaction. Failure here is not
  // the user's problem: they already have access, and anything left unreleased
  // is picked up by finishPendingPurchases() on the next launch.
  await finish(tx).catch(() => {})

  return { status: 'paid' }
}

/**
 * Release a transaction the server has now recorded. The call differs per
 * platform and the plugin does NOT paper over it:
 *
 *   Android → consumePurchase(). Consuming implies acknowledgement (satisfying
 *             Play's 3-day acknowledge-or-auto-refund rule) and is what makes a
 *             one-time product buyable again when the access window lapses.
 *   iOS     → acknowledgePurchase(), which is the plugin's name for
 *             `Transaction.finish()`. consumePurchase() hard-rejects with
 *             "only available on Android", so calling it here would leave the
 *             StoreKit transaction unfinished forever — re-delivered on every
 *             launch, and flagged by App Review.
 *
 * iOS addresses the transaction by its numeric transaction id; Android by the
 * purchase token.
 */
async function finish(tx: { purchaseToken?: string; transactionId?: string }): Promise<void> {
  const { NativePurchases } = await plugin()

  if (platform() === 'ios') {
    if (!tx.transactionId) return
    await NativePurchases.acknowledgePurchase({ purchaseToken: tx.transactionId })
    return
  }

  if (!tx.purchaseToken) return
  await NativePurchases.consumePurchase({ purchaseToken: tx.purchaseToken })
}

// ─── Recovery ───────────────────────────────────────────────────────────────

export interface RecoveryResult {
  /** Receipts the server had NOT seen before — i.e. access genuinely changed. */
  recorded: number
  /** Valid receipts for our products found on this store account, new or not. */
  seen: number
}

/**
 * Re-submit any purchase the store still holds for this device. Covers the app
 * being killed between "charged" and "recorded", and doubles as the Restore
 * Purchases action Apple expects a store-billing app to offer.
 *
 * The two counters answer different questions, and conflating them makes one of
 * the callers wrong:
 *   • `recorded` — did anything change? The boot sweep refreshes entitlements
 *     only on this, so a launch that merely re-sees old receipts stays quiet.
 *   • `seen` — does this store account own any of our products at all? Restore
 *     Purchases reports on this, so a user whose plan was already recorded is
 *     told "restored" rather than the alarming "nothing to restore".
 *
 * Takes no user id on purpose. Which account a receipt belongs to is decided by
 * the server from the appAccountToken inside the receipt — and that matters more
 * here than at purchase time, because the store returns whatever the DEVICE's
 * Apple/Google account owns, which is not necessarily the person signed in.
 */
export async function finishPendingPurchases(): Promise<RecoveryResult> {
  if (!isNative) return { recorded: 0, seen: 0 }
  let recorded = 0
  let seen = 0
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin()
    await NativePurchases.restorePurchases().catch(() => {})
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
    })

    for (const tx of purchases ?? []) {
      // A product id we no longer sell (an old SKU still sitting in the store
      // account) simply isn't ours to record.
      const entry = tx.productIdentifier ? catalogForProduct(tx.productIdentifier) : undefined
      if (!entry) continue
      try {
        const { verified, alreadyRecorded } = await api.payments.verifyIap({
          platform: platform(),
          plan: entry.plan,
          productId: tx.productIdentifier,
          transactionId: tx.transactionId,
          jws: tx.jwsRepresentation,
          purchaseToken: tx.purchaseToken,
        })
        if (!verified) continue
        seen++
        if (!alreadyRecorded) recorded++
        // Release it only once the server has accepted it. A rejected receipt is
        // left unfinished on purpose, so it comes back next launch rather than
        // being silently discarded along with the user's money.
        await finish(tx).catch(() => {})
      } catch {
        /* offline or server down — try again next launch */
      }
    }
  } catch {
    /* nothing to recover */
  }
  return { recorded, seen }
}

// ─── Offer codes ────────────────────────────────────────────────────────────

export type RedeemResult = 'redeemed' | 'nothing' | 'dismissed' | 'unsupported' | 'error'

/**
 * Open the App Store's own offer-code redemption sheet.
 *
 * This is the store-sanctioned answer to "I have a coupon". Our own coupon field
 * is barred inside the app — Apple 3.1.1 calls a self-issued code that unlocks
 * paid content an "own mechanism to unlock content, such as license keys" — but
 * an APPLE-issued offer code is simply another way to buy through IAP, so it is
 * fine. Since March 2026 offer codes cover every purchase type, including the
 * non-renewing subscriptions this app sells, and can be free OR discounted.
 *
 * The sheet returns nothing useful: it completes the purchase out-of-band and
 * hands us no transaction. So after it closes we re-run the recovery sweep,
 * which is what actually finds the granted purchase, verifies it server-side and
 * writes the entitlement. That is also why this returns 'nothing' rather than
 * 'redeemed' when the sweep comes up empty — the user may simply have closed the
 * sheet without entering anything.
 *
 * iOS 16+ only. Android has no equivalent API: Play promo codes are redeemed
 * from inside the Play payment sheet during checkout (see couponMode()).
 */
export async function redeemOfferCode(): Promise<RedeemResult> {
  if (!isNative || platform() !== 'ios') return 'unsupported'
  try {
    const { NativePurchases } = await plugin()
    await NativePurchases.presentOfferCodeRedeemSheet()
  } catch (e) {
    // iOS 15 and below reject outright; a dismissed sheet also lands here.
    const msg = (e instanceof Error ? e.message : '').toLowerCase()
    if (msg.includes('requires ios 16')) return 'unsupported'
    return 'dismissed'
  }

  const { seen } = await finishPendingPurchases()
  return seen > 0 ? 'redeemed' : 'nothing'
}

/** Open the OS subscription-management screen (iOS) — required by Apple when a
 *  paid plan is on offer, harmless elsewhere. */
export async function openStoreManagement(): Promise<void> {
  if (!isNative) return
  try {
    const { NativePurchases } = await plugin()
    await NativePurchases.manageSubscriptions()
  } catch {
    /* not available on this platform/version */
  }
}
