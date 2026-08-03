// ─── Purchase router ────────────────────────────────────────────────────────
// One entry point for buying a plan, two rails underneath:
//
//   web    → Razorpay Checkout (lib/razorpay.ts)
//   native → the platform store (lib/iap.ts)
//
// This split is not a preference, it is the store rules. Apple guideline 3.1.1
// requires in-app purchase for anything that unlocks content in the app, and
// Play's Payments policy says the same for Play-distributed apps. Sending an
// iOS user to Razorpay is an automatic rejection, so the Razorpay path must stay
// unreachable from a native build.
//
// Both rails return the SAME result shape, so the paywall components don't branch.

import { Capacitor } from '@capacitor/core'
import { startCheckout, type CheckoutResult, type CheckoutErrorCode } from './razorpay'
import { purchasePlan, type IapErrorCode } from './iap'
import type { PlanId } from './iapCatalog'
import type { Profile } from '../types'

export type PurchaseErrorCode = CheckoutErrorCode | IapErrorCode

/**
 * Failure code → i18n key, shared by every paywall surface so the two rails
 * report failures in the same words. 'cancelled' never reaches here — a user
 * backing out resolves as `dismissed` and stays silent.
 */
export const PURCHASE_ERR_KEY: Record<
  Exclude<PurchaseErrorCode, 'cancelled'>,
  | 'payErrStart'
  | 'payErrSdk'
  | 'payErrVerify'
  | 'payErrPay'
  | 'payErrUnavailable'
  | 'payErrUnsupported'
> = {
  start: 'payErrStart',
  sdk: 'payErrSdk',
  verify: 'payErrVerify',
  pay: 'payErrPay',
  unavailable: 'payErrUnavailable',
  unsupported: 'payErrUnsupported',
}

export type PurchaseResult =
  | { status: 'paid' }
  | { status: 'dismissed' }
  | { status: 'failed'; error: string; code?: PurchaseErrorCode }

export interface PurchaseParams {
  plan: PlanId
  /** Rupee price in paise. Web only — native charges the STORE price. */
  amount: number
  profile?: Profile | null
  description?: string
  /** Promoter coupon. Web only; see COUPONS_ON_NATIVE below. */
  couponCode?: string
  /** Signed-in user id, stamped into the store transaction as appAccountToken. */
  userId?: string | null
}

const isNative = Capacitor.isNativePlatform()

/**
 * How "I have a coupon" is offered on this platform. Coupons exist everywhere —
 * what differs is WHO issues the code, and that difference is a store rule, not
 * a preference:
 *
 *   'input'      web. Our own `coupons` table: promoter codes with flat/percent
 *                discounts, validated server-side and applied to the Razorpay
 *                order. Full attribution stays in our DB.
 *
 *   'offer-code' iOS. Our codes are barred here — Apple 3.1.1 calls a
 *                self-issued code that unlocks paid content an "own mechanism to
 *                unlock content, such as license keys". An APPLE-issued Offer
 *                Code is just another route through IAP, so it is allowed, and
 *                since March 2026 offer codes cover non-renewing subscriptions
 *                and can be free or discounted. Redeemed via the StoreKit sheet.
 *
 *   'play-sheet' Android. Play promo codes are redeemed from INSIDE the Google
 *                Play payment sheet ("Redeem code"), not through an app-side API
 *                — the plugin's presentOfferCodeRedeemSheet is iOS-only. So
 *                there is nothing for us to open; the UI just has to tell the
 *                buyer where the link is, or they will never find it.
 *
 * A promoter code from our own table therefore does NOT work in the apps. Mirror
 * the ones that matter as store offer codes (docs/MOBILE_RELEASE.md §10), or
 * send promoter traffic to the website, where percentage discounts and
 * per-promoter reporting work properly.
 */
export type CouponMode = 'input' | 'offer-code' | 'play-sheet'

export function couponMode(): CouponMode {
  if (!isNative) return 'input'
  return Capacitor.getPlatform() === 'ios' ? 'offer-code' : 'play-sheet'
}

/**
 * Buy `plan`. Never throws — every outcome comes back as paid/dismissed/failed.
 */
export async function startPurchase(params: PurchaseParams): Promise<PurchaseResult> {
  if (isNative) {
    return purchasePlan(params.plan, params.userId ?? null)
  }

  const res: CheckoutResult = await startCheckout({
    amount: params.amount,
    profile: params.profile,
    description: params.description,
    notes: { plan: params.plan },
    couponCode: params.couponCode,
  })
  return res
}
