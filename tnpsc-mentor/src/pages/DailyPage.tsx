import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Newspaper, Flame } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

export default function DailyPage() {
  const navigate = useNavigate()
  const { t } = useT()

  const start = () => {
    const config: QuizConfig = {
      category: 'current_affairs',
      mock: true,
      scopeToCategory: true,
      mockQuestionCount: 10,
      mockDurationSeconds: 10 * 60,
      label: t('daily'),
    }
    navigate('/quiz', { state: config })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('daily')}</YellowBadge>
        </div>

        <div className="rounded-3xl bg-white p-7 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Newspaper size={32} />
          </div>
          <p className="tamil mb-1 font-heading text-xl font-bold text-navytext">{t('daily')}</p>
          <p className="tamil mb-6 font-body text-sm text-navytext/60">{t('dailyCta')}</p>
          <button
            onClick={start}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navytext shadow-pill transition hover:-translate-y-0.5"
          >
            <Flame size={20} /> {t('startMock')}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
