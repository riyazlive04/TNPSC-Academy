import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { startPurchase, couponMode, PURCHASE_ERR_KEY } from '../lib/purchase'
import { useStorePrice } from './useStorePrice'
import { toast } from '../store/toastStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { useCreditsStore } from '../store/creditsStore'
import { api, type CouponValidation } from '../lib/api'
import { useT } from '../lib/i18n'
import { trackInitiateCheckout, trackCheckoutConfirmed } from '../lib/tracking'
import { hapticSuccess } from '../lib/haptics'

// ─── Group II/ IIA- Rank Booster pricing (mirrors server pricing.ts) ─────────
// Display only — the server always recomputes the price from the plan + coupon.
// Single tier: ₹1,800 MRP, ₹1,249 Independence Day offer price (valid till 31
// Aug 2026 per the marketing flyer), 90 days, pay again to renew. Single source
// of truth for both the in-app RankBoosterCard and the public /rank-booster
// landing page, so the two surfaces can never drift apart on price or copy.
export const RANK_BOOSTER_MRP_RUPEES = 1800
export const RANK_BOOSTER_PRICE_RUPEES = 1249
export const RANK_BOOSTER_PRICE_PAISE = RANK_BOOSTER_PRICE_RUPEES * 100
export const RANK_BOOSTER_SAVINGS = RANK_BOOSTER_MRP_RUPEES - RANK_BOOSTER_PRICE_RUPEES
export const RANK_BOOSTER_PLAN_ID = 'rank_booster_g2' as const
const DESCR = 'Group II/ IIA- Rank Booster - 90 days'

export const RANK_BOOSTER_PERK_KEYS = ['rankBoosterPerk1'] as const
export const RANK_BOOSTER_BONUS_KEYS = [
  'rankBoosterBonus1',
  'rankBoosterBonus2',
  'rankBoosterBonus3',
  'rankBoosterBonus4',
  'rankBoosterBonus5',
] as const

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
export function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Rank Booster purchase mechanics: coupon apply/remove, the pre-payment
 * confirm step, and the actual Razorpay checkout via startPurchase(). Shared
 * by the in-app RankBoosterCard widget and the public /rank-booster landing
 * page so "tap Enroll" behaves identically — and opens Razorpay through the
 * exact same path — no matter which surface triggered it. Each caller gets
 * its own independent instance (plain useState, not a store), which is fine:
 * two mounted call-sites just mean two independent confirm-modal instances,
 * never shared state to keep in sync.
 */
export function useRankBoosterPurchase() {
  const { user, profile } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [paying, setPaying] = useState(false)
  // Pre-payment recap popup: the CTA opens it; checkout runs only on OK.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { rankBoosterUnlocked, loaded, refresh, markRankBooster } = useEntitlementsStore()
  // Unlocking a bundle can also flip credit rules elsewhere, so keep the meter
  // fresh, matching the other paid-plan cards.
  const reloadCredits = useCreditsStore((s) => s.reload)

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  const { priceString: storePriceString } = useStorePrice(RANK_BOOSTER_PLAN_ID)
  const showCoupon = couponMode() === 'input'

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  /** Returns the applied coupon on success, null otherwise (invalid/expired/error
   *  — couponError is already set for the UI in that case). Returning the result
   *  (rather than relying on the `applied` state, which won't have flushed yet
   *  inside the same tick) lets startEnroll chain straight into checkout with the
   *  correct amount instead of needing a second click. */
  const applyCoupon = async (): Promise<AppliedCoupon | null> => {
    const trimmed = code.trim()
    if (!trimmed || checking) return null
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: RANK_BOOSTER_PLAN_ID })
      if (result.valid) {
        setApplied(result)
        setCouponError(null)
        return result
      }
      setApplied(null)
      setCouponError(result.reason === 'Invalid coupon code.' ? t('couponInvalid') : result.reason)
      return null
    } catch (e) {
      setApplied(null)
      setCouponError(e instanceof Error ? e.message : t('couponCheckError'))
      return null
    } finally {
      setChecking(false)
    }
  }

  const removeCoupon = () => {
    setApplied(null)
    setCode('')
    setCouponError(null)
  }

  const finalPaise = applied ? applied.finalAmount : RANK_BOOSTER_PRICE_PAISE
  const isFree = finalPaise === 0
  const displayPrice = storePriceString ?? `₹${rupees(finalPaise)}`
  const basePrice = storePriceString ?? `₹${RANK_BOOSTER_PRICE_RUPEES}`

  /** Primary CTA: one tap always reaches the confirm modal — a pending,
   *  not-yet-applied coupon is resolved first (and its result used directly,
   *  since `applied` state hasn't flushed yet in this same tick), then the
   *  modal opens with the correct price either way. No second tap needed if
   *  the coupon was invalid; it just proceeds at the base price with the
   *  error already visible on the card. */
  const startEnroll = async () => {
    const coupon = code.trim() && !applied ? await applyCoupon() : applied
    trackInitiateCheckout({
      value: (coupon ? coupon.finalAmount : RANK_BOOSTER_PRICE_PAISE) / 100,
      description: DESCR,
    })
    setConfirmOpen(true)
  }

  const handleBuy = async () => {
    if (paying) return
    setConfirmOpen(false)
    setPaying(true)
    trackCheckoutConfirmed({ value: finalPaise / 100, description: DESCR })
    try {
      const result = await startPurchase({
        plan: RANK_BOOSTER_PLAN_ID,
        amount: RANK_BOOSTER_PRICE_PAISE,
        profile,
        description: DESCR,
        couponCode: applied?.code,
        userId: user?.id ?? null,
      })
      if (result.status === 'paid') {
        hapticSuccess()
        markRankBooster() // hide the card immediately…
        refresh() // …then reconcile with the server (expiry etc.)
        reloadCredits()
        navigate('/payment-success?plan=rank_booster_g2')
      } else if (result.status === 'failed')
        toast.error(
          result.code && result.code !== 'cancelled'
            ? t(PURCHASE_ERR_KEY[result.code])
            : result.error
        )
    } finally {
      setPaying(false)
    }
  }

  return {
    paying,
    confirmOpen,
    setConfirmOpen,
    startEnroll,
    handleBuy,
    rankBoosterUnlocked,
    loaded,
    code,
    setCode,
    checking,
    applied,
    couponError,
    applyCoupon,
    removeCoupon,
    showCoupon,
    finalPaise,
    isFree,
    displayPrice,
    basePrice,
  }
}
