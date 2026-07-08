import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Brain,
  Shuffle,
  Layers,
  Shapes,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import {
  topicName,
  AREA_VOLUME_GROUP,
  AV_SECTIONS,
  AV_SECTION_SHAPES,
  isAreaVolumeSection,
  type AvSection,
} from '../lib/constants'
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
// Per-shape counts within an Area-and-Volume section (count keyed by `unit`),
// fetched lazily on first drill-in and cached by section name.
const shapeCountsCache = new Map<AvSection, Record<string, number>>()

const sumCounts = (m?: Record<string, number>) =>
  m ? Object.values(m).reduce((s, n) => s + n, 0) : 0

/**
 * Aptitude picker. Step 1 chooses the sub-category (Numerics / Reasoning); step 2
 * lists that sub-category's topics. Picking a topic - or "All Topics" - starts a
 * shuffled test. The one exception is "Area and Volume" (Numerics): it expands
 * into three SECTIONS (Perimeter / 2D / 3D), each of which expands into SHAPES
 * (Circle, Square, Sphere…). A section is the `aptitude_topic`; a shape is the
 * question's `unit`, so the final test is scoped by both.
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

  // Area-and-Volume drill state: `avOpen` = inside the group (showing sections);
  // `avSection` set = showing that section's shapes. Both reset on type change.
  const [avOpen, setAvOpen] = useState(false)
  const [avSection, setAvSection] = useState<AvSection | null>(null)
  const [shapeCounts, setShapeCounts] = useState<Record<string, number>>({})

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

  const chooseType = (id: AptType) => {
    setType(id)
    setAvOpen(false)
    setAvSection(null)
  }

  // Drilling into a section fetches that section's per-shape counts (one count
  // call per shape, cached by section so re-entering is instant).
  const openSection = (section: AvSection) => {
    setAvSection(section)
    const cached = shapeCountsCache.get(section)
    if (cached) {
      setShapeCounts(cached)
      return
    }
    setShapeCounts({})
    const shapes = AV_SECTION_SHAPES[section]
    Promise.all(
      shapes.map((shape) =>
        api
          .countQuestions({
            category: 'aptitude',
            aptitude_type: 'numerics',
            aptitude_topic: section,
            unit: shape,
          })
          .then((n) => [shape, n] as const)
          .catch(() => [shape, 0] as const)
      )
    ).then((pairs) => {
      const m = Object.fromEntries(pairs)
      shapeCountsCache.set(section, m)
      setShapeCounts(m)
    })
  }

  // ─── Test starters ──────────────────────────────────────────────────────────
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
  const beginSection = (section: AvSection) =>
    startTest({
      category: 'aptitude',
      aptitude_type: 'numerics',
      aptitude_topic: section,
      labelParts: [{ t: 'aptitudeBadge' }, { t: 'numerics' }, { topic: section }],
    })
  const beginShape = (section: AvSection, shape: string) =>
    startTest({
      category: 'aptitude',
      aptitude_type: 'numerics',
      aptitude_topic: section,
      unit: shape,
      labelParts: [{ t: 'aptitudeBadge' }, { t: 'numerics' }, { topic: section }, { topic: shape }],
    })

  // ─── Topic-level rows (Area and Volume collapsed into one expandable row) ─────
  type Row = { kind: 'group' } | { kind: 'topic'; topic: string }
  const rows = useMemo<Row[]>(() => {
    if (type !== 'numerics') return topics.map((topic) => ({ kind: 'topic', topic }))
    const out: Row[] = []
    let groupShown = false
    for (const tp of topics) {
      if (isAreaVolumeSection(tp)) {
        if (!groupShown) {
          out.push({ kind: 'group' })
          groupShown = true
        }
      } else {
        out.push({ kind: 'topic', topic: tp })
      }
    }
    return out
  }, [topics, type])

  // Area-and-Volume group total = sum of its three sections' counts.
  const avGroupTotal = useMemo(
    () => AV_SECTIONS.reduce((s, sec) => s + (counts?.numerics?.[sec] ?? 0), 0),
    [counts]
  )

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
              onClick={() => chooseType(c.id)}
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
                    <span className="font-heading font-bold tabular-nums">{n}</span>{' '}
                    {t('questionsCount')}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Step 2 - topics (with the Area and Volume → sections → shapes drill-down) */}
      {type && (
        <section className="animate-fadeIn">
          <h3 className="tamil mb-3 flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-widest text-muted">
            {avOpen && (
              <button
                onClick={() => (avSection ? setAvSection(null) : setAvOpen(false))}
                className="inline-flex items-center gap-1 normal-case tracking-normal text-primary transition-opacity hover:opacity-80"
              >
                <ArrowLeft size={14} /> {t('back')}
              </button>
            )}
            <span className={avOpen ? 'text-ink' : ''}>
              {avSection
                ? topicName(avSection, lang)
                : avOpen
                  ? topicName(AREA_VOLUME_GROUP, lang)
                  : t('step3Topic')}
            </span>
          </h3>

          {loading && (
            <div className="flex justify-center py-12">
              <LogoLoader size={56} />
            </div>
          )}
          {!loading && error && (
            <p className="py-8 text-center font-body text-sm text-wrong">{error}</p>
          )}

          {/* Level 2 - shapes within a section */}
          {!loading && !error && avOpen && avSection && (
            <div className="space-y-4">
              <AllShortcut
                label={t('allTopics')}
                count={counts?.numerics?.[avSection]}
                questionsWord={t('questionsCount')}
                onClick={() => beginSection(avSection)}
              />
              <List>
                {AV_SECTION_SHAPES[avSection].map((shape, i) => {
                  const n = shapeCounts[shape]
                  return (
                    <ListRow
                      key={shape}
                      onClick={() => beginShape(avSection, shape)}
                      style={{ '--i': i } as React.CSSProperties}
                      leading={
                        <IconTile tint="violet">
                          <Shapes size={18} />
                        </IconTile>
                      }
                      title={topicName(shape, lang)}
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

          {/* Level 1 - the three Area and Volume sections */}
          {!loading && !error && avOpen && !avSection && (
            <List>
              {AV_SECTIONS.map((section, i) => {
                const n = counts?.numerics?.[section]
                return (
                  <ListRow
                    key={section}
                    onClick={() => openSection(section)}
                    style={{ '--i': i } as React.CSSProperties}
                    leading={
                      <IconTile tint="violet">
                        <Layers size={18} />
                      </IconTile>
                    }
                    title={topicName(section, lang)}
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
                    trailing={<ChevronRight size={18} className="flex-shrink-0 text-muted/40" />}
                  />
                )
              })}
            </List>
          )}

          {/* Level 0 - the topic list */}
          {!loading && !error && !avOpen && (
            <div className="space-y-4">
              {/* All Topics - the highlighted (gradient) shortcut for this step */}
              <AllShortcut
                label={t('allTopics')}
                count={sumCounts(counts?.[type])}
                questionsWord={t('questionsCount')}
                onClick={() => begin(null)}
                hero
              />

              <List>
                {rows.map((row, i) =>
                  row.kind === 'group' ? (
                    <ListRow
                      key="__av__"
                      onClick={() => setAvOpen(true)}
                      style={{ '--i': i } as React.CSSProperties}
                      leading={
                        <IconTile tint="violet">
                          <Shapes size={18} />
                        </IconTile>
                      }
                      title={topicName(AREA_VOLUME_GROUP, lang)}
                      subtitle={
                        avGroupTotal > 0 ? (
                          <span className="flex items-baseline gap-1">
                            <span className="font-heading font-bold tabular-nums text-primary">
                              {avGroupTotal.toLocaleString()}
                            </span>
                            <span>{t('questionsCount')}</span>
                          </span>
                        ) : undefined
                      }
                      trailing={
                        <ChevronRight size={18} className="flex-shrink-0 text-muted/40" />
                      }
                    />
                  ) : (
                    <ListRow
                      key={row.topic}
                      onClick={() => begin(row.topic)}
                      style={{ '--i': i } as React.CSSProperties}
                      leading={
                        <IconTile tint="violet">
                          <Layers size={18} />
                        </IconTile>
                      }
                      title={topicName(row.topic, lang)}
                      subtitle={
                        counts?.[type]?.[row.topic] != null ? (
                          <span className="flex items-baseline gap-1">
                            <span className="font-heading font-bold tabular-nums text-primary">
                              {counts[type][row.topic].toLocaleString()}
                            </span>
                            <span>{t('questionsCount')}</span>
                          </span>
                        ) : undefined
                      }
                    />
                  )
                )}
              </List>
            </div>
          )}
        </section>
      )}
    </PickerPage>
  )
}

// "All …" shortcut row. `hero` renders the gradient hero panel (used at the
// topic level); otherwise a plain highlighted card (used at the shape level).
function AllShortcut({
  label,
  count,
  questionsWord,
  onClick,
  hero = false,
}: {
  label: string
  count?: number
  questionsWord: string
  onClick: () => void
  hero?: boolean
}) {
  if (!hero) {
    return (
      <button
        onClick={onClick}
        className="interactive group flex w-full items-center gap-4 rounded-card border border-primary/30 bg-tint-violet p-4 text-left"
      >
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-primary/15 text-primary">
          <Shuffle size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-ink">{label}</span>
          {count != null && count > 0 && (
            <span className="block font-body text-xs text-muted">
              <span className="font-heading font-bold tabular-nums text-primary">
                {count.toLocaleString()}
              </span>{' '}
              {questionsWord}
            </span>
          )}
        </span>
        <ChevronRight size={18} className="flex-shrink-0 text-muted/40" />
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
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
        <span className="block font-display text-base font-semibold text-white">{label}</span>
        {count != null && count > 0 && (
          <span className="block font-body text-xs text-white/70">
            <span className="font-heading font-bold tabular-nums">{count.toLocaleString()}</span>{' '}
            {questionsWord}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="relative flex-shrink-0 text-white/50" />
    </button>
  )
}
