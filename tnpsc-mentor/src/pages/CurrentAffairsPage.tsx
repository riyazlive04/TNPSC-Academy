import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, ChevronRight, Newspaper, CalendarDays } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { CA_MONTHS, CA_TOPIC_CATEGORIES, topicName } from '../lib/constants'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

type CAView = 'month_wise' | 'topic_wise'

export default function CurrentAffairsPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const [view, setView] = useState<CAView>('month_wise')

  // Weekly revision - a 20-question mixed current-affairs consolidation drill.
  const startWeeklyRevision = () => {
    const config: QuizConfig = {
      category: 'current_affairs',
      mock: true,
      scopeToCategory: true,
      weekly: true,
      mockQuestionCount: 20,
      mockDurationSeconds: 20 * 60,
      label: t('weeklyRevision'),
    }
    navigate('/quiz', { state: config })
  }

  // Topic-wise: distinct ca topic values from the DB.
  const [topics, setTopics] = useState<string[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [topicError, setTopicError] = useState('')

  useEffect(() => {
    if (view !== 'topic_wise') return
    let cancelled = false
    const fetchTopics = async () => {
      setLoadingTopics(true)
      setTopicError('')
      try {
        const distinct = await api.distinctTopics({ category: 'current_affairs' })
        if (!cancelled) setTopics(distinct.length ? distinct : CA_TOPIC_CATEGORIES)
      } catch {
        if (!cancelled) {
          setTopicError(t('couldNotLoad'))
          setTopics(CA_TOPIC_CATEGORIES)
        }
      } finally {
        if (!cancelled) setLoadingTopics(false)
      }
    }
    fetchTopics()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const handleMonth = (label: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: label,
      label: `${t('currentAffairsBadge')} · ${label}`,
    })
  }

  const handleTopic = (topic: string) => {
    startTest({
      category: 'current_affairs',
      topic,
      label: `${t('currentAffairsBadge')} · ${topicName(topic, lang)}`,
    })
  }

  return (
    <PickerPage badge={t('currentAffairsBadge')}>
      {/* Weekly revision - a quick consolidation drill across the CA pool */}
      <button
        onClick={startWeeklyRevision}
        className="hero-panel interactive group relative mx-auto mb-7 flex w-full max-w-2xl items-center gap-4 p-5 text-left"
      >
        <span
          className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
          style={{ backgroundSize: '18px 18px' }}
        />
        <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
          <RefreshCw size={20} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="tamil block font-heading text-[15px] font-semibold text-white">
            {t('weeklyRevision')}
          </span>
          <span className="tamil block font-body text-sm text-white/70">{t('weeklyRevisionCta')}</span>
        </span>
        <ChevronRight size={20} className="relative flex-shrink-0 text-white/50" />
      </button>

      {/* Topic / Month segmented toggle */}
      <div className="mb-7 flex justify-center">
        <div className="seg-wrap">
          <button
            className={['seg', view === 'topic_wise' ? 'seg-active' : ''].join(' ')}
            onClick={() => setView('topic_wise')}
          >
            {t('topicWise')}
          </button>
          <button
            className={['seg', view === 'month_wise' ? 'seg-active' : ''].join(' ')}
            onClick={() => setView('month_wise')}
          >
            {t('monthWise')}
          </button>
        </div>
      </div>

      {/* Month-wise cards */}
      {view === 'month_wise' && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-ink2">
            {t('selectMonth')}
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CA_MONTHS.map((m, i) => (
              <button
                key={m.slug}
                onClick={() => handleMonth(m.label)}
                style={{ '--i': i } as React.CSSProperties}
                className="stagger-item flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <CalendarDays size={16} />
                </span>
                <span className="min-w-0 flex-1 font-heading text-sm font-semibold leading-snug text-ink">
                  {m.label}
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-ink2/25" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Topic-wise cards */}
      {view === 'topic_wise' && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-ink2">
            {t('step2Topic')}
          </h3>
          {topicError && (
            <p className="mb-4 text-center font-body text-sm text-coral">{topicError}</p>
          )}
          {loadingTopics ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {topics.map((topic, i) => (
                <button
                  key={topic}
                  onClick={() => handleTopic(topic)}
                  style={{ '--i': i } as React.CSSProperties}
                  className="stagger-item flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Newspaper size={16} />
                  </span>
                  <span className="tamil min-w-0 flex-1 font-heading text-sm font-semibold leading-snug text-ink">
                    {topicName(topic, lang)}
                  </span>
                  <ChevronRight size={16} className="flex-shrink-0 text-ink2/25" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </PickerPage>
  )
}
