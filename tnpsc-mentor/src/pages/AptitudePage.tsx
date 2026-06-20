import { useEffect, useState } from 'react'
import { Loader2, Calculator, Brain, Shuffle, Layers, ChevronRight } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { api } from '../lib/api'
import { topicName } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'

type AptType = 'numerics' | 'reasoning'

const CATEGORIES: { id: AptType; labelKey: StringKey; icon: React.ReactNode }[] = [
  { id: 'numerics', labelKey: 'numerics', icon: <Calculator size={22} /> },
  { id: 'reasoning', labelKey: 'reasoning', icon: <Brain size={22} /> },
]

// Per-topic counts for each sub-category, fetched once and cached module-level so
// re-entering the page is instant. Map: aptitude_type -> { topic -> count }.
let aptCountsCache: Record<AptType, Record<string, number>> | null = null
const sumCounts = (m?: Record<string, number>) =>
  m ? Object.values(m).reduce((s, n) => s + n, 0) : 0

/**
 * Aptitude picker. Step 1 chooses the sub-category (Numerics / Reasoning); step 2
 * lists that sub-category's topics as cards. Picking a topic - or "All Topics" -
 * starts a shuffled test scoped to that selection.
 */
export default function AptitudePage() {
  const startTest = useStartTest()
  const { t, lang } = useT()

  const [type, setType] = useState<AptType | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<Record<AptType, Record<string, number>> | null>(
    aptCountsCache
  )

  // Per-topic counts for both sub-categories, fetched once on mount.
  useEffect(() => {
    if (aptCountsCache) return
    let cancelled = false
    Promise.all(
      CATEGORIES.map((c) =>
        api
          .topicCounts({ category: 'aptitude', aptitude_type: c.id })
          .then((m) => [c.id, m] as const)
          .catch(() => [c.id, {}] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs) as Record<AptType, Record<string, number>>
      aptCountsCache = map
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!type) return
    let cancelled = false
    setLoading(true)
    setError('')
    setTopics([])
    api
      .distinctTopics({ category: 'aptitude', aptitude_type: type })
      .then((tp) => !cancelled && setTopics(tp))
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const begin = (topic: string | null) => {
    if (!type) return
    startTest({
      category: 'aptitude',
      aptitude_type: type,
      aptitude_topic: topic ?? undefined,
      labelParts: [
        { t: 'aptitudeBadge' },
        { t: type === 'numerics' ? 'numerics' : 'reasoning' },
        ...(topic ? [{ topic }] : []),
      ],
    })
  }

  return (
    <PickerPage badge={t('aptitudeBadge')}>
      {/* Step 1 - sub-category */}
      <h3 className="tamil mb-3 font-heading text-sm font-bold uppercase tracking-widest text-muted">
        {t('step1Category')}
      </h3>
      <div className="mb-8 grid grid-cols-2 gap-3">
        {CATEGORIES.map((c) => {
          const active = type === c.id
          const n = sumCounts(counts?.[c.id])
          return (
            <button
              key={c.id}
              onClick={() => setType(c.id)}
              className={[
                'flex items-center gap-3 rounded-card border p-4 text-left transition-colors duration-150',
                active
                  ? 'border-transparent bg-brand-gradient text-white'
                  : 'border-line bg-card text-ink hover:border-primary/40',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile',
                  active ? 'bg-white/15 text-white' : 'bg-tint-violet text-primary',
                ].join(' ')}
              >
                {c.icon}
              </span>
              <span className="min-w-0">
                <span className="tamil block font-display text-sm font-bold">{t(c.labelKey)}</span>
                {n > 0 && (
                  <span
                    className={[
                      'block font-body text-xs',
                      active ? 'text-white/70' : 'text-muted',
                    ].join(' ')}
                  >
                    <span className="font-heading font-bold tabular-nums">{n}</span> {t('questionsCount')}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Step 2 - topic cards */}
      {type && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-3 font-heading text-sm font-bold uppercase tracking-widest text-muted">
            {t('step3Topic')}
          </h3>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          )}
          {!loading && error && (
            <p className="py-8 text-center font-body text-sm text-wrong">{error}</p>
          )}
          {!loading && !error && (
            <div className="space-y-4">
              {/* All Topics - the one highlighted (gradient) shortcut for this step */}
              <button
                onClick={() => begin(null)}
                className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left"
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
                  style={{ backgroundSize: '18px 18px' }}
                />
                <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-white/15 text-white ring-1 ring-white/20">
                  <Shuffle size={20} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-white">
                    {t('allTopics')}
                  </span>
                  {sumCounts(counts?.[type]) > 0 && (
                    <span className="block font-body text-xs text-white/70">
                      <span className="font-heading font-bold tabular-nums">
                        {sumCounts(counts?.[type])}
                      </span>{' '}
                      {t('questionsCount')}
                    </span>
                  )}
                </span>
                <ChevronRight size={18} className="relative flex-shrink-0 text-white/50" />
              </button>

              <List>
                {topics.map((tp, i) => {
                  const n = counts?.[type]?.[tp]
                  return (
                    <ListRow
                      key={tp}
                      onClick={() => begin(tp)}
                      style={{ '--i': i } as React.CSSProperties}
                      leading={
                        <IconTile tint="violet">
                          <Layers size={18} />
                        </IconTile>
                      }
                      title={topicName(tp, lang)}
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
      )}
    </PickerPage>
  )
}
