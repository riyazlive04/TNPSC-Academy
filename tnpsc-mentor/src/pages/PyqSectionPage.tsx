import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Layers, Calculator, Brain, ChevronRight, Shuffle, Lock } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile, { type Tint } from '../components/UI/IconTile'
import VettriCard from '../components/UI/VettriCard'
import { List, ListRow } from '../components/UI/ListRow'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import { deriveGateKey, type GateConfigLike } from '../lib/freeGate'
import {
  PYQ_GROUPS,
  isPyqGroupKey,
  pyqSectionFromSlug,
  subjectName,
  topicName,
  type PyqGroupDef,
  type PyqSection,
} from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'
import type { QuizLabelSeg } from '../types'

// Aptitude is split by aptitude_type (not topic) — the two style rows.
const APT_TYPES: { type: 'numerics' | 'reasoning'; titleKey: StringKey; subKey: StringKey; icon: React.ReactNode; tint: Tint }[] = [
  { type: 'numerics', titleKey: 'numerics', subKey: 'numericsSub', icon: <Calculator size={18} />, tint: 'violet' },
  { type: 'reasoning', titleKey: 'reasoning', subKey: 'reasoningSub', icon: <Brain size={18} />, tint: 'blue' },
]

// Cache counts per (group, section, year) so flicking between years is instant.
const countsCache = new Map<string, Record<string, number>>()
const cacheKey = (g: PyqGroupDef, section: PyqSection, year: number | null) =>
  `${g.key}|${section}|${year ?? 'all'}`

/**
 * One section of a section-wise PYQ group (see PYQ_GROUPS) — Group 2 / 2A or
 * Group 4 / VAO. Shows an exam-year filter (All + each year), an "All Questions"
 * shortcut, and the section's sub-types: English/Tamil/GS by topic, Aptitude by
 * Numerics/Reasoning. Every test is scoped category=<group>, subject=section
 * (+ topic|aptitude_type) and the selected year. Each question still shows its
 * year badge in the test.
 */
