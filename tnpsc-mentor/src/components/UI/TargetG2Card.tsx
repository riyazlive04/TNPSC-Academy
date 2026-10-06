import { useState } from 'react'
import { BookOpen, Check, Loader2, Tag, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useT } from '../../lib/i18n'
import { usePlanSales } from '../../hooks/usePlanSales'
import {
  useTargetG2Purchase,
  TARGET_G2_PRICE_RUPEES,
  TARGET_G2_PERK_KEYS as PERK_KEYS,
  type TargetG2Track,
} from '../../hooks/useTargetG2Purchase'
import PurchaseConfirmModal from './PurchaseConfirmModal'

export { TARGET_G2_PRICE_RUPEES }

/** ₹ from paise, no trailing .00 for whole rupees. */
function rupees(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

/**
 * Target Group 2 2026 upsell card for ONE language track — a standalone
 * ₹849/90-day plan that no other plan includes, and that includes no other
 * plan. Unlocks that track's 13 papers and nothing else.
 *
 * Rendered twice (English + Tamil) in the hub's locked paywall, because an
 * aspirant who has not bought yet is choosing between exactly these two. The
 * purchase mechanics live in useTargetG2Purchase(), shared with the two pay-link
 * pages so every surface charges the same thing the same way.
 *
 * Hides itself for staff, for anyone who already owns THIS track (owning the
 * other one does not hide it — that is the second purchase), and whenever the
 * series is withdrawn from sale.
 */
export default function TargetG2Card({
  track,
  className = '',
}: {
  track: TargetG2Track
  className?: string
}) {
  const { isAdmin, isSuperAdmin } = useAuth()
  const { t } = useT()
  const sales = usePlanSales()
  const {
    paying,
    confirmOpen,
    setConfirmOpen,
    startEnroll,
    handleBuy,
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
  } = useTargetG2Purchase(track)

  const [dismissed] = useState(false)
  const title = track === 'english' ? t('targetG2EnglishTitle') : t('targetG2TamilTitle')

  // Staff never buy; a withdrawn plan disappears everywhere (reads false until
  // the flags resolve, so a hidden plan never flashes on screen first); and an
  // owner of this track has nothing left to buy here.
  if (isAdmin || isSuperAdmin) return null
  if (!sales.targetG2) return null
  if (!loaded || unlocked || dismissed) return null

  return (
    <div className={`card relative overflow-hidden p-6 pl-7 ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: title + perks */}
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tint-violet px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-brand">
            <BookOpen size={13} /> {t('targetG2Badge')}
          </span>
          <h2 className="tamil mt-3 font-display text-xl font-bold tracking-tight text-ink">
            {title}
          </h2>
          <p className="tamil mt-1 font-heading text-xs font-bold uppercase tracking-wide text-brand">
            {t('targetG2Validity')}
          </p>
          <ul className="mt-3 space-y-1.5">
            {PERK_KEYS.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink2">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-brand" />
                <span className="tamil">{t(p)}</span>
              </li>
            ))}
          </ul>
          <p className="tamil mt-3 font-body text-xs leading-snug text-ink2">
            {t('targetG2OtherTrack')}
          </p>
        </div>

        {/* Right: price + coupon + CTA */}
        <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
          <span className="font-display text-3xl font-bold tracking-tight text-ink">
            {isFree ? t('premiumFree') : applied ? displayPrice : basePrice}
          </span>

          {showCoupon &&
            (applied ? (
              <div className="flex items-center gap-2 rounded-field bg-tint-violet px-3 py-2 ring-1 ring-brand/25">
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
            ))}

          <button
            onClick={startEnroll}
            disabled={paying}
            className="btn-wrap inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-5 py-2.5 font-heading text-sm font-semibold text-white shadow-brand transition-all hover:brightness-105 active:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {paying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <BookOpen size={16} /> {isFree ? t('premiumGetFree') : t('targetG2Get')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* What-you-get recap; Razorpay opens only after the buyer taps OK. */}
      <PurchaseConfirmModal
        open={confirmOpen}
        planName={title}
        validity={t('targetG2Validity')}
        perks={PERK_KEYS.map((k) => t(k))}
        priceLabel={isFree ? t('premiumFree') : `₹${rupees(finalPaise)}`}
        isFree={isFree}
        accent="brand"
        busy={paying}
        onConfirm={handleBuy}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
