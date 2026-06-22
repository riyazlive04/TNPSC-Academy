import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import Spinner from './Spinner'
import { useFocusTrap } from './useFocusTrap'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' paints the confirm button red (destructive actions). */
  tone?: 'danger' | 'brand'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Branded replacement for window.confirm(). Animated backdrop + sheet, focus
 * moves to the confirm button, Escape cancels, click-outside cancels. Used for
 * destructive question deletes and guarded superadmin role changes.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Trap Tab focus within the dialog and restore it on close.
  useFocusTrap(open, dialogRef)

  useEffect(() => {
    if (!open) return
    // Prefer the confirm button for initial focus (overrides the trap's default
    // first-focusable, which would be Cancel).
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 animate-fadeInFast backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 shadow-card outline-none"
      >
        <div className="mb-4 flex flex-col items-center text-center">
          <span
            className={`mb-3 grid h-12 w-12 place-items-center rounded-full ${
              tone === 'danger' ? 'bg-coralsoft text-coral' : 'bg-brand-soft text-brand'
            }`}
          >
            <AlertTriangle size={22} />
          </span>
          <h2 id="confirm-title" className="font-heading text-lg font-semibold text-ink">
            {title}
          </h2>
          <p id="confirm-msg" className="tamil mt-1.5 font-body text-sm text-ink2">
            {message}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost press flex-1 px-4 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className={`btn press flex-1 px-4 py-2.5 text-sm text-white ${
              tone === 'danger'
                ? 'bg-coral hover:brightness-95'
                : 'bg-brand hover:bg-brand-dark'
            }`}
          >
            {busy && <Spinner size={15} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
