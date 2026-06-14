import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AppLayout from './AppLayout'
import YellowBadge from '../UI/YellowBadge'
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
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{badge}</YellowBadge>
        </div>

        {children}
      </div>
    </AppLayout>
  )
}
