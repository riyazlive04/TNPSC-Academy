import { useEffect, useRef } from 'react'
import { Coins } from 'lucide-react'
import { useFocusTrap } from './useFocusTrap'
import { useT } from '../../lib/i18n'

interface CreditConfirmPopupProps {
  open: boolean
  /** Credits this test will debit (= its question count, 1 credit/question). */
  cost: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Pre-test credit popup for free (credit-gated) learners, raised when they tap
 * "Enter full screen" on an instructions page: this test debits `cost` credits
 * (1 per question). Bilingual via useT(). The pages only open it for
 * non-unlimited users, so it never interrupts premium/Vettri/staff. Same dialog
 * anatomy as ConfirmDialog (focus trap, Escape/click-outside cancel).
 */
export default function CreditConfirmPopup({ open, cost, onConfirm, onCancel }: CreditConfirmPopupProps) {
  const { t } = useT()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="credit-confirm-title"
        aria-describedby="credit-confirm-msg"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-4 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-accentwarmsoft text-accentwarm">
            <Coins size={22} />
          </span>
          <h2 id="credit-confirm-title" className="tamil font-heading text-lg font-semibold text-ink">
            {t('creditConfirmTitle').replace('{n}', String(cost))}
          </h2>
          <p id="credit-confirm-msg" className="tamil mt-1.5 font-body text-sm text-ink2">
            {t('creditDebitNotice').replace('{n}', String(cost))}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost press flex-1 px-4 py-2.5 text-sm">
            {t('cancel')}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="btn press flex-1 bg-brand px-4 py-2.5 text-sm text-white hover:bg-brand-dark"
          >
            {t('creditConfirmStart')}
          </button>
        </div>
      </div>
    </div>
  )
}
