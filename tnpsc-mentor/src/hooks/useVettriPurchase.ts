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
import { VETTRI_PLANS, type VettriPlan } from '../components/UI/VettriCard'

/**
 * Group 1 Test Series (Vettri Nichayam) purchase mechanics: plan choice
 * (full ₹1,899 / installment ₹499 per month), coupon apply/remove, the
 * pre-payment confirm step and the actual Razorpay checkout via
 * startPurchase().
 *
 * The in-app VettriCard has always owned this logic privately, which was fine
 * while it was the only place the bundle could be bought. The public Group 1
 * landing page sells the same bundle without that card's layout, so the
 * mechanics move behind a hook shaped exactly like useRankBoosterPurchase()
 * and useMockPackPurchase() — every paid plan then has one, and a landing page
 * buys through the same path the app does. Pricing and plan tags stay in
 * VettriCard (VETTRI_PLANS), so there is still a single source of truth for
 * what is charged.
 *
 * Each call-site gets its own independent instance (plain useState, not a
 * store); two mounted callers just mean two independent confirm modals.
 */

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

export function useVettriPurchase() {
  const { user, profile } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [paying, setPaying] = useState(false)
  // Pre-payment recap popup: the CTA opens it; checkout runs only on OK.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { unlimited, loaded, refresh, markVettri } = useEntitlementsStore()
  // Unlocking the bundle also makes the buyer unlimited, so keep the credit
  // meter fresh — otherwise the header pill keeps showing a finite balance.
  const reloadCredits = useCreditsStore((s) => s.reload)

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Chosen tier. Switching clears any applied coupon, since its discount was
  // computed against the other tier's base price.
  const [plan, setPlanState] = useState<VettriPlan>('full')
  const sel = VETTRI_PLANS[plan]
  const setPlan = (p: VettriPlan) => {
    if (p === plan) return
    setPlanState(p)
    setApplied(null)
    setCouponError(null)
  }

  // Native charges the STORE price for the selected plan, not the rupee constant.
  const { priceString: storePriceString } = useStorePrice(sel.id)
  const showCoupon = couponMode() === 'input'

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  /** Returns the applied coupon on success, null otherwise (couponError is
   *  already set for the UI in that case). Returning the result — rather than
   *  relying on `applied`, which hasn't flushed yet inside the same tick —
   *  lets startEnroll chain straight into the confirm step with the correct
   *  amount instead of needing a second click. */
  const applyCoupon = async (): Promise<AppliedCoupon | null> => {
    const trimmed = code.trim()
    if (!trimmed || checking) return null
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: sel.id })
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

  const finalPaise = applied ? applied.finalAmount : sel.paise
  const isFree = finalPaise === 0
  const displayPrice = storePriceString ?? `₹${rupees(finalPaise)}`
  const basePrice = storePriceString ?? `₹${sel.rupees}`

  /** Primary CTA: one tap always reaches the confirm modal — a pending,
   *  not-yet-applied coupon is resolved first, then the modal opens with the
   *  correct price either way. Optionally switches tier in the same tap, so a
   *  page can offer "buy full" and "pay monthly" as two separate buttons. */
  const startEnroll = async (which?: VettriPlan) => {
    const chosen = which ?? plan
    // A tier switch drops any applied coupon (setPlan does it), so the price
    // this tap is really opening on is the new tier's base price.
    const switching = !!which && which !== plan
    if (switching) setPlan(which)
    const coupon = switching ? null : code.trim() && !applied ? await applyCoupon() : applied
    trackInitiateCheckout({
      value: (coupon ? coupon.finalAmount : VETTRI_PLANS[chosen].paise) / 100,
      description: VETTRI_PLANS[chosen].descr,
    })
    setConfirmOpen(true)
  }

  const handleBuy = async () => {
    if (paying) return
    setConfirmOpen(false)
    setPaying(true)
    trackCheckoutConfirmed({ value: finalPaise / 100, description: sel.descr })
    try {
      const result = await startPurchase({
        plan: sel.id,
        amount: sel.paise,
        profile,
        description: sel.descr,
        couponCode: applied?.code,
        userId: user?.id ?? null,
      })
      if (result.status === 'paid') {
        hapticSuccess()
        markVettri() // unlock immediately…
        refresh() // …then reconcile with the server (expiry etc.)
        reloadCredits() // …and drop the finite credit meter (now unlimited)
        navigate(`/payment-success?plan=${plan === 'month' ? 'vettri_month' : 'vettri_full'}`)
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
    plan,
    setPlan,
    sel,
    startEnroll,
    handleBuy,
    /** premium || vettri — either already unlocks this series. */
    vettriUnlocked: unlimited,
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
