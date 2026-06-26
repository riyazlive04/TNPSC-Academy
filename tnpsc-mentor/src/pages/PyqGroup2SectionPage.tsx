import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Layers, Calculator, Brain, ChevronRight, Shuffle } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile, { type Tint } from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { api } from '../lib/api'
import {
  PYQ2_SECTION_SLUGS,
  PYQ2_SECTION_TOPICS,
  PYQ2_YEARS,
  subjectName,
  topicName,
  type Pyq2Section,
} from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'
import type { QuizLabelSeg } from '../types'

// Aptitude is split by aptitude_type (not topic) — the two style rows.
const APT_TYPES: { type: 'numerics' | 'reasoning'; titleKey: StringKey; subKey: StringKey; icon: React.ReactNode; tint: Tint }[] = [
  { type: 'numerics', titleKey: 'numerics', subKey: 'numericsSub', icon: <Calculator size={18} />, tint: 'violet' },
  { type: 'reasoning', titleKey: 'reasoning', subKey: 'reasoningSub', icon: <Brain size={18} />, tint: 'blue' },
]

// Cache counts per (section, year) so flicking between years is instant.
const countsCache = new Map<string, Record<string, number>>()
const cacheKey = (section: Pyq2Section, year: number | null) => `${section}|${year ?? 'all'}`

/**
 * One Group 2 / 2A section (Aptitude / English / Tamil / General Studies). Shows
 * an exam-year filter (All + each year), an "All Questions" shortcut, and the
 * section's sub-types — English/Tamil/GS by topic, Aptitude by Numerics/Reasoning.
 * Every test is scoped category='pyq2', subject=section (+ topic|aptitude_type),
 * and the selected year. Each question still shows its year badge in the test.
 */
