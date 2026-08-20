import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, Check, Loader2, Tag, X, Download, AlertCircle, Gift } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useT } from '../../lib/i18n'
import {
  useRankBoosterPurchase,
  rupees,
  RANK_BOOSTER_MRP_RUPEES,
  RANK_BOOSTER_PRICE_RUPEES,
  RANK_BOOSTER_PRICE_PAISE,
  RANK_BOOSTER_SAVINGS,
  RANK_BOOSTER_PERK_KEYS as PERK_KEYS,
  RANK_BOOSTER_BONUS_KEYS as BONUS_KEYS,
} from '../../hooks/useRankBoosterPurchase'
import PurchaseConfirmModal from './PurchaseConfirmModal'
import StoreCodeRow from './StoreCodeRow'

export {
  RANK_BOOSTER_MRP_RUPEES,
  RANK_BOOSTER_PRICE_RUPEES,
  RANK_BOOSTER_PRICE_PAISE,
  RANK_BOOSTER_SAVINGS,
}

/**
 * Group II/IIA Rank Booster upsell card — a standalone ₹1,249/90-day plan (NOT
 * included by Vettri Nichayam; Premium includes it as a superset). Unlocks the
 * 23-test Rank Booster series. Hidden for anyone who already has it or Premium.
 * The actual purchase mechanics (coupon, confirm modal, Razorpay checkout)
 * live in useRankBoosterPurchase() — shared with the /rank-booster landing
 * page so both surfaces stay identical.
 */
