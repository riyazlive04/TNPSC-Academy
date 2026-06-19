import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, ChevronRight, Newspaper, CalendarDays } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
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
      labelParts: [{ t: 'currentAffairsBadge' }, label],
    })
  }

  const handleTopic = (topic: string) => {
    startTest({
      category: 'current_affairs',
      topic,
      labelParts: [{ t: 'currentAffairsBadge' }, { topic }],
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

      {/* Month-wise list */}
      {view === 'month_wise' && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-2 font-heading text-sm font-bold uppercase tracking-widest text-muted">
            {t('selectMonth')}
          </h3>
          <List>
            {CA_MONTHS.map((m, i) => (
              <ListRow
                key={m.slug}
                onClick={() => handleMonth(m.label)}
                style={{ '--i': i } as React.CSSProperties}
                leading={
                  <IconTile tint="green">
                    <CalendarDays size={18} />
                  </IconTile>
                }
                title={m.label}
              />
            ))}
          </List>
        </section>
      )}

      {/* Topic-wise list */}
      {view === 'topic_wise' && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-2 font-heading text-sm font-bold uppercase tracking-widest text-muted">
            {t('step2Topic')}
          </h3>
          {topicError && (
            <p className="mb-4 text-center font-body text-sm text-wrong">{topicError}</p>
          )}
          {loadingTopics ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <List>
              {topics.map((topic, i) => (
                <ListRow
                  key={topic}
                  onClick={() => handleTopic(topic)}
                  style={{ '--i': i } as React.CSSProperties}
                  leading={
                    <IconTile tint="green">
                      <Newspaper size={18} />
                    </IconTile>
                  }
                  title={topicName(topic, lang)}
                />
              ))}
            </List>
          )}
        </section>
      )}
    </PickerPage>
  )
}
