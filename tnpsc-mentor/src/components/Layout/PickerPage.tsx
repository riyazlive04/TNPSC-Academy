import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AppLayout from './AppLayout'
import { useT } from '../../lib/i18n'

interface PickerPageProps {
  /** The yellow section badge shown at the top (already translated). */
  badge: ReactNode
  children: ReactNode
}

/**
 * Shared chrome for the category-picker screens (PYQ, Samacheer, Current
 * Affairs, Aptitude): the "back to Test Arena" link, the section badge, and the
 * centered max-width container. Keeps every picker visually identical and frees
 * each page to only declare its selection steps.
 */
export default function PickerPage({ badge, children }: PickerPageProps) {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-7 mt-4 text-center">
          <span className="tamil font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
            {badge}
          </span>
        </div>

        {children}
      </div>
    </AppLayout>
  )
}
