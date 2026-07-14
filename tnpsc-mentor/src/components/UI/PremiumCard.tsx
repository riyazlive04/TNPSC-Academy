import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Check, Loader2, Tag, X, Gift, ShieldCheck, Download } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVettriEnabled } from '../../hooks/useVettriEnabled'
import { startCheckout, type CheckoutErrorCode } from '../../lib/razorpay'
import { toast } from '../../store/toastStore'
import { usePremiumStore } from '../../store/premiumStore'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { useCreditsStore } from '../../store/creditsStore'
import { api, type CouponValidation } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { trackInitiateCheckout, trackCheckoutConfirmed } from '../../lib/tracking'
import PurchaseConfirmModal from './PurchaseConfirmModal'
import VettriSuggestModal from './VettriSuggestModal'

// ─── Premium plan pricing ───────────────────────────────────────────────────
// Single source of truth for the 3-month plan. `PRICE_PAISE` is what the order is
// created for (₹1 = 100 paise); the MRP is shown struck-through. When the
// monetisation model firms up, derive these from a server-side plan instead.
export const PREMIUM_MRP_RUPEES = 1699
export const PREMIUM_PRICE_RUPEES = 1699
export const PREMIUM_PRICE_PAISE = PREMIUM_PRICE_RUPEES * 100
const SAVINGS = PREMIUM_MRP_RUPEES - PREMIUM_PRICE_RUPEES
// Value framing shown under the price ("≈ ₹566 / month" for the 3-month plan).
const PER_MONTH_RUPEES = Math.round(PREMIUM_PRICE_RUPEES / 3)

// Test Marathon (premiumPerk5) leads: Premium includes the whole Vettri Nichayam
// series, which is the headline reason to pick Premium over the cheaper bundle.
const PERK_KEYS = [
  'premiumPerk5',
  'premiumPerk1',
  'premiumPerk2',
  'premiumPerk3',
  'premiumPerk4',
  'premiumPerk6',
] as const
const BONUS_KEYS = [
  'premiumBonus1',
  'premiumBonus2',
  'premiumBonus3',
  'premiumBonus4',
] as const

/** A valid, applied coupon (the success branch of CouponValidation). */
type AppliedCoupon = Extract<CouponValidation, { valid: true }>