export default function RankBoosterCard({
  className = '',
  dismissible = false,
}: {
  className?: string
  /** Show a close button that hides the card for the current view only. */
  dismissible?: boolean
}) {
  const { isAdmin, isSuperAdmin } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()
  const purchase = useRankBoosterPurchase()
  const {
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
  } = purchase

  const [dismissed, setDismissed] = useState(false)
  const dismiss = () => setDismissed(true)

  // Already unlocked (Rank Booster or Premium) or still checking → render nothing.
  // Staff never buy — hide the upsell for admins/superadmins.
  if (isAdmin || isSuperAdmin) return null
  if (!loaded || rankBoosterUnlocked || (dismissible && dismissed)) return null

  return (
    <div className={`card relative overflow-hidden p-6 pl-7 ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gold" />

      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          title={t('dismiss')}
          className="absolute right-1 top-1 z-10 grid h-11 w-11 place-items-center rounded-full text-ink2/60 transition hover:bg-tint hover:text-ink focus-ring active:scale-90"
        >
          <X size={16} />
        </button>
      )}

      {/* Offer banner - mirrors VettriCard's/PremiumCard's Test Marathon strip
          (icon + title + subtitle + pill), gold-themed to match this card
          instead of copying their violet. Leads with the Independence Day
          offer since that's the single biggest new fact for this card. */}
      <div className="relative -ml-7 -mr-6 -mt-6 mb-5 bg-gradient-to-r from-accentwarm to-gold py-4 pl-7 pr-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
              <Rocket size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="tamil font-display text-base font-bold tracking-tight">
                {t('rankBoosterOfferBadge')}
              </h3>
            </div>
          </div>
          <span className="tamil flex-shrink-0 rounded-pill bg-white/15 px-3 py-1 font-heading text-2xs font-semibold">
            {t('rankBoosterValidity')}
          </span>
        </div>
      </div>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: title + perks */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-goldsoft px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-gold">
            <Rocket size={13} /> {t('rankBoosterBadge')}
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-ink">
            {t('rankBoosterTitle')}
          </h2>
          <p className="tamil mt-1 font-heading text-xs font-bold uppercase tracking-wide text-gold">
            {t('rankBoosterValidity')}
          </p>
          <a
            href="/rank-booster-2026-schedule.pdf"
            download="TNPSC-Mentors-Rank-Booster-2026-Schedule.pdf"
            target="_blank"
            rel="noopener"
            className="tamil mt-1.5 inline-flex items-center gap-1.5 font-body text-xs font-semibold text-accentwarm underline decoration-accentwarm/40 underline-offset-2 transition hover:decoration-accentwarm"
          >
            <Download size={12} /> {t('downloadSchedule')}
          </a>
          <ul className="mt-3 space-y-1.5">
            {PERK_KEYS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-gold" />
                <span className="tamil">{t(p)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-field border border-gold/25 bg-goldsoft/60 p-3">
            <p className="tamil flex items-center gap-1.5 font-heading text-2xs font-bold uppercase tracking-wide text-gold">
              <Gift size={13} /> {t('vettriBonusTitle')}
            </p>
            <ul className="mt-2 space-y-1">
              {BONUS_KEYS.map((b) => (
                <li key={b} className="flex items-start gap-1.5 font-body text-xs text-ink">
                  <Check size={12} className="mt-0.5 flex-shrink-0 text-gold" />
                  <span className="tamil">{t(b)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: price + coupon + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex items-baseline gap-2">
              {/* MRP always struck through — a standing Independence Day offer,
                  not a coupon-only discount (mirrors PremiumCard's MRP/SAVINGS
                  split, just always-on here instead of coupon-gated). */}
              <span className="font-body text-base text-ink2 line-through">
                ₹{RANK_BOOSTER_MRP_RUPEES}
              </span>
              <span className="font-display text-3xl font-bold tracking-tight text-ink">
                {isFree ? t('premiumFree') : applied ? displayPrice : basePrice}
              </span>
            </div>
            {applied && (
              <span className="tamil inline-flex items-center rounded-full bg-accentwarm px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white">
                {t('premiumYouSave')} ₹{rupees(RANK_BOOSTER_PRICE_PAISE - finalPaise)}
              </span>
            )}
          </div>

          {!showCoupon ? (
            <StoreCodeRow onRedeemed={() => navigate('/payment-success?plan=rank_booster_g2')} />
          ) : applied ? (
            <div className="flex items-center gap-2 rounded-field bg-goldsoft px-3 py-2 ring-1 ring-gold/25">
              <Tag size={14} className="text-gold" />
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
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  placeholder={t('premiumCouponPlaceholder')}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-32 rounded-field border border-line bg-canvas px-3 py-2 font-body text-sm text-ink placeholder:text-ink2/50 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center rounded-field border border-line bg-card px-3 py-2 font-heading text-xs font-semibold text-ink2 transition-all hover:border-gold/40 hover:text-ink disabled:opacity-50"
                >
                  {checking ? <Loader2 size={14} className="animate-spin" /> : t('premiumApply')}
                </button>
              </div>
              {couponError && <span className="font-body text-xs text-coral">{couponError}</span>}
            </div>
          )}

          <button
            onClick={startEnroll}
            disabled={paying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-gold px-5 py-2.5 font-heading text-sm font-semibold text-white shadow-gold transition-all hover:gap-2.5 hover:brightness-105 active:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Rocket size={16} /> {isFree ? t('premiumGetFree') : t('rankBoosterGet')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Offer-deadline alert, mirrors VettriCard's access-period note. */}
      <p className="tamil mt-4 flex items-start gap-2 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-accentwarm" />
        <span>{t('rankBoosterOfferNote')}</span>
      </p>

      {/* What-you-get recap; Razorpay opens only after the buyer taps OK. */}
      <PurchaseConfirmModal
        open={confirmOpen}
        planName={t('rankBoosterTitle')}
        validity={t('rankBoosterValidity')}
        perks={[...PERK_KEYS, ...BONUS_KEYS].map((k) => t(k))}
        priceLabel={isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
        strikePrice={isFree ? undefined : `₹${RANK_BOOSTER_MRP_RUPEES}`}
        note={t('rankBoosterOfferNote')}
        isFree={isFree}
        accent="gold"
        busy={paying}
        onConfirm={handleBuy}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
