import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSmartBack } from '../../hooks/useSmartBack'
import { useT } from '../../lib/i18n'
import { Crumbs, PageGrid, PracticeSidebar, type Crumb } from '../Site/PageKit'

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
  /** Web breadcrumb levels after the section (an open sub-step, e.g. a month). */
  trail?: Crumb[]
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
export default function PickerPage({ badge, children, backTo = '/test-arena', backLabel, trail }: PickerPageProps) {
  const { pathname } = useLocation()
  const goBack = useSmartBack(backTo)
  const { t } = useT()

  // Web: website breadcrumbs replace both the back link (the browser has its
  // own back) and the badge (the last crumb already names the section).
  return (
    <PageGrid nativeWidth="max-w-3xl" className="py-6 lg:py-8" aside={<PracticeSidebar />}>
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary web:hidden"
      >
        <ArrowLeft size={16} /> {backLabel ?? t('back')}
      </button>
      <Crumbs
        className="mb-6"
        items={[
          { label: t('home'), to: '/test-arena' },
          // With a sub-step open, the section crumb links back to its first step.
          { label: badge, to: trail?.length ? pathname : undefined },
          ...(trail ?? []),
        ]}
      />

      <div className="mb-7 mt-4 text-center web:hidden">
        <span className="tamil font-display text-sm font-bold uppercase tracking-[0.14em] text-accent">
          {badge}
        </span>
      </div>

      {children}
    </PageGrid>
  )
}
