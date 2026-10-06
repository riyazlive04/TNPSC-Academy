import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { startPurchase, couponMode, PURCHASE_ERR_KEY } from '../lib/purchase'
import { useStorePrice } from './useStorePrice'
import { toast } from '../store/toastStore'
import { useEntitlementsStore } from '../store/entitlementsStore'
import { api, type CouponValidation } from '../lib/api'
import { useT } from '../lib/i18n'
import { trackInitiateCheckout, trackCheckoutConfirmed } from '../lib/tracking'
import { hapticSuccess } from '../lib/haptics'

// ─── Target Group 2 2026 pricing (mirrors server pricing.ts) ────────────────
// Display only — the server always recomputes the price from the plan + coupon.
//
// One product, two plans. A buyer never picks a track inside the app: they are
// handed the English link or the Tamil link, and the plan behind that link IS
// the track they own. Keeping them as two plans (rather than one plan plus a
// stored preference) means the payment ledger alone answers "which papers may
// this person sit", with no second source of truth to keep in step.
export const TARGET_G2_PRICE_RUPEES = 849
export const TARGET_G2_PRICE_PAISE = TARGET_G2_PRICE_RUPEES * 100

export type TargetG2Track = 'english' | 'tamil'

export const TARGET_G2_PLAN_ID: Record<TargetG2Track, 'target_g2_en' | 'target_g2_ta'> = {
  english: 'target_g2_en',
  tamil: 'target_g2_ta',
}

/** Which /test-series series key a track's 13 papers live under. */
export const TARGET_G2_SERIES: Record<TargetG2Track, 'g2_target_en' | 'g2_target_ta'> = {
  english: 'g2_target_en',
  tamil: 'g2_target_ta',
}

export const TARGET_G2_PERK_KEYS = [
  'targetG2Perk1',
  'targetG2Perk2',
  'targetG2Perk3',
  'targetG2Perk4',
] as const

const DESCR: Record<TargetG2Track, string> = {
  english: 'Target Group 2 2026 - General English - 90 days',
  tamil: 'Target Group 2 2026 - General Tamil - 90 days',
}

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Target Group 2 2026 purchase mechanics for ONE language track: coupon
 * apply/remove, the pre-payment confirm step, and the Razorpay checkout via
 * startPurchase(). Shared by the two pay-link pages and the locked hub tab, so
 * "tap Enroll" behaves identically wherever it is tapped. A near-copy of
 * useRankBoosterPurchase, parameterized by track.
 *
 * Note it reports `unlocked` for THIS track only. A buyer who owns English and
 * lands on the Tamil link is treated as a new buyer there, which is correct —
 * the Tamil papers are a second ₹849 purchase.
 */
export function useTargetG2Purchase(track: TargetG2Track) {
  const { user, profile } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const plan = TARGET_G2_PLAN_ID[track]
  const [paying, setPaying] = useState(false)
  // Pre-payment recap popup: the CTA opens it; checkout runs only on OK.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { targetG2English, targetG2Tamil, loaded, refresh, markTargetG2 } = useEntitlementsStore()
  const unlocked = track === 'english' ? targetG2English : targetG2Tamil

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  const { priceString: storePriceString } = useStorePrice(plan)
  const showCoupon = couponMode() === 'input'

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  /** Returns the applied coupon on success, null otherwise (invalid/expired/
   *  error — couponError is already set for the UI in that case). Returning the
   *  result rather than relying on the `applied` state, which won't have
   *  flushed inside the same tick, lets startEnroll chain straight into
   *  checkout with the correct amount instead of needing a second click. */
  const applyCoupon = async (): Promise<AppliedCoupon | null> => {
    const trimmed = code.trim()
    if (!trimmed || checking) return null
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan })
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

  const finalPaise = applied ? applied.finalAmount : TARGET_G2_PRICE_PAISE
  const isFree = finalPaise === 0
  const displayPrice = storePriceString ?? `₹${rupees(finalPaise)}`
  const basePrice = storePriceString ?? `₹${TARGET_G2_PRICE_RUPEES}`

  /** Primary CTA: one tap always reaches the confirm modal — a pending,
   *  not-yet-applied coupon is resolved first (and its result used directly,
   *  since `applied` state hasn't flushed yet in this same tick), then the
   *  modal opens with the correct price either way. */
  const startEnroll = async () => {
    const coupon = code.trim() && !applied ? await applyCoupon() : applied
    trackInitiateCheckout({
      value: (coupon ? coupon.finalAmount : TARGET_G2_PRICE_PAISE) / 100,
      description: DESCR[track],
    })
    setConfirmOpen(true)
  }

  const handleBuy = async () => {
    if (paying) return
    setConfirmOpen(false)
    setPaying(true)
    trackCheckoutConfirmed({ value: finalPaise / 100, description: DESCR[track] })
    try {
      const result = await startPurchase({
        plan,
        amount: TARGET_G2_PRICE_PAISE,
        profile,
        description: DESCR[track],
        couponCode: applied?.code,
        userId: user?.id ?? null,
      })
      if (result.status === 'paid') {
        hapticSuccess()
        markTargetG2(track) // unlock this track immediately…
        refresh() // …then reconcile with the server (expiry etc.)
        navigate(`/payment-success?plan=${plan}`)
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
    track,
    plan,
    paying,
    confirmOpen,
    setConfirmOpen,
    startEnroll,
    handleBuy,
    /** This track only — the other track is a separate purchase. */
    unlocked,
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
