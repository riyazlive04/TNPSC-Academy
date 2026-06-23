import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, ChevronRight, Newspaper, CalendarDays, ArrowLeft, Shuffle } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { CA_MONTHS, CA_TOPIC_CATEGORIES, topicName } from '../lib/constants'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'
import type { QuizConfig } from '../types'

type CAView = 'month_wise' | 'topic_wise'

// Module-level caches so the counts survive navigating away and back.
let monthCountsCache: Record<string, number> | null = null
let topicCountsCache: Record<string, number> | null = null

export default function CurrentAffairsPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const [view, setView] = useState<CAView>('month_wise')

  // Per-month / per-topic question counts shown on every row.
  const [monthCounts, setMonthCounts] = useState<Record<string, number> | null>(monthCountsCache)
  const [topicCounts, setTopicCounts] = useState<Record<string, number> | null>(topicCountsCache)

  // Month counts: one HEAD count per month (mirrors the PYQ subject pattern).
  useEffect(() => {
    if (monthCountsCache) return
    let cancelled = false
    Promise.all(
      CA_MONTHS.map((m) =>
        api
          .countQuestions({ category: 'current_affairs', ca_type: 'month_wise', ca_month: m.label })
          .then((n) => [m.label, n] as const)
          .catch(() => [m.label, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      monthCountsCache = map
      setMonthCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Topic counts: a single grouped call across the CA bank.
  useEffect(() => {
    if (topicCountsCache) return
    let cancelled = false
    api
      .topicCounts({ category: 'current_affairs' })
      .then((m) => {
        if (cancelled) return
        topicCountsCache = m
        setTopicCounts(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  // Month drill-in: selecting a month opens a sub-step where the user picks
  // "All topics" or one specific topic within that month.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [monthTopicCounts, setMonthTopicCounts] = useState<Record<string, number> | null>(null)
  const [loadingMonthTopics, setLoadingMonthTopics] = useState(false)

  useEffect(() => {
    if (!selectedMonth) return
    let cancelled = false
    setMonthTopicCounts(null)
    setLoadingMonthTopics(true)
    api
      .topicCounts({ category: 'current_affairs', ca_month: selectedMonth })
      .then((m) => {
        if (!cancelled) setMonthTopicCounts(m)
      })
      .catch(() => {
        if (!cancelled) setMonthTopicCounts({})
      })
      .finally(() => {
        if (!cancelled) setLoadingMonthTopics(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  // Tapping a month opens its topic sub-step rather than starting the test.
  const handleMonth = (label: string) => setSelectedMonth(label)

  // Total questions in the selected month (for the "All Topics" hero count).
  const monthTotal = selectedMonth
    ? monthCounts?.[selectedMonth] ??
      (monthTopicCounts ? Object.values(monthTopicCounts).reduce((a, b) => a + b, 0) : undefined)
    : undefined

  // "All topics" for the month - the original whole-month behaviour. Pass the
  // already-known count as availableCount so the instructions slider shows it
  // instantly (no /count round-trip), like Subject Practice does.
  const startMonthAll = (label: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: label,
      availableCount: monthTotal,
      labelParts: [{ t: 'currentAffairsBadge' }, label],
    })
  }

  // A specific topic within the month (filters on both ca_month and topic).
  const startMonthTopic = (label: string, topic: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: label,
      topic,
      availableCount: monthTopicCounts?.[topic],
      labelParts: [{ t: 'currentAffairsBadge' }, label, { topic }],
    })
  }

  const handleTopic = (topic: string) => {
    startTest({
      category: 'current_affairs',
      topic,
      availableCount: topicCounts?.[topic],
      labelParts: [{ t: 'currentAffairsBadge' }, { topic }],
    })
  }

  return (
    <PickerPage badge={t('currentAffairsBadge')}>
      {selectedMonth ? (
        /* Month detail - choose All Topics or a specific topic within the month */
        <section className="animate-fadeIn">
          <button
            onClick={() => setSelectedMonth(null)}
            className="focus-ring -ml-1 mb-4 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-heading text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} />
            {selectedMonth}
          </button>
          <h3 className="tamil mb-2 font-heading text-sm font-bold uppercase tracking-widest text-muted">
            {t('selectTopic')}
          </h3>
          {loadingMonthTopics ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* All topics - the highlighted shortcut (matches other sections) */}
              <button
                onClick={() => startMonthAll(selectedMonth)}
                className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left"
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
                  style={{ backgroundSize: '18px 18px' }}
                />
                <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                  <Shuffle size={20} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block font-heading text-base font-semibold text-white">
                    {t('allTopics')}
                  </span>
                  <span className="tamil block font-body text-xs text-white/70">
                    {t('allTopicsSub')}
                    {monthTotal != null && monthTotal > 0 && (
                      <>
                        {' · '}
                        <span className="font-heading font-semibold tabular-nums text-white/90">
                          {monthTotal.toLocaleString()}
                        </span>{' '}
                        {t('questionsCount')}
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="relative flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
                />
              </button>

              {/* Specific topics in this month */}
              <List>
                {Object.keys(monthTopicCounts ?? {})
                  .sort()
                  .map((topic, i) => {
                    const n = monthTopicCounts?.[topic]
                    return (
                      <ListRow
                        key={topic}
                        onClick={() => startMonthTopic(selectedMonth, topic)}
                        style={{ '--i': i } as React.CSSProperties}
                        leading={
                          <IconTile tint="green">
                            <Newspaper size={18} />
                          </IconTile>
                        }
                        title={topicName(topic, lang)}
                        subtitle={
                          n != null ? (
                            <span className="flex items-baseline gap-1">
                              <span className="font-heading font-bold tabular-nums text-primary">
                                {n.toLocaleString()}
                              </span>
                              <span>{t('questionsCount')}</span>
                            </span>
                          ) : undefined
                        }
                      />
                    )
                  })}
              </List>
            </div>
          )}
        </section>
      ) : (
      <>
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
            {CA_MONTHS.map((m, i) => {
              const n = monthCounts?.[m.label]
              return (
                <ListRow
                  key={m.slug}
                  disabled={n === 0}
                  onClick={() => handleMonth(m.label)}
                  style={{ '--i': i } as React.CSSProperties}
                  leading={
                    <IconTile tint="green">
                      <CalendarDays size={18} />
                    </IconTile>
                  }
                  title={m.label}
                  subtitle={
                    n != null ? (
                      <span className="flex items-baseline gap-1">
                        <span className="font-heading font-bold tabular-nums text-primary">
                          {n.toLocaleString()}
                        </span>
                        <span>{t('questionsCount')}</span>
                      </span>
                    ) : undefined
                  }
                />
              )
            })}
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
              {topics.map((topic, i) => {
                const n = topicCounts?.[topic]
                return (
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
                    subtitle={
                      n != null ? (
                        <span className="flex items-baseline gap-1">
                          <span className="font-heading font-bold tabular-nums text-primary">
                            {n.toLocaleString()}
                          </span>
                          <span>{t('questionsCount')}</span>
                        </span>
                      ) : undefined
                    }
                  />
                )
              })}
            </List>
          )}
        </section>
      )}
      </>
      )}
    </PickerPage>
  )
}
