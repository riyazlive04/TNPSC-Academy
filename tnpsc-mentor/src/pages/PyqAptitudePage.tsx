import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Brain,
  ChevronRight,
  Layers,
  Shapes,
  Shuffle,
  ArrowLeft,
} from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { type Tint } from '../components/UI/IconTile'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import LogoLoader from '../components/UI/LogoLoader'
import { iconFor } from '../lib/subjectIcons'
import { api } from '../lib/api'
import {
  topicName,
  AREA_VOLUME_GROUP,
  AV_SECTIONS,
  AV_SECTION_SHAPES,
  APT_NUMERICS_DB_TOPICS,
  APT_REASONING_DB_TOPICS,
  isAreaVolumeSection,
  type AvSection,
} from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'

// The PYQ Aptitude subject as stored in the DB; rows carry the standard
// aptitude_type ('numerics' | 'reasoning') and now the same canonical
// aptitude_topic taxonomy as the practice bank (Area-and-Volume sections in
// aptitude_topic, shape in `unit`).
const APTITUDE_SUBJECT = 'Aptitude'
type AptType = 'numerics' | 'reasoning'

const TYPES: { type: AptType; titleKey: StringKey; subKey: StringKey; icon: React.ReactNode; tint: Tint }[] = [
  { type: 'numerics', titleKey: 'numerics', subKey: 'numericsSub', icon: <Calculator size={19} />, tint: 'violet' },
  { type: 'reasoning', titleKey: 'reasoning', subKey: 'reasoningSub', icon: <Brain size={19} />, tint: 'blue' },
]

const REASONING_SET = new Set(APT_REASONING_DB_TOPICS)
const AV_SET = new Set<string>(AV_SECTIONS)
// Which type a topic-count key belongs to. Area-and-Volume sections are numerics.
const typeOf = (topic: string): AptType =>
  AV_SET.has(topic) ? 'numerics' : REASONING_SET.has(topic) ? 'reasoning' : 'numerics'

// Cache the single per-topic counts call and per-section shape counts, module
// level so re-entering the page is instant.
let countsCache: Record<string, number> | null = null
const shapeCountsCache = new Map<AvSection, Record<string, number>>()

/**
 * PYQ Aptitude picker. Mirrors the practice Aptitude flow: pick a style
 * (Numerics / Reasoning), then a topic. "Area and Volume" expands into its three
 * sections and then into shapes (Circle, Sphere…). An "All …" shortcut keeps the
 * original behaviour of testing the whole style at once. Every test is scoped
 * with category='pyq', subject='Aptitude'.
 */
