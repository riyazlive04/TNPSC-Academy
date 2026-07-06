import { useEffect, useRef } from 'react'
import { Check, Crown, Trophy, AlertCircle } from 'lucide-react'
import Spinner from './Spinner'
import { useFocusTrap } from './useFocusTrap'
import { useT } from '../../lib/i18n'

interface PurchaseConfirmModalProps {
  open: boolean
  /** Plan being bought, e.g. "Premium" or "Vettri Nichayam · Full". */
  planName: string
  /** Validity line, e.g. "Group 1 · 3-month plan". */
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
  /** 'warm' = Premium coral, 'brand' = Vettri violet. */
  accent?: 'warm' | 'brand'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Pre-payment recap. Every purchase (Premium / Vettri) passes through this
 * popup so the buyer sees exactly what the plan includes, its validity and the
 * final amount, then explicitly taps OK before the Razorpay checkout opens.
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
  onConfirm,
  onCancel,
}: PurchaseConfirmModalProps) {
  const { t } = useT()
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

  const warm = accent === 'warm'
  const accentText = warm ? 'text-accentwarm' : 'text-brand'
  const Icon = warm ? Crown : Trophy

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
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
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="flex flex-col items-center text-center">
          <span
            className={`mb-3 grid h-12 w-12 place-items-center rounded-full ${
              warm ? 'bg-accentwarmsoft text-accentwarm' : 'bg-brand-soft text-brand'
            }`}
          >
            <Icon size={22} />
          </span>
          <h2 id="buy-confirm-title" className="tamil font-heading text-lg font-semibold text-ink">
            {t('buyConfirmTitle')}
          </h2>
          <p className={`tamil mt-1 font-heading text-sm font-bold ${accentText}`}>{planName}</p>
        </div>

        {/* What you get */}
        <div className="mt-4 rounded-field bg-tint p-4">
          <p className={`tamil font-heading text-[11px] font-bold uppercase tracking-wide ${accentText}`}>
            {t('buyConfirmWhatYouGet')}
          </p>
          <ul className="mt-2 space-y-1.5">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2 font-body text-sm text-ink">
                <Check size={15} className={`mt-0.5 flex-shrink-0 ${accentText}`} />
                <span className="tamil">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Validity + amount */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="tamil font-body text-sm text-ink2">{t('buyConfirmValidity')}</span>
            <span className="tamil text-right font-heading text-sm font-semibold text-ink">
              {validity}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
            <span className="tamil font-body text-sm text-ink2">{t('buyConfirmTotal')}</span>
            <span className="flex items-baseline gap-2">
              {strikePrice && (
                <span className="font-body text-sm text-ink2 line-through">{strikePrice}</span>
              )}
              <span className="font-display text-2xl font-bold tracking-tight text-ink">
                {priceLabel}
              </span>
            </span>
          </div>
        </div>

        {note && (
          <p className="tamil mt-3 flex items-start gap-2 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3 py-2.5 font-body text-xs leading-snug text-ink">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-accentwarm" />
            <span>{note}</span>
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost press flex-1 px-4 py-2.5 text-sm"
          >
            {t('cancel')}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className={`btn press flex-1 px-4 py-2.5 text-sm text-white ${
              warm ? 'bg-accentwarm hover:brightness-105' : 'bg-brand hover:bg-brand-dark'
            }`}
          >
            {busy && <Spinner size={15} />}
            <span className="tamil">{t(isFree ? 'buyConfirmOkFree' : 'buyConfirmOk')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
