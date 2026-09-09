import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, Crown, Trophy, Rocket, ListChecks, AlertCircle, Languages } from 'lucide-react'
import Spinner from './Spinner'
import { useFocusTrap } from './useFocusTrap'
import { translate, useT, type StringKey } from '../../lib/i18n'

/** The two languages a public landing/pay page can pin this sheet to. The
 *  app-wide store also has 'both', which is deliberately not offered here —
 *  a payment recap shown twice over would be the tallest layout of the three. */
export type ConfirmLang = 'ta' | 'en'

interface PurchaseConfirmModalProps {
  open: boolean
  /** Plan being bought, e.g. "Premium" or "Vettri Nichayam · Full". */
  planName: string
  /** Validity line, e.g. "6-month plan". */
  validity: string
  /** Already-translated benefit lines shown as a checklist. */
  perks: string[]
  /** Final amount label, e.g. "₹1699" or "₹0" (after any coupon). */
  priceLabel: string
  /** Original price shown struck-through when a coupon is applied. */
  strikePrice?: string
  /** Extra caution line (e.g. Vettri monthly covers only the first month). */
  note?: string
  /** Free unlock (100% coupon) - changes the OK label, no Razorpay opens. */
  isFree?: boolean
  /** 'warm' = Premium mint green, 'brand' = Vettri violet, 'gold' = Rank Booster
   *  amber, 'sky' = Mock Pack blue. */
  accent?: 'warm' | 'brand' | 'gold' | 'sky'
  busy?: boolean
  /**
   * Pin this sheet's own chrome (title, "What you get", buttons…) to a
   * language, overriding the app-wide language store. The public landing and
   * pay pages carry their own EN/TA toggle and pass their perk/plan strings in
   * THAT language — without this the sheet's frame came from the store while
   * its body came from the page, so a Tamil recap could sit inside an English
   * frame (or refuse to follow the page's toggle at all).
   */
  lang?: ConfirmLang
  /** When set, the sheet renders its own compact EN/TA switch and reports
   *  changes here, so a buyer can flip language at the payment step itself
   *  instead of dismissing the sheet to reach the page's toggle. */
  onLangChange?: (lang: ConfirmLang) => void
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Pre-payment recap. Every purchase (Premium / Vettri / Rank Booster / Mock
 * Pack) passes through this popup so the buyer sees exactly what the plan
 * includes, its validity and the final amount, then explicitly taps OK before
 * the Razorpay checkout opens.
 *
 * Laid out as a three-band flex column — header, perks, and a pinned
 * price+buttons footer — capped at the viewport height. The footer never
 * scrolls out of reach, so "how much" and "pay" are on screen the moment the
 * sheet opens; only the perk list can shrink, and only on a phone small enough
 * (or a font scale large enough) that the compact list still doesn't fit.
 */
export default function PurchaseConfirmModal({
  open,
  planName,
  validity,
  perks,
  priceLabel,
  strikePrice,
  note,
  isFree = false,
  accent = 'brand',
  busy = false,
  lang,
  onLangChange,
  onConfirm,
  onCancel,
}: PurchaseConfirmModalProps) {
  const { t: storeT } = useT()
  // A page-supplied language wins over the app-wide store; every other
  // call-site passes nothing and keeps the store behaviour it always had.
  const t = (key: StringKey) => (lang ? translate(key, lang) : storeT(key))
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const ACCENTS = {
    warm: { text: 'text-mint', badgeBg: 'bg-mintsoft', Icon: Crown, button: 'bg-mint hover:brightness-105' },
    brand: { text: 'text-brand', badgeBg: 'bg-brand-soft', Icon: Trophy, button: 'bg-brand hover:bg-brand-dark' },
    gold: { text: 'text-gold', badgeBg: 'bg-goldsoft', Icon: Rocket, button: 'bg-gold hover:brightness-105' },
    sky: { text: 'text-sky', badgeBg: 'bg-tint-blue', Icon: ListChecks, button: 'bg-sky hover:brightness-105' },
  } as const
  const { text: accentText, badgeBg, Icon, button: confirmButtonBg } = ACCENTS[accent]

  // Portalled to <body>: the card that owns this recap can sit inside a
  // transformed/animated container (the Vettri offer sheet drags on the Y axis),
  // and a transformed ancestor would otherwise become the containing block for
  // this `fixed` overlay and pin it inside the sheet.
  return createPortal(
    <div
      // overflow-hidden on the overlay is the hard guarantee against the
      // horizontal scrollbar this sheet used to produce: nothing inside it can
      // push the page sideways, whatever a translated label does.
      className="fixed inset-0 z-[55] flex items-center justify-center overflow-hidden bg-ink/40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-fadeInFast backdrop-blur-sm short:pt-2 short:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-confirm-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // max-h-full resolves against the padded overlay box, so the sheet can
        // never be taller than the viewport it sits in.
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden animate-sheetIn rounded-3xl border border-line bg-card shadow-card outline-none"
      >
        {/* ─── Header: identity + (optionally) the language switch ───────── */}
        <div className="flex shrink-0 items-center gap-3 px-4 pt-4 short:pt-3 sm:px-5 sm:pt-5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full short:h-9 short:w-9 ${badgeBg} ${accentText}`}>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="buy-confirm-title" className="tamil font-heading text-2xs font-semibold uppercase tracking-wide text-ink2">
              {t('buyConfirmTitle')}
            </h2>
            <p className={`tamil font-heading text-base font-bold leading-tight ${accentText}`}>{planName}</p>
          </div>
          {onLangChange && (
            <div className="seg-wrap shrink-0 p-0.5" role="group" aria-label="Language">
              <button
                type="button"
                onClick={() => onLangChange('ta')}
                className={`seg px-2 py-1 text-xs ${lang === 'ta' ? 'seg-active' : ''}`}
                aria-pressed={lang === 'ta'}
              >
                <Languages size={12} className="mr-1 inline-block align-[-1px]" />த
              </button>
              <button
                type="button"
                onClick={() => onLangChange('en')}
                className={`seg px-2 py-1 text-xs ${lang === 'en' ? 'seg-active' : ''}`}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
            </div>
          )}
        </div>

        {/* ─── What you get: the ONE band allowed to shrink ──────────────── */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 short:mt-2 sm:px-5">
          <div className="rounded-field bg-tint p-3 short:p-2.5">
            <p className={`tamil font-heading text-2xs font-bold uppercase tracking-wide ${accentText}`}>
              {t('buyConfirmWhatYouGet')}
            </p>
            <ul className="mt-1.5 space-y-1">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-2 font-body text-[13px] leading-snug text-ink short:text-xs short:leading-[1.3]">
                  <Check size={14} className={`mt-[3px] flex-shrink-0 ${accentText}`} />
                  {/* min-w-0 + break-words: a long unbroken token in either
                      language wraps instead of widening the sheet. */}
                  <span className="tamil min-w-0 break-words">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rides in the flexible band, not the pinned footer: it's supporting
              detail (e.g. "this offer price ends 31 Aug"), and the amount and
              the pay button are what must never be pushed off screen. */}
          {note && (
            <p className="tamil mt-2 flex items-start gap-1.5 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-2.5 py-2 font-body text-[11px] leading-snug text-ink">
              <AlertCircle size={12} className="mt-0.5 shrink-0 text-accentwarm" />
              <span>{note}</span>
            </p>
          )}
        </div>

        {/* ─── Pinned footer: validity, amount, and the two actions ───────── */}
        <div className="shrink-0 px-4 pb-4 pt-3 short:pb-3 short:pt-2 sm:px-5 sm:pb-5">
          <div className="flex items-center justify-between gap-3">
            <span className="tamil shrink-0 font-body text-xs text-ink2">{t('buyConfirmValidity')}</span>
            {/* The value is the longer string in both languages, so it is the
                one that wraps - a wrapped "Validity" label reads as broken. */}
            <span className="tamil min-w-0 text-right font-heading text-xs font-semibold text-ink">
              {validity}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-line pt-1.5">
            <span className="tamil font-body text-xs text-ink2">{t('buyConfirmTotal')}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {strikePrice && (
                <span className="font-body text-sm text-ink2 line-through">{strikePrice}</span>
              )}
              <span className="font-display text-2xl font-bold tracking-tight text-ink short:text-xl">
                {priceLabel}
              </span>
            </span>
          </div>

          {/* Both buttons wrap. `.btn` is whitespace-nowrap by design, which
              spilled the Tamil confirm label ("சரி, பணம் செலுத்த தொடரவும்",
              ~2x the English) straight out of the pill and gave the sheet a
              horizontal scrollbar. Cancel is the narrower of the two: the
              confirm label is the long one in both languages. */}
          <div className="mt-3.5 flex items-stretch gap-2.5 short:mt-2.5">
            <button
              onClick={onCancel}
              disabled={busy}
              className="btn-wrap btn-ghost press min-w-0 basis-[32%] px-3 py-2.5 text-sm short:py-2"
            >
              {t('cancel')}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={busy}
              className={`btn btn-wrap press min-w-0 flex-1 px-3 py-2.5 text-sm text-white short:py-2 ${confirmButtonBg}`}
            >
              {busy && <Spinner size={15} />}
              <span className="tamil">{t(isFree ? 'buyConfirmOkFree' : 'buyConfirmOk')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