/** Checkout failure code → translated toast key. */
const PAY_ERR_KEY: Record<CheckoutErrorCode, 'payErrStart' | 'payErrSdk' | 'payErrVerify' | 'payErrPay'> = {
  start: 'payErrStart',
  sdk: 'payErrSdk',
  verify: 'payErrVerify',
  pay: 'payErrPay',
}

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
  showForVettri = false,
}: {
  className?: string
  /** Show a close button that hides the card (re-surfaces after ~1 week). */
  dismissible?: boolean
  /** Vettri owners already paid, so the ambient Premium upsell hides for them
   *  app-wide. Only the Profile page (their one upgrade path) and the forced
   *  paywall modal (which must still answer a Premium-only lock) opt in. */
  showForVettri?: boolean
}) {
  const { profile, isAdmin, isSuperAdmin } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const [paying, setPaying] = useState(false)
  // Pre-payment recap popup: "Get Premium" opens it; checkout runs only on OK.
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Vettri-first suggestion: intercepts the first "Get Premium" tap with the
  // better-value bundle; "Continue with Premium" proceeds to the confirm popup
  // and is remembered for this mount so the pitch never nags twice.
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestSeen, setSuggestSeen] = useState(false)
  const vettriOn = useVettriEnabled()
  const hasVettri = useEntitlementsStore((s) => s.vettri)
  const entitlementsLoaded = useEntitlementsStore((s) => s.loaded)
  const { premium, loaded, refresh, markPremium } = usePremiumStore()
  // Premium is a superset of every paid entitlement, so a successful buy must
  // also update the bundle + credit stores — otherwise the Vettri/Marathon
  // upsells and the finite credit meter linger until a manual reload.
  const markEntitledPremium = useEntitlementsStore((s) => s.markPremium)
  const refreshEntitlements = useEntitlementsStore((s) => s.refresh)
  const reloadCredits = useCreditsStore((s) => s.reload)

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

  // The Vettri pitch needs the bundle entitlement too - on pages where no
  // VettriCard is mounted (e.g. Profile) nothing else loads it, and an unloaded
  // store would mis-pitch Vettri to someone who already owns it.
  useEffect(() => {
    if (!entitlementsLoaded) refreshEntitlements()
  }, [entitlementsLoaded, refreshEntitlements])

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
        // Bilingual for the common miss (a made-up code); other server reasons
        // (expired / limit reached) pass through as-is.
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

  const handleBuy = async () => {
    if (paying) return
    setConfirmOpen(false)
    setPaying(true)
    // Meta: buyer confirmed the recap and Razorpay is opening (high-intent lead).
    trackCheckoutConfirmed({ value: finalPaise / 100, description: 'TNPSC Mentors Premium - 3 months' })
    try {
      const result = await startCheckout({
        amount: PREMIUM_PRICE_PAISE,
        profile,
        description: 'TNPSC Mentors Premium - 3 months',
        notes: { plan: 'premium_annual' },
        couponCode: applied?.code,
      })
      if (result.status === 'paid') {
        // Optimistically flip every entitlement surface, then reconcile with the
        // server (expiry, exact balance) so nothing stays locked until a reload.
        markPremium()
        markEntitledPremium()
        refresh()
        refreshEntitlements()
        reloadCredits()
        // Land on the success screen (it re-pulls the stores again on mount).
        navigate('/payment-success?plan=premium')
      } else if (result.status === 'failed')
        toast.error(result.code ? t(PAY_ERR_KEY[result.code]) : result.error)
      // 'dismissed' → user closed the modal; stay silent.
    } finally {
      setPaying(false)
    }
  }

  // Already premium (or still checking) → render nothing. Hiding until the first
  // check resolves avoids a flash of the upsell for users who already paid.
  // When dismissible, a recent "close" also hides it (until the window lapses).
  // Staff never buy — hide the upsell for admins/superadmins. (useAuth returns the
  // EFFECTIVE role, so an admin using the student-preview toggle still sees it.)
  if (isAdmin || isSuperAdmin) return null
  if (!loaded || !entitlementsLoaded || premium || (dismissible && dismissed)) return null
  // Vettri owners see this card only where showForVettri opts in (Profile /
  // the paywall modal) - no ambient Premium nagging after they've paid.
  if (hasVettri && !showForVettri) return null

  const finalPaise = applied ? applied.finalAmount : PREMIUM_PRICE_PAISE
  const isFree = finalPaise === 0

  // "Get Premium" → pitch Vettri first when it's actually a live alternative:
  // the bundle is enabled, the buyer doesn't already own it, and this is a real
  // payment (a 100%-off coupon has no value decision to make).
  const openPurchase = () => {
    // A typed-but-never-applied code must not be silently ignored: validate it
    // now and stay put, so "Invalid coupon code" (or the applied-✓ chip) shows
    // right here before any purchase dialog opens.
    if (code.trim() && !applied) {
      void applyCoupon()
      return
    }
    // Meta: buyer initiated checkout (opened the Vettri suggest / recap popup).
    trackInitiateCheckout({ value: finalPaise / 100, description: 'TNPSC Mentors Premium - 3 months' })
    if (vettriOn && !hasVettri && !isFree && !suggestSeen) setSuggestOpen(true)
    else setConfirmOpen(true)
  }

  return (
    <div
      className={`card relative overflow-hidden p-6 pl-7 ${className}`}
    >
      {/* Mint accent stripe - premium gets its own identity, distinct from the
          violet app chrome, without another heavy gradient panel. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-mint" />

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mintsoft px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-mint">
            <Crown size={13} /> {t('premiumBadge')}
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">
            {t('premiumTitle')}
          </h2>
          <p className="tamil mt-1 font-heading text-xs font-bold uppercase tracking-wide text-mint">
            {t('premiumValidity')}
          </p>
          <ul className="mt-3 space-y-1.5">
            {PERK_KEYS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-mint" />
                <span className="tamil">
                  {t(p)}
                  {/* The Test Marathon perk carries an inline "download the schedule
                      (PDF)" link to the timetable flyer — same flyer + wording as
                      the VettriCard perk, tinted mint to match this card. */}
                  {p === 'premiumPerk5' && (
                    <>
                      ,{' '}
                      <a
                        href="/test-marathon-2026-schedule.pdf"
                        download="TNPSC-Mentors-Test-Marathon-2026-Schedule.pdf"
                        target="_blank"
                        rel="noopener"
                        className="font-semibold text-mint underline decoration-mint/40 underline-offset-2 transition hover:decoration-mint"
                      >
                        {t('vettriPerk1Link')}
                        <Download size={12} className="ml-1 inline-block align-[-1px]" />
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/* Bonus benefits - a distinct extras block under the core perks. */}
          <div className="mt-4 rounded-field border border-mint/25 bg-mintsoft/60 p-3">
            <p className="tamil flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-mint">
              <Gift size={13} /> {t('premiumBonusTitle')}
            </p>
            <ul className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {BONUS_KEYS.map((b) => (
                <li key={b} className="flex items-start gap-1.5 font-body text-xs text-ink">
                  <Check size={12} className="mt-0.5 flex-shrink-0 text-mint" />
                  <span className="tamil">{t(b)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: checkout panel - price, value framing, coupon and CTA as one
            contained unit instead of loose right-aligned rows. */}
        <div className="w-full flex-shrink-0 rounded-tile border border-line bg-tint/40 p-4 sm:w-64">
          {/* Price */}
          <div className="text-center">
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
              {applied && (
                <span className="font-body text-base text-ink2 line-through">
                  ₹{PREMIUM_PRICE_RUPEES}
                </span>
              )}
              <span className="font-display text-4xl font-bold tracking-tight text-ink">
                {isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
              </span>
              {!isFree && <span className="font-body text-sm text-ink2">{t('premiumPerYear')}</span>}
            </div>
            {applied ? (
              <span className="tamil mt-2 inline-flex items-center rounded-full bg-mint px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white">
                {`${t('premiumYouSave')} ₹${rupees(PREMIUM_PRICE_PAISE - finalPaise)}`}
              </span>
            ) : SAVINGS > 0 ? (
              <span className="tamil mt-2 inline-flex items-center rounded-full bg-mint px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-white">
                {`${t('premiumFlatSave')} ₹${SAVINGS}`}
              </span>
            ) : (
              <p className="tamil mt-1 font-body text-xs text-ink2">
                ≈ ₹{PER_MONTH_RUPEES} {t('premiumPerMonth')}
              </p>
            )}
          </div>

          <div className="my-3.5 border-t border-dashed border-line" />

          {/* Coupon row */}
          {applied ? (
            <div className="flex items-center justify-between gap-2 rounded-field bg-mintsoft px-3 py-2 ring-1 ring-mint/25">
              <span className="flex min-w-0 items-center gap-2">
                <Tag size={14} className="flex-shrink-0 text-mint" />
                <span className="truncate font-heading text-xs font-semibold text-ink">
                  {applied.code} {t('premiumApplied')}
                </span>
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                aria-label={t('premiumRemoveCoupon')}
                className="flex-shrink-0 text-ink2 transition-colors hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    setCouponError(null) // stale error clears as they retype
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder={t('premiumCouponPlaceholder')}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="min-w-0 flex-1 rounded-field border border-line bg-canvas px-3 py-2 font-body text-sm text-ink placeholder:text-ink2/50 focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checking || !code.trim()}
                  className="inline-flex flex-shrink-0 items-center justify-center rounded-field border border-line bg-card px-3 py-2 font-heading text-xs font-semibold text-ink2 transition-all hover:border-mint/40 hover:text-ink disabled:opacity-50"
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
            onClick={openPurchase}
            disabled={paying}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-mint px-5 py-2.5 font-heading text-sm font-semibold text-white shadow-mint transition-all hover:gap-2.5 hover:brightness-105 active:brightness-95 disabled:opacity-60"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Crown size={16} /> {isFree ? t('premiumGetFree') : t('premiumGet')}
              </>
            )}
          </button>

          {/* Trust microcopy - Razorpay order checkout is one-time, not a
              subscription, so "no auto-renewal" is accurate. */}
          <p className="tamil mt-2.5 flex items-center justify-center gap-1 text-center font-body text-[11px] text-ink2">
            <ShieldCheck size={12} className="flex-shrink-0 text-mint" />
            {t('premiumSecureNote')}
          </p>
        </div>
      </div>

      {/* Vettri-first pitch; "Continue with Premium" falls through to the recap. */}
      <VettriSuggestModal
        open={suggestOpen}
        premiumRupees={PREMIUM_PRICE_RUPEES}
        onVettri={() => {
          setSuggestOpen(false)
          navigate('/vettri')
        }}
        onPremium={() => {
          setSuggestOpen(false)
          setSuggestSeen(true)
          setConfirmOpen(true)
        }}
        onClose={() => setSuggestOpen(false)}
      />

      {/* What-you-get recap; Razorpay opens only after the buyer taps OK. */}
      <PurchaseConfirmModal
        open={confirmOpen}
        planName={t('premiumBadge')}
        validity={t('premiumValidity')}
        perks={[...PERK_KEYS, ...BONUS_KEYS].map((k) => t(k))}
        priceLabel={isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
        strikePrice={applied ? `₹${PREMIUM_PRICE_RUPEES}` : undefined}
        isFree={isFree}
        accent="warm"
        busy={paying}
        onConfirm={handleBuy}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
