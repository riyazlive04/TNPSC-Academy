import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useSmartBack } from '../../hooks/useSmartBack'
import { useT } from '../../lib/i18n'

interface PickerPageProps {
  /** The yellow section badge shown at the top (already translated). */
  badge: ReactNode
  children: ReactNode
  /**
   * Where to fall back to when there is no in-app history to return to (the page
   * was deep-linked / opened in a fresh tab). Normal back always steps to the
   * immediately previous screen via history; this only names a safe landing for
   * the no-history case. Defaults to the Test Arena hub.
   */
  backTo?: string
  /** Back-button label. Defaults to the generic "Back". */
  backLabel?: ReactNode
}

/**
 * Shared chrome for the category-picker screens (PYQ, Samacheer, Current
 * Affairs, Aptitude): the back link, the section badge, and the centered
 * max-width container. Keeps every picker visually identical and frees each page
 * to only declare its selection steps.
 *
 * The back link steps to the immediately previous screen in the navigation
 * stack (see useSmartBack) so a deep flow — PYQ chooser → group → section —
 * reverses one step at a time instead of jumping straight to the Test Arena.
 */
export default function PickerPage({ badge, children, backTo = '/test-arena', backLabel }: PickerPageProps) {
  const goBack = useSmartBack(backTo)
  const { t } = useT()

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {backLabel ?? t('back')}
        </button>

        <div className="mb-7 mt-4 text-center">
          <span className="tamil font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
            {badge}
          </span>
        </div>

        {children}
      </div>
    </>
  )
}