export default function PyqGroup2SectionPage() {
  const { section: slug } = useParams<{ section: string }>()
  const navigate = useNavigate()
  const startTest = useStartTest()
  const { t, lang } = useT()

  const section: Pyq2Section | undefined = slug ? PYQ2_SECTION_SLUGS[slug] : undefined
  const isAptitude = section === 'Aptitude'

  const [year, setYear] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(
    section ? countsCache.get(cacheKey(section, null)) ?? null : {}
  )

  // Unknown slug → back to the section list.
  useEffect(() => {
    if (!section) navigate('/test-arena/pyq/group2', { replace: true })
  }, [section, navigate])

  // (Re)load the per-sub-type counts whenever the section or year changes.
  useEffect(() => {
    if (!section) return
    const key = cacheKey(section, year)
    const cached = countsCache.get(key)
    if (cached) {
      setCounts(cached)
      return
    }
    setCounts(null)
    let cancelled = false
    const load = async (): Promise<Record<string, number>> => {
      if (section === 'Aptitude') {
        const pairs = await Promise.all(
          (['numerics', 'reasoning'] as const).map((aptitude_type) =>
            api
              .countQuestions({ category: 'pyq2', subject: 'Aptitude', aptitude_type, year: year ?? undefined })
              .then((n) => [aptitude_type, n] as const)
              .catch(() => [aptitude_type, 0] as const)
          )
        )
        return Object.fromEntries(pairs)
      }
      return api
        .topicCounts({ category: 'pyq2', subject: section, year: year ?? undefined })
        .catch(() => ({}))
    }
    load().then((map) => {
      if (cancelled) return
      countsCache.set(key, map)
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [section, year])

  const allCount = useMemo(
    () => (counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined),
    [counts]
  )

  if (!section) return null

  // Build a reactive label: PYQ · Group 2 · <section> · <sub-type?> · <year?>
  const baseLabel: QuizLabelSeg[] = ['PYQ', 'Group 2', { subject: section }]
  const yearSeg: QuizLabelSeg[] = year ? [String(year)] : []

  const begin = (extra: Record<string, unknown>, labelMid: QuizLabelSeg[], availableCount?: number) =>
    startTest({
      category: 'pyq2',
      subject: section,
      year: year ?? undefined,
      labelParts: [...baseLabel, ...labelMid, ...yearSeg],
      availableCount,
      ...extra,
    })

  const beginAll = () => begin({}, [], allCount)
  const beginTopic = (topic: string) => begin({ topic }, [{ topic }], counts?.[topic])
  const beginType = (aptitude_type: 'numerics' | 'reasoning') =>
    begin({ aptitude_type }, [{ t: aptitude_type as StringKey }], counts?.[aptitude_type])

  // Sub-type rows to render (skip empties for the selected year).
  const topicRows = isAptitude
    ? []
    : PYQ2_SECTION_TOPICS[section as Exclude<Pyq2Section, 'Aptitude'>].filter(
        (tp) => (counts?.[tp] ?? (counts ? 0 : 1)) > 0
      )

  return (
    <PickerPage badge={t('pyq2Badge')}>
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => navigate('/test-arena/pyq/group2')}
          className="inline-flex items-center gap-1 font-heading text-sm font-semibold text-primary transition-opacity hover:opacity-80"
        >
          <ArrowLeft size={16} /> {t('back')}
        </button>
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {subjectName(section, lang)}
        </h2>
      </div>

      {/* Exam-year filter chips. "All Years" + each year; scopes every test below. */}
      <div className="mb-5">
        <p className="tamil mb-2 font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
          {t('filterByYear')}
        </p>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          <YearChip label={t('allYears')} active={year === null} onClick={() => setYear(null)} />
          {PYQ2_YEARS.map((y) => (
            <YearChip key={y} label={String(y)} active={year === y} onClick={() => setYear(y)} />
          ))}
        </div>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* "All Questions" shortcut (whole section, selected year). */}
          <AllHero
            label={t('pyq2AllQuestions')}
            sub={t('pyq2AllQuestionsSub')}
            count={allCount}
            word={t('questionsCount')}
            disabled={(allCount ?? 0) === 0}
            onClick={beginAll}
          />

          {isAptitude ? (
            <List>
              {APT_TYPES.map(({ type, titleKey, subKey, icon, tint }, i) => {
                const n = counts[type] ?? 0
                return (
                  <ListRow
                    key={type}
                    disabled={n === 0}
                    onClick={() => beginType(type)}
                    style={{ '--i': i } as React.CSSProperties}
                    leading={<IconTile tint={tint}>{icon}</IconTile>}
                    title={t(titleKey)}
                    subtitle={t(subKey)}
                    trailing={
                      <span className="flex flex-shrink-0 items-center gap-2">
                        <span className="font-heading text-sm font-semibold text-primary">
                          {n}{' '}
                          <span className="font-body text-xs font-normal text-muted">
                            {t('questionsCount')}
                          </span>
                        </span>
                        <ChevronRight size={18} className="text-muted/40" />
                      </span>
                    }
                  />
                )
              })}
            </List>
          ) : topicRows.length === 0 ? (
            <p className="tamil py-8 text-center font-body text-sm text-muted">
              {t('noQuestions')}
            </p>
          ) : (
            <List>
              {topicRows.map((tp, i) => (
                <ListRow
                  key={tp}
                  onClick={() => beginTopic(tp)}
                  style={{ '--i': i } as React.CSSProperties}
                  leading={
                    <IconTile tint="violet">
                      <Layers size={18} />
                    </IconTile>
                  }
                  title={topicName(tp, lang)}
                  subtitle={
                    counts[tp] != null ? (
                      <span className="flex items-baseline gap-1">
                        <span className="font-heading font-bold tabular-nums text-primary">
                          {counts[tp].toLocaleString()}
                        </span>
                        <span>{t('questionsCount')}</span>
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </List>
          )}
        </div>
      )}
    </PickerPage>
  )
}

function YearChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-full px-3.5 py-1.5 font-heading text-[13px] font-semibold tabular-nums transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-tint-violet text-primary hover:bg-primary/15'
      }`}
    >
      {label}
    </button>
  )
}

// The gradient "All Questions" hero panel (mirrors the PYQ Aptitude page hero).
function AllHero({
  label,
  sub,
  count,
  word,
  onClick,
  disabled = false,
}: {
  label: string
  sub: string
  count?: number
  word: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left disabled:opacity-45"
    >
      <span
        className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
        style={{ backgroundSize: '18px 18px' }}
      />
      <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-tile bg-white/15 text-white ring-1 ring-white/20">
        <Shuffle size={20} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="tamil block font-display text-base font-semibold text-white">{label}</span>
        {count != null && count > 0 ? (
          <span className="block font-body text-xs text-white/70">
            <span className="font-heading font-bold tabular-nums">{count.toLocaleString()}</span>{' '}
            {word}
          </span>
        ) : (
          <span className="tamil block font-body text-xs text-white/70">{sub}</span>
        )}
      </span>
      <ChevronRight size={18} className="relative flex-shrink-0 text-white/50" />
    </button>
  )
}