export default function PyqSectionPage() {
  const { group: groupSlug, section: slug } = useParams<{ group: string; section: string }>()
  const navigate = useNavigate()
  const startTest = useStartTest()
  const { t, lang } = useT()

  const group = isPyqGroupKey(groupSlug) ? PYQ_GROUPS[groupSlug] : undefined
  const section = group && slug ? pyqSectionFromSlug(group, slug) : undefined
  const isAptitude = section === 'Aptitude'

  const [year, setYear] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(
    group && section ? countsCache.get(cacheKey(group, section, null)) ?? null : {}
  )

  // Free-tier gate: one test per sub-type. `unlimited` (premium/vettri) has no
  // locks; otherwise `usedKeys` lists the sub-type keys already spent.
  const [unlimited, setUnlimited] = useState(true)
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set())
  const [showUpsell, setShowUpsell] = useState(false)

  // Unknown group → the chooser; unknown section → that group's section list.
  useEffect(() => {
    if (!group) navigate('/test-arena/pyq', { replace: true })
    else if (!section) navigate(`/test-arena/pyq/${group.key}`, { replace: true })
  }, [group, section, navigate])

  // Lock state (which sub-types have used their one free test).
  useEffect(() => {
    let cancelled = false
    api
      .topicAccess()
      .then((a) => {
        if (cancelled) return
        setUnlimited(a.unlimited)
        setUsedKeys(new Set(a.usedKeys))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // (Re)load the per-sub-type counts whenever the group, section or year changes.
  useEffect(() => {
    if (!group || !section) return
    const key = cacheKey(group, section, year)
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
              .countQuestions({
                category: group.category,
                subject: 'Aptitude',
                aptitude_type,
                year: year ?? undefined,
              })
              .then((n) => [aptitude_type, n] as const)
              .catch(() => [aptitude_type, 0] as const)
          )
        )
        return Object.fromEntries(pairs)
      }
      return api
        .topicCounts({ category: group.category, subject: section, year: year ?? undefined })
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
  }, [group, section, year])

  const allCount = useMemo(
    () => (counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined),
    [counts]
  )

  if (!group || !section) return null

  // Build a reactive label: PYQ · <group> · <section> · <sub-type?> · <year?>
  const baseLabel: QuizLabelSeg[] = ['PYQ', group.label, { subject: section }]
  const yearSeg: QuizLabelSeg[] = year ? [String(year)] : []

  // Gate helpers. The key ignores year (a sub-type across years = one topic).
  const gateCfg = (extra: Record<string, unknown>): GateConfigLike => ({
    category: group.category,
    subject: section,
    ...(extra as Partial<GateConfigLike>),
  })
  const keyLocked = (extra: Record<string, unknown>): boolean => {
    if (unlimited) return false
    const key = deriveGateKey(gateCfg(extra))
    return key ? usedKeys.has(key) : false
  }

  const begin = (extra: Record<string, unknown>, labelMid: QuizLabelSeg[], availableCount?: number) => {
    // A sub-type whose free test is spent diverts to the upsell instead of starting.
    if (keyLocked(extra)) {
      setShowUpsell(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    startTest({
      category: group.category,
      subject: section,
      year: year ?? undefined,
      labelParts: [...baseLabel, ...labelMid, ...yearSeg],
      availableCount,
      ...extra,
    })
  }

  const beginAll = () => begin({}, [], allCount)
  const beginTopic = (topic: string) => begin({ topic }, [{ topic }], counts?.[topic])
  const beginType = (aptitude_type: 'numerics' | 'reasoning') =>
    begin({ aptitude_type }, [{ t: aptitude_type as StringKey }], counts?.[aptitude_type])

  // Sub-type rows to render (skip empties for the selected year).
  const topicRows = isAptitude
    ? []
    : (group.sectionTopics[section as Exclude<PyqSection, 'Aptitude'>] ?? []).filter(
        (tp) => (counts?.[tp] ?? (counts ? 0 : 1)) > 0
      )

  return (
    <PickerPage badge={t(group.i18n.badge)}>
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => navigate(`/test-arena/pyq/${group.key}`)}
          className="inline-flex items-center gap-1 font-heading text-sm font-semibold text-primary transition-opacity hover:opacity-80"
        >
          <ArrowLeft size={16} /> {t('back')}
        </button>
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {subjectName(section, lang)}
        </h2>
      </div>

      {showUpsell && (
        <div className="mb-5 animate-fadeInFast">
          <p className="tamil mb-3 font-body text-[15px] text-muted">{t('topicFreeUsed')}</p>
          <VettriCard />
        </div>
      )}

      {/* Exam-year filter chips. "All Years" + each year; scopes every test below. */}
      <div className="mb-5">
        <p className="tamil mb-2 font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
          {t('filterByYear')}
        </p>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          <YearChip label={t('allYears')} active={year === null} onClick={() => setYear(null)} />
          {group.years.map((y) => (
            <YearChip key={y} label={String(y)} active={year === y} onClick={() => setYear(y)} />
          ))}
        </div>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-12">
          <LogoLoader size={56} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* "All Questions" shortcut (whole section, selected year). */}
          <AllHero
            label={t('pyqAllQuestions')}
            sub={t('pyqAllQuestionsSub')}
            count={allCount}
            word={t('questionsCount')}
            disabled={(allCount ?? 0) === 0}
            onClick={beginAll}
          />

          {isAptitude ? (
            <List>
              {APT_TYPES.map(({ type, titleKey, subKey, icon, tint }, i) => {
                const n = counts[type] ?? 0
                const locked = keyLocked({ aptitude_type: type })
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
                      locked ? (
                        <LockPill label={t('lockedLabel')} />
                      ) : (
                        <span className="flex flex-shrink-0 items-center gap-2">
                          <span className="font-heading text-sm font-semibold text-primary">
                            {n}{' '}
                            <span className="font-body text-xs font-normal text-muted">
                              {t('questionsCount')}
                            </span>
                          </span>
                          <ChevronRight size={18} className="text-muted/40" />
                        </span>
                      )
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
                  trailing={keyLocked({ topic: tp }) ? <LockPill label={t('lockedLabel')} /> : undefined}
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

/** Small "locked" chip shown on a sub-type whose one free test is spent. */
function LockPill({ label }: { label: string }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-dark">
      <Lock size={11} /> {label}
    </span>
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
