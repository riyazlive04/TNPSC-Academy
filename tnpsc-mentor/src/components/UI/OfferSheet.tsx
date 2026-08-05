import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { useFocusTrap } from './useFocusTrap'
import { DURATION, EASE_OUT } from '../../lib/motion'
import { useT } from '../../lib/i18n'

/**
 * A paywall shown as a POPUP card rather than a banner: raised over a locked
 * screen for a learner who has not paid, then swiped away (drag it down) or
 * closed (✕ / backdrop / Escape / "skip") to reveal the content behind it.
 * Holds the REAL purchase cards as children, so nothing about the coupon →
 * confirm → Razorpay → entitlement-refresh flow is duplicated here.
 *
 * Drag is driven by dragControls (dragListener={false}) on purpose: with a plain
 * `drag="y"` listener Motion writes `touch-action: pan-x` onto the panel, which
 * would kill vertical scrolling of the cards inside it on a phone. Instead the
 * gesture starts from the grab handle/header, or from the body while it is
 * scrolled to the top — below that, a downward pan is a scroll, not a dismiss.
 *
 * Sits at z-[50], below the purchase-confirm dialog (z-[55]) the embedded cards
 * raise, and below the onboarding tour (z-[70]).
 */

/** Finger travel / flick speed that counts as "swiped away". */
const DISMISS_PX = 110
const DISMISS_VELOCITY = 550

/** Controls inside the cards must keep their taps — never start a drag on them. */
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"]'

export default function OfferSheet({
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const reduce = useReducedMotion()
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

  /** Grab handle + header: always draggable, except on the ✕ itself. */
  const startFromHeader = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return
    dragControls.start(e)
  }

  /** Body: draggable by touch only, and only while scrolled to the top. */
  const startFromBody = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') return
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return
    dragControls.start(e)
  }

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_PX || info.velocity.y > DISMISS_VELOCITY) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="offer-sheet"
          className="fixed inset-0 z-[50] flex items-end justify-center bg-ink/60 backdrop-blur-[2px] sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.micro }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-sheet-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: DURATION.standard, ease: EASE_OUT }}
            className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-canvas shadow-card outline-none sm:max-h-[88dvh] sm:rounded-3xl"
          >
            {/* Drag zone: grab handle + title row, with the ✕ always reachable. */}
            <div
              onPointerDown={startFromHeader}
              className="flex-shrink-0 touch-none cursor-grab rounded-t-3xl pt-2.5 active:cursor-grabbing"
            >
              <div className="mx-auto h-1.5 w-11 rounded-full bg-line" />
              <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
                <div className="min-w-0">
                  <h2
                    id="offer-sheet-title"
                    className="tamil font-display text-[17px] font-bold tracking-tight text-ink"
                  >
                    {title}
                  </h2>
                  <p className="tamil mt-0.5 font-body text-[12px] text-muted">
                    {t('offerSheetHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('close')}
                  className="focus-ring grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-line bg-card text-muted transition-colors hover:text-ink"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* The real purchase cards — coupon, plan toggle, Razorpay and all. */}
            <div
              ref={scrollRef}
              onPointerDown={startFromBody}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6 pt-1 sm:px-5"
            >
              {children}
              <button type="button" onClick={onClose} className="btn-ghost w-full py-2.5 text-sm">
                <span className="tamil">{t('offerSheetSkip')}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
