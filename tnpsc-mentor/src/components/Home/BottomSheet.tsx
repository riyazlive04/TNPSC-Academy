import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'
import { useT } from '../../lib/i18n'

/**
 * The dashboard's popup shell: a bottom sheet on phones, a centred dialog from
 * `sm` up. A dashboard card opens one of these instead of routing away, so a
 * short list (the Daily CA days) is read and dismissed without ever leaving
 * home. Closes on the ✕, on the backdrop, on Escape, and implicitly on any
 * navigation started inside it (the page unmounts with the sheet).
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, panelRef)

  // Escape closes; the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 backdrop-blur-[2px] animate-fadeInFast sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-lg animate-sheetIn overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-canvas shadow-card sm:max-h-[86vh] sm:rounded-3xl"
      >
        {/* Sticky header so the close control is always reachable, however far
            the list of options is scrolled. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-5 py-4 backdrop-blur">
          <h2 className="tamil font-display text-lg font-bold tracking-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-line bg-card text-muted transition-colors hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-7 px-5 pb-8 pt-5">{children}</div>
      </div>
    </div>
  )
}
