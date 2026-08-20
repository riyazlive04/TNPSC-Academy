import { useEffect, useRef } from 'react'
import { Trophy, Check } from 'lucide-react'
import { useFocusTrap } from './useFocusTrap'
import { useT } from '../../lib/i18n'
import { VETTRI_PRICE_RUPEES, VETTRI_MONTH_RUPEES } from './VettriCard'

interface VettriSuggestModalProps {
  open: boolean
  /** Premium's price, passed in (not imported) to avoid a PremiumCard import cycle. */
  premiumRupees: number
  /** "View Vettri Nichayam" - the buyer wants the better-value bundle. */
  onVettri: () => void
  /** "Continue with Premium" - proceed to the normal Premium confirm + checkout. */
  onPremium: () => void
  /** Backdrop / Escape - the buyer stepped away from both. */
  onClose: () => void
}

// Perks quoted from the Vettri card so the pitch never drifts from the product.
const PERK_KEYS = ['vettriPerk1', 'vettriBonus1', 'vettriBonus2', 'vettriBonus3'] as const

/**
 * Value-first interception shown when a buyer taps "Get Premium": recommends
 * the cheaper Vettri Nichayam bundle, with an explicit "Continue with Premium"
 * path so nobody is blocked from paying more if they want to.
 */
export default function VettriSuggestModal({
  open,
  premiumRupees,
  onVettri,
  onPremium,
  onClose,
}: VettriSuggestModalProps) {
  const { t } = useT()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const savings = premiumRupees - VETTRI_PRICE_RUPEES

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vettri-suggest-title"
        aria-describedby="vettri-suggest-body"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-goldsoft text-gold">
            <Trophy size={22} />
          </span>
          <h2 id="vettri-suggest-title" className="tamil font-heading text-lg font-semibold text-ink">
            {t('vettriSuggestTitle')}
          </h2>
          <p id="vettri-suggest-body" className="tamil mt-1.5 font-body text-sm text-ink2">
            {t('vettriSuggestBody')}
          </p>
        </div>

        {/* Price comparison - Vettri leads with its gold identity. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-tile border border-gold/40 bg-goldsoft/50 p-3 text-center">
            <p className="tamil font-heading text-2xs font-bold uppercase tracking-wide text-gold">
              {t('vettriBadge')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
              ₹{VETTRI_PRICE_RUPEES}
            </p>
            <p className="tamil font-body text-2xs text-ink2">
              {t('vettriSuggestMonths')} · {t('vettriPlanMonth')} ₹{VETTRI_MONTH_RUPEES}
            </p>
          </div>
          <div className="rounded-tile border border-line bg-tint/40 p-3 text-center">
            <p className="tamil font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
              {t('premiumBadge')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
              ₹{premiumRupees}
            </p>
            <p className="tamil font-body text-2xs text-ink2">
              {t('vettriSuggestPremiumMonths')}
            </p>
          </div>
        </div>
        {savings > 0 && (
          <p className="mt-2.5 text-center">
            <span className="tamil inline-flex items-center rounded-full bg-gold px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-white">
              {t('premiumYouSave')} ₹{savings}
            </span>
          </p>
        )}

        {/* What the bundle includes - same strings as the Vettri card. */}
        <ul className="mt-3 space-y-1">
          {PERK_KEYS.map((k) => (
            <li key={k} className="flex items-start gap-1.5 text-left font-body text-xs text-ink2">
              <Check size={13} className="mt-0.5 flex-shrink-0 text-gold" />
              <span className="tamil">{t(k)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={primaryRef}
            onClick={onVettri}
            className="press inline-flex w-full items-center justify-center gap-2 rounded-pill bg-gold px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all hover:brightness-105 active:brightness-95"
          >
            <Trophy size={15} />
            <span className="tamil">{t('vettriSuggestGo')}</span>
          </button>
          <button onClick={onPremium} className="btn-ghost press w-full px-4 py-2.5 text-sm">
            <span className="tamil">{t('vettriSuggestStay')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
