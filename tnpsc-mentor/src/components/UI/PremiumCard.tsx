import { useEffect, useState } from 'react'
import { Crown, Check, Loader2, Tag, X, Gift } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { startCheckout } from '../../lib/razorpay'
import { toast } from '../../store/toastStore'
import { usePremiumStore } from '../../store/premiumStore'
import { api, type CouponValidation } from '../../lib/api'
import { useT } from '../../lib/i18n'

// ─── Premium plan pricing ───────────────────────────────────────────────────
// Single source of truth for the 3-month plan. `PRICE_PAISE` is what the order is
// created for (₹1 = 100 paise); the MRP is shown struck-through. When the
// monetisation model firms up, derive these from a server-side plan instead.
export const PREMIUM_MRP_RUPEES = 1699
export const PREMIUM_PRICE_RUPEES = 1699
export const PREMIUM_PRICE_PAISE = PREMIUM_PRICE_RUPEES * 100
const SAVINGS = PREMIUM_MRP_RUPEES - PREMIUM_PRICE_RUPEES

const PERK_KEYS = ['premiumPerk1', 'premiumPerk2', 'premiumPerk3', 'premiumPerk4'] as const
const BONUS_KEYS = [
  'premiumBonus1',
  'premiumBonus2',
  'premiumBonus3',
  'premiumBonus4',
] as const

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Premium upsell card. Shows the struck MRP and the flat 3-month price, lets a
 * customer apply a promoter coupon (validated server-side), and runs the Razorpay
 * checkout (tagged `plan: premium_annual` so the ledger records *what* was bought
 * - the final price is always recomputed on the server from the coupon).
 */
export default function PremiumCard({
  className = '',
  dismissible = false,
}: {
  className?: string
  /** Show a close button that hides the card (re-surfaces after ~1 week). */
  dismissible?: boolean
}) {
  const { profile } = useAuth()
  const { t } = useT()
  const [paying, setPaying] = useState(false)
  const { premium, loaded, refresh, markPremium } = usePremiumStore()

  // In-memory dismissal: closing hides the card for the current view only. It is
  // intentionally NOT persisted - a page reload remounts this component and the
  // upsell shows again.
  const [dismissed, setDismissed] = useState(false)
  const dismiss = () => setDismissed(true)

  // Coupon state.
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Check entitlement once on mount (the store dedupes - only the first card to
  // mount triggers the request; subsequent reads are instant from the store).
  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const applyCoupon = async () => {
    const trimmed = code.trim()
    if (!trimmed || checking) return
    setChecking(true)
    setCouponError(null)
    try {
      const result = await api.coupons.validate({ code: trimmed, plan: 'premium_annual' })
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
        amount: PREMIUM_PRICE_PAISE,
        profile,
        description: 'TNPSC Mentors Premium - 3 months',
        notes: { plan: 'premium_annual' },
        couponCode: applied?.code,
      })
      if (result.status === 'paid') {
        toast.success(t('premiumThanks'))
        markPremium() // hide the card immediately…
        refresh() // …then reconcile with the server (expiry etc.)
      } else if (result.status === 'failed') toast.error(result.error)
      // 'dismissed' → user closed the modal; stay silent.
    } finally {
      setPaying(false)
    }
  }

  // Already premium (or still checking) → render nothing. Hiding until the first
  // check resolves avoids a flash of the upsell for users who already paid.
  // When dismissible, a recent "close" also hides it (until the window lapses).
  if (!loaded || premium || (dismissible && dismissed)) return null

  const finalPaise = applied ? applied.finalAmount : PREMIUM_PRICE_PAISE
  const isFree = finalPaise === 0

  return (
    <div
      className={`card relative overflow-hidden p-6 pl-7 ${className}`}
    >
      {/* Coral accent stripe - premium gets its own identity, distinct from the
          violet app chrome, without another heavy gradient panel. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-accentwarm" />

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accentwarmsoft px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-accentwarm">
            <Crown size={13} /> {t('premiumBadge')}
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">
            {t('premiumTitle')}
          </h2>
          <p className="tamil mt-1 font-heading text-xs font-bold uppercase tracking-wide text-accentwarm">
            {t('premiumValidity')}
          </p>
          <ul className="mt-3 space-y-1.5">
            {PERK_KEYS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-accentwarm" />
                <span className="tamil">{t(p)}</span>
              </li>
            ))}
          </ul>

          {/* Bonus benefits - a distinct extras block under the core perks. */}
          <div className="mt-4 rounded-field border border-accentwarm/25 bg-accentwarmsoft/60 p-3">
            <p className="tamil flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-accentwarm">
              <Gift size={13} /> {t('premiumBonusTitle')}
            </p>
            <ul className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {BONUS_KEYS.map((b) => (
                <li key={b} className="flex items-start gap-1.5 font-body text-xs text-ink">
                  <Check size={12} className="mt-0.5 flex-shrink-0 text-accentwarm" />
                  <span className="tamil">{t(b)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: price + coupon + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-baseline gap-2">
            {applied ? (
              <>
                <span className="font-body text-base text-ink2 line-through">
                  ₹{PREMIUM_PRICE_RUPEES}
                </span>
                <span className="font-display text-3xl font-bold tracking-tight text-ink">
                  {isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
                </span>
              </>
            ) : (
              <span className="font-display text-3xl font-bold tracking-tight text-ink">
                ₹{PREMIUM_PRICE_RUPEES}
              </span>
            )}
            {!isFree && <span className="font-body text-sm text-ink2">{t('premiumPerYear')}</span>}
          </div>
          {(applied || SAVINGS > 0) && (
            <span className="tamil inline-flex items-center rounded-full bg-accentwarm px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white">
              {applied
                ? `${t('premiumYouSave')} ₹${rupees(PREMIUM_PRICE_PAISE - finalPaise)}`
                : `${t('premiumFlatSave')} ₹${SAVINGS}`}
            </span>
          )}

          {/* Coupon row */}
          {applied ? (
            <div className="flex items-center gap-2 rounded-field bg-accentwarmsoft px-3 py-2 ring-1 ring-accentwarm/25">
              <Tag size={14} className="text-accentwarm" />
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
                  className="w-32 rounded-field border border-line bg-canvas px-3 py-2 font-body text-sm text-ink placeholder:text-ink2/50 focus:border-accentwarm/50 focus:outline-none focus:ring-2 focus:ring-accentwarm/20"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center rounded-field border border-line bg-card px-3 py-2 font-heading text-xs font-semibold text-ink2 transition-all hover:border-accentwarm/40 hover:text-ink disabled:opacity-50"
                >
                  {checking ? <Loader2 size={14} className="animate-spin" /> : t('premiumApply')}
                </button>
              </div>
              {couponError && (
                <span className="font-body text-xs text-coral">{couponError}</span>
              )}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={paying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-accentwarm px-5 py-2.5 font-heading text-sm font-semibold text-white shadow-warm transition-all hover:gap-2.5 hover:brightness-105 active:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Crown size={16} /> {isFree ? t('premiumGetFree') : t('premiumGet')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
