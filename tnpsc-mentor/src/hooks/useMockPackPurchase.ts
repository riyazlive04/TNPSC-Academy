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

// ─── Group 1 Mock Test Pack pricing (mirrors server pricing.ts) ─────────────
// Display only — the server always recomputes the price from the plan + coupon.
// Single tier: ₹399 flat, no MRP/discount, 80 days, pay again to renew.
export const MOCK_PACK_PRICE_RUPEES = 399
export const MOCK_PACK_PRICE_PAISE = MOCK_PACK_PRICE_RUPEES * 100
export const MOCK_PACK_PLAN_ID = 'group1_mock_pack' as const
const DESCR = 'Group 1 Mock Test Pack - 80 days'

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Group 1 Mock Test Pack purchase mechanics — coupon apply/remove, the
 * pre-payment confirm step, and the actual Razorpay checkout via
 * startPurchase(). Mirrors useRankBoosterPurchase()'s shape so every paid-plan
 * card behaves identically; unlike that hook, display copy (plan name,
 * validity, perks) is supplied by the caller instead of pulled from global
 * i18n keys, since this plan's marketing copy lives locally in
 * PricingCards.tsx rather than in shared i18n.ts entries.
 */
export function useMockPackPurchase() {
  const { user, profile } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [paying, setPaying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { mockPack, loaded, refresh, markMockPack } = useEntitlementsStore()
  const reloadCredits = useCreditsStore((s) => s.reload)

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  const { priceString: storePriceString } = useStorePrice(MOCK_PACK_PLAN_ID)
  const showCoupon = couponMode() === 'input'

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const applyCoupon = async () => {
    const trimmed = code.trim()
    if (!trimmed || checking) return
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: MOCK_PACK_PLAN_ID })
      if (result.valid) {
        setApplied(result)
        setCouponError(null)
      } else {
        setApplied(null)
        setCouponError(result.reason === 'Invalid coupon code.' ? t('couponInvalid') : result.reason)
      }
    } catch (e) {
      setApplied(null)
      setCouponError(e instanceof Error ? e.message : t('couponCheckError'))
    } finally {
      setChecking(false)
    }
  }

  const removeCoupon = () => {
    setApplied(null)
    setCode('')
    setCouponError(null)
  }

  const finalPaise = applied ? applied.finalAmount : MOCK_PACK_PRICE_PAISE
  const isFree = finalPaise === 0
  const displayPrice = storePriceString ?? `₹${rupees(finalPaise)}`
  const basePrice = storePriceString ?? `₹${MOCK_PACK_PRICE_RUPEES}`

  /** Primary CTA: applies a pending coupon first if there is one, otherwise
   *  opens the pre-payment confirm modal directly. */
  const startEnroll = () => {
    if (code.trim() && !applied) {
      void applyCoupon()
      return
    }
    trackInitiateCheckout({ value: finalPaise / 100, description: DESCR })
    setConfirmOpen(true)
  }

  const handleBuy = async () => {
    if (paying) return
    setConfirmOpen(false)
    setPaying(true)
    trackCheckoutConfirmed({ value: finalPaise / 100, description: DESCR })
    try {
      const result = await startPurchase({
        plan: MOCK_PACK_PLAN_ID,
        amount: MOCK_PACK_PRICE_PAISE,
        profile,
        description: DESCR,
        couponCode: applied?.code,
        userId: user?.id ?? null,
      })
      if (result.status === 'paid') {
        hapticSuccess()
        markMockPack() // hide the card / unlock immediately…
        refresh() // …then reconcile with the server (expiry etc.)
        reloadCredits() // the daily grant jumps to 50 once this plan is active
        navigate('/payment-success?plan=group1_mock_pack')
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
    mockPackUnlocked: mockPack,
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
