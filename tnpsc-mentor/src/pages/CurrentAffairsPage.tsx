import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Loader2, RefreshCw, ChevronRight } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { CA_MONTHS, CA_TOPIC_CATEGORIES } from '../lib/constants'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

type CAView = 'month_wise' | 'topic_wise'

export default function CurrentAffairsPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t } = useT()
  const [view, setView] = useState<CAView>('month_wise')

  // Weekly revision — a 20-question mixed current-affairs consolidation drill.
  // Scoped to the whole CA pool (like the daily drill) so it's always playable.
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

  // Topic-wise: distinct ca_topic values from the DB.
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
        const distinct = await api.distinctTopics({
          category: 'current_affairs',
        })
        if (!cancelled) {
          // Fall back to the curated category list if the DB has none yet.
          setTopics(distinct.length ? distinct : CA_TOPIC_CATEGORIES)
        }
      } catch (e) {
        if (!cancelled) {
          setTopicError('Could not load topics from the database. Showing default categories.')
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
  }, [view])

  const handleMonth = (label: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: label,
      label: `Current Affairs · ${label}`,
    })
  }

  const handleTopic = (topic: string) => {
    // Topic-wise pulls CA questions tagged with this `topic` across all months.
    startTest({
      category: 'current_affairs',
      topic,
      label: `Current Affairs · ${topic}`,
    })
  }

  return (
    <PickerPage badge={t('currentAffairsBadge')}>
      {/* Weekly revision — a quick consolidation drill across the CA pool */}
      <button
        onClick={startWeeklyRevision}
        className="group interactive mx-auto mb-8 flex w-full max-w-2xl items-center gap-4 rounded-2xl border border-brand/15 bg-brand-soft p-4 text-left lg:p-5"
      >
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand text-white">
          <RefreshCw size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="tamil block font-heading text-[15px] font-semibold text-ink">
            {t('weeklyRevision')}
          </span>
          <span className="tamil block font-body text-sm text-ink2">
            {t('weeklyRevisionCta')}
          </span>
        </span>
        <ChevronRight
          size={20}
          className="flex-shrink-0 text-brand/40 transition group-hover:text-brand"
        />
      </button>

      {/* Sub-category pills */}
      <div className="mb-8 flex justify-center gap-3">
        <PillButton active={view === 'topic_wise'} onClick={() => setView('topic_wise')}>
          {t('topicWise').toUpperCase()}
        </PillButton>
        <PillButton active={view === 'month_wise'} onClick={() => setView('month_wise')}>
          {t('monthWise').toUpperCase()}
        </PillButton>
      </div>

      {view === 'month_wise' && (
        <PillSection
          title={`${t('selectMonth')} (July 2025 → June 2026)`}
          className="animate-fadeIn"
        >
          {CA_MONTHS.map((m) => (
            <PillButton key={m.slug} size="sm" onClick={() => handleMonth(m.label)}>
              {m.label}
            </PillButton>
          ))}
        </PillSection>
      )}

      {view === 'topic_wise' && (
        <section className="animate-fadeIn">
          <div className="mx-auto mb-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-line bg-brand-soft px-4 py-3">
            <Info size={18} className="mt-0.5 flex-shrink-0 text-brand" />
            <p className="font-body text-sm text-ink2">
              Topic-wise practice pulls current-affairs questions by theme across
              all months. The topics below reflect what is currently available in
              the database.
            </p>
          </div>

          {topicError && (
            <p className="mb-4 text-center font-body text-sm text-coral">{topicError}</p>
          )}

          {loadingTopics ? (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {topics.map((topic) => (
                <PillButton key={topic} size="sm" onClick={() => handleTopic(topic)}>
                  {topic.toUpperCase()}
                </PillButton>
              ))}
            </div>
          )}
        </section>
      )}
    </PickerPage>
  )
}