export default function PyqAptitudePage() {
  const startTest = useStartTest()
  const { t, lang } = useT()

  const [counts, setCounts] = useState<Record<string, number> | null>(countsCache)
  const [type, setType] = useState<AptType | null>(null)
  const [avOpen, setAvOpen] = useState(false)
  const [avSection, setAvSection] = useState<AvSection | null>(null)
  const [shapeCounts, setShapeCounts] = useState<Record<string, number>>({})

  // One call returns every PYQ-aptitude topic count (keyed by aptitude_topic).
  useEffect(() => {
    if (countsCache) return
    let cancelled = false
    api
      .topicCounts({ category: 'pyq', subject: APTITUDE_SUBJECT })
      .then((c) => {
        if (cancelled) return
        countsCache = c
        setCounts(c)
      })
      .catch(() => !cancelled && setCounts({}))
    return () => {
      cancelled = true
    }
  }, [])

  const typeTotal = (ty: AptType) =>
    counts
      ? Object.entries(counts).reduce((s, [k, n]) => (typeOf(k) === ty ? s + n : s), 0)
      : 0
  const avTotal = useMemo(
    () => AV_SECTIONS.reduce((s, sec) => s + (counts?.[sec] ?? 0), 0),
    [counts]
  )

  const chooseType = (ty: AptType) => {
    setType(ty)
    setAvOpen(false)
    setAvSection(null)
  }

  const openSection = (section: AvSection) => {
    setAvSection(section)
    const cached = shapeCountsCache.get(section)
    if (cached) {
      setShapeCounts(cached)
      return
    }
    setShapeCounts({})
    Promise.all(
      AV_SECTION_SHAPES[section].map((shape) =>
        api
          .countQuestions({
            category: 'pyq',
            subject: APTITUDE_SUBJECT,
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

  // ─── Test starters (all scoped to PYQ → Aptitude) ────────────────────────────
  const base = (extra: Record<string, unknown>) =>
    startTest({ category: 'pyq', subject: APTITUDE_SUBJECT, ...extra } as Parameters<typeof startTest>[0])
  const beginAll = (ty: AptType) =>
    base({ aptitude_type: ty, labelParts: ['PYQ', { subject: APTITUDE_SUBJECT }, { t: ty }] })
  const beginTopic = (topic: string) =>
    base({
      aptitude_type: type!,
      aptitude_topic: topic,
      labelParts: ['PYQ', { subject: APTITUDE_SUBJECT }, { t: type! }, { topic }],
    })
  const beginSection = (section: AvSection) =>
    base({
      aptitude_type: 'numerics',
      aptitude_topic: section,
      labelParts: ['PYQ', { subject: APTITUDE_SUBJECT }, { t: 'numerics' }, { topic: section }],
    })
  const beginShape = (section: AvSection, shape: string) =>
    base({
      aptitude_type: 'numerics',
      aptitude_topic: section,
      unit: shape,
      labelParts: [
        'PYQ',
        { subject: APTITUDE_SUBJECT },
        { t: 'numerics' },
        { topic: section },
        { topic: shape },
      ],
    })

  // Topics to show for the chosen type: the canonical order, minus empties.
  // Area-and-Volume is shown as one drill row (using its summed count).
  const topicRows = useMemo<string[]>(() => {
    if (!type || !counts) return []
    const order = type === 'numerics' ? APT_NUMERICS_DB_TOPICS : APT_REASONING_DB_TOPICS
    return order.filter((tp) =>
      tp === AREA_VOLUME_GROUP ? avTotal > 0 : (counts[tp] ?? 0) > 0
    )
  }, [type, counts, avTotal])

  const heading = avSection
    ? topicName(avSection, lang)
    : avOpen
      ? topicName(AREA_VOLUME_GROUP, lang)
      : type
        ? t('pyqAptitudePickTopic')
        : t('pyqAptitudePickType')

  return (
    <PickerPage badge={t('pyqAptitudeBadge')} backTo="/test-arena/pyq/group1">
      <div className="mb-5 flex items-center gap-2">
        {(type || avOpen) && (
          <button
            onClick={() => {
              if (avSection) return setAvSection(null)
              if (avOpen) return setAvOpen(false)
              setType(null)
            }}
            className="inline-flex items-center gap-1 font-heading text-sm font-semibold text-primary transition-opacity hover:opacity-80"
          >
            <ArrowLeft size={16} /> {t('back')}
          </button>
        )}
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">{heading}</h2>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-10">
          <LogoLoader size={56} />
        </div>
      ) : !type ? (
        // ── Step 1: style (Numerics / Reasoning) ──
        <ChoiceGrid>
          {TYPES.map(({ type: ty, titleKey, subKey, icon, tint }, i) => {
            const n = typeTotal(ty)
            return (
              <ChoiceCard
                key={ty}
                index={i}
                disabled={n === 0}
                onClick={() => chooseType(ty)}
                icon={iconFor(ty) ?? icon}
                tint={tint}
                title={t(titleKey)}
                subtitle={
                  <>
                    {t(subKey)}
                    {n > 0 && (
                      <>
                        {' · '}
                        <span className="font-heading font-bold tabular-nums text-primary">{n}</span>{' '}
                        {t('questionsCount')}
                      </>
                    )}
                  </>
                }
              />
            )
          })}
        </ChoiceGrid>
      ) : avOpen && avSection ? (
        // ── Shapes within a section ──
        <div className="space-y-4">
          <Hero label={t('allTopics')} count={counts[avSection]} word={t('questionsCount')} onClick={() => beginSection(avSection)} />
          <ChoiceGrid>
            {AV_SECTION_SHAPES[avSection].map((shape, i) => (
              <ChoiceCard
                key={shape}
                index={i}
                disabled={(shapeCounts[shape] ?? -1) === 0}
                onClick={() => beginShape(avSection, shape)}
                icon={iconFor(shape) ?? <Shapes />}
                title={topicName(shape, lang)}
                count={shapeCounts[shape]}
                countLabel={t('questionsCount')}
              />
            ))}
          </ChoiceGrid>
        </div>
      ) : avOpen ? (
        // ── The three Area-and-Volume sections ──
        <ChoiceGrid>
          {AV_SECTIONS.filter((sec) => (counts[sec] ?? 0) > 0).map((section, i) => (
            <ChoiceCard
              key={section}
              index={i}
              onClick={() => openSection(section)}
              icon={iconFor(section) ?? <Layers />}
              title={topicName(section, lang)}
              count={counts[section]}
              countLabel={t('questionsCount')}
            />
          ))}
        </ChoiceGrid>
      ) : (
        // ── Step 2: topics for the chosen style ──
        <div className="space-y-4">
          <Hero hero label={t('allTopics')} count={typeTotal(type)} word={t('questionsCount')} onClick={() => beginAll(type)} />
          <ChoiceGrid>
            {topicRows.map((tp, i) =>
              isAreaVolumeSection(tp) || tp === AREA_VOLUME_GROUP ? (
                <ChoiceCard
                  key="__av__"
                  index={i}
                  onClick={() => setAvOpen(true)}
                  icon={iconFor(AREA_VOLUME_GROUP) ?? <Shapes />}
                  title={topicName(AREA_VOLUME_GROUP, lang)}
                  count={avTotal}
                  countLabel={t('questionsCount')}
                />
              ) : (
                <ChoiceCard
                  key={tp}
                  index={i}
                  onClick={() => beginTopic(tp)}
                  icon={iconFor(tp) ?? <Layers />}
                  title={topicName(tp, lang)}
                  count={counts[tp]}
                  countLabel={t('questionsCount')}
                />
              )
            )}
          </ChoiceGrid>
        </div>
      )}
    </PickerPage>
  )
}

// "All …" shortcut. `hero` = gradient hero panel (style level); otherwise a
// plain highlighted card (section "All shapes" level).
function Hero({
  label,
  count,
  word,
  onClick,
  hero = false,
}: {
  label: string
  count?: number
  word: string
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
              {word}
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
            {word}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="relative flex-shrink-0 text-white/50" />
    </button>
  )
}
