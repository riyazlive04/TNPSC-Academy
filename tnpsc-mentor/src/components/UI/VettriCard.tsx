import { useEffect, useState } from 'react'
import { Trophy, Check, Loader2, Tag, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { startCheckout } from '../../lib/razorpay'
import { toast } from '../../store/toastStore'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { api, type CouponValidation } from '../../lib/api'
import { useT } from '../../lib/i18n'

// ─── Vettri Nichayam pricing (mirrors server pricing.ts) ─────────────────────
// Display only — the server always recomputes the price from the plan + coupon.
// A TWO-MONTH program: pay FULL ₹899 once for both months, OR MONTHLY ₹499 per
// month (₹499 = the first month/half; pay ₹499 again for the second month/half).
export const VETTRI_PRICE_RUPEES = 899
export const VETTRI_PRICE_PAISE = VETTRI_PRICE_RUPEES * 100
export const VETTRI_MONTH_RUPEES = 499
export const VETTRI_MONTH_PAISE = VETTRI_MONTH_RUPEES * 100

type VettriPlan = 'full' | 'month'
/** Per-plan checkout config. `id` is the server-validated plan tag in notes.plan. */
const PLANS: Record<
  VettriPlan,
  {
    id: string
    paise: number
    rupees: number
    labelKey: 'vettriPlanFull' | 'vettriPlanMonth'
    validityKey: 'vettriValidity' | 'vettriMonthValidity'
    suffixKey: 'vettriFullSuffix' | 'vettriMonthSuffix'
    descr: string
  }
> = {
  full: {
    id: 'vettri_nichayam',
    paise: VETTRI_PRICE_PAISE,
    rupees: VETTRI_PRICE_RUPEES,
    labelKey: 'vettriPlanFull',
    validityKey: 'vettriValidity',
    suffixKey: 'vettriFullSuffix',
    descr: 'Vettri Nichayam - full (two months)',
  },
  month: {
    id: 'vettri_month',
    paise: VETTRI_MONTH_PAISE,
    rupees: VETTRI_MONTH_RUPEES,
    labelKey: 'vettriPlanMonth',
    validityKey: 'vettriMonthValidity',
    suffixKey: 'vettriMonthSuffix',
    descr: 'Vettri Nichayam - month 1 of 2 (pay again for month 2)',
  },
}

const PERK_KEYS = ['vettriPerk1', 'vettriPerk2', 'vettriPerk3'] as const

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Vettri Nichayam upsell card. A two-month program: FULL ₹899 (both months) or
 * MONTHLY ₹499 (one month/half; pay again for the second). Unlocks the 13-exam
 * Vettri bank + unlimited PYQ +
 * unlimited Current Affairs. Hidden for anyone who already has the bundle OR
 * premium (a superset). The chosen plan's tag (notes.plan) is recorded in the
 * ledger; the server always recomputes the price from that plan + any coupon.
 */
export default function VettriCard({
  className = '',
  dismissible = false,
}: {
  className?: string
  /** Show a close button that hides the card for the current view only. */
  dismissible?: boolean
}) {
  const { profile } = useAuth()
  const { t } = useT()
  const [paying, setPaying] = useState(false)
  const { unlimited, loaded, refresh, markVettri } = useEntitlementsStore()

  const [dismissed, setDismissed] = useState(false)
  const dismiss = () => setDismissed(true)

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Chosen plan (full ₹899 / monthly ₹499). Switching plans clears any applied
  // coupon, since its discount was computed against the other plan's base price.
  const [plan, setPlan] = useState<VettriPlan>('full')
  const sel = PLANS[plan]
  const choosePlan = (p: VettriPlan) => {
    if (p === plan) return
    setPlan(p)
    setApplied(null)
    setCouponError(null)
  }

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const applyCoupon = async () => {
    const trimmed = code.trim()
    if (!trimmed || checking) return
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: sel.id })
      if (result.valid) {
        setApplied(result)
        setCouponError(null)
      } else {
        setApplied(null)
        setCouponError(result.reason)
      }
    } catch (e) {
      setApplied(null)
      setCouponError(e instanceof Error ? e.message : 'Could not check that coupon.')
    } finally {
      setChecking(false)
    }
  }

  const removeCoupon = () => {
    setApplied(null)
    setCode('')
    setCouponError(null)
  }

  const handleBuy = async () => {
    if (paying) return
    setPaying(true)
    try {
      const result = await startCheckout({
        amount: sel.paise,
        profile,
        description: sel.descr,
        notes: { plan: sel.id },
        couponCode: applied?.code,
      })
      if (result.status === 'paid') {
        toast.success(t('vettriThanks'))
        markVettri() // hide the card immediately…
        refresh() // …then reconcile with the server (expiry etc.)
      } else if (result.status === 'failed') toast.error(result.error)
    } finally {
      setPaying(false)
    }
  }

  // Already unlocked (bundle or premium) or still checking → render nothing.
  if (!loaded || unlimited || (dismissible && dismissed)) return null

  const finalPaise = applied ? applied.finalAmount : sel.paise
  const isFree = finalPaise === 0

  return (
    <div className={`card relative overflow-hidden p-6 pl-7 ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand" />

      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          title={t('dismiss')}
          className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full text-ink2/60 transition hover:bg-tint hover:text-ink focus-ring active:scale-90"
        >
          <X size={16} />
        </button>
      )}

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: title + perks */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-brand">
            <Trophy size={13} /> {t('vettriBadge')}
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">
            {t('vettriTitle')}
          </h2>
          <p className="tamil mt-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
            {t(sel.validityKey)}
          </p>
          <ul className="mt-3 space-y-1.5">
            {PERK_KEYS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-brand" />
                <span className="tamil">{t(p)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: plan toggle + price + coupon + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          {/* Full ₹899 / Monthly ₹499 selector */}
          <div className="flex w-full rounded-field bg-tint p-0.5 sm:w-auto">
            {(['full', 'month'] as VettriPlan[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => choosePlan(p)}
                aria-pressed={plan === p}
                className={`flex-1 whitespace-nowrap rounded-[10px] px-3 py-1.5 font-heading text-xs font-semibold transition-colors sm:flex-none ${
                  plan === p ? 'bg-card text-brand shadow-sm' : 'text-ink2 hover:text-ink'
                }`}
              >
                {t(PLANS[p].labelKey)} · ₹{PLANS[p].rupees}
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-2">
            {applied ? (
              <>
                <span className="font-body text-base text-ink2 line-through">₹{sel.rupees}</span>
                <span className="font-display text-3xl font-bold tracking-tight text-ink">
                  {isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
                </span>
              </>
            ) : (
              <span className="font-display text-3xl font-bold tracking-tight text-ink">
                ₹{sel.rupees}
              </span>
            )}
            {!isFree && <span className="font-body text-sm text-ink2">{t(sel.suffixKey)}</span>}
          </div>

          {/* Coupon row */}
          {applied ? (
            <div className="flex items-center gap-2 rounded-field bg-brand-soft px-3 py-2 ring-1 ring-brand/25">
              <Tag size={14} className="text-brand" />
              <span className="font-heading text-xs font-semibold text-ink">
                {applied.code} {t('premiumApplied')}
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                aria-label={t('premiumRemoveCoupon')}
                className="text-ink2 transition-colors hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <div className="flex items-center gap-1.5">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder={t('premiumCouponPlaceholder')}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-32 rounded-field border border-line bg-canvas px-3 py-2 font-body text-sm text-ink placeholder:text-ink2/50 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center rounded-field border border-line bg-card px-3 py-2 font-heading text-xs font-semibold text-ink2 transition-all hover:border-brand/40 hover:text-ink disabled:opacity-50"
                >
                  {checking ? <Loader2 size={14} className="animate-spin" /> : t('premiumApply')}
                </button>
              </div>
              {couponError && <span className="font-body text-xs text-coral">{couponError}</span>}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={paying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-5 py-2.5 font-heading text-sm font-semibold text-white shadow-brand transition-all hover:gap-2.5 hover:brightness-105 active:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Trophy size={16} /> {isFree ? t('premiumGetFree') : t('vettriGet')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Access-period alert, per plan: the Full plan is a limited two-month
          window (not lifetime); the Monthly plan is only the first month/half. */}
      <p className="tamil mt-4 flex items-start gap-2 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-accentwarm" />
        <span>{t(plan === 'month' ? 'vettriMonthNote' : 'vettriFullNote')}</span>
      </p>
    </div>
  )
}
