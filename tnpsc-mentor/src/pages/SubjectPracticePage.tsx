import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Atom,
  FlaskConical,
  Leaf,
  Globe2,
  Landmark,
  Castle,
  Flag,
  Scale,
  TrendingUp,
  Building2,
  Palette,
  Languages,
  BookOpen,
  Layers,
  Shuffle,
  Clock,
  ArrowLeftRight,
  Lightbulb,
  ListChecks,
  Target,
  type LucideIcon,
} from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import IconTile from '../components/UI/IconTile'
import SectionHeader from '../components/UI/SectionHeader'
import { List, ListRow } from '../components/UI/ListRow'
import { api } from '../lib/api'
import {
  SUBJECT_PRACTICE_ORDER,
  SUBJECT_TOPIC_ORDER,
  SUBJECT_TOPIC_GROUPS,
  HISTORY_SUBJECT,
  HISTORY_PERIOD_ORDER,
  historyPeriodForTopic,
  bySyllabusOrder,
  groupTopics,
  subjectName,
  topicName,
  type HistoryPeriod,
} from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'
import type { SubjectQType } from '../types'

// The five testable question styles, in display order. `key` is null for the
// "Mixed" option (no question_type filter - pools every style for the topic).
const QTYPES: { key: SubjectQType | null; labelKey: StringKey; icon: LucideIcon }[] = [
  { key: null, labelKey: 'typeMixed', icon: Shuffle },
  { key: 'chronological', labelKey: 'typeChronological', icon: Clock },
  { key: 'match', labelKey: 'typeMatch', icon: ArrowLeftRight },
  { key: 'assertion_reason', labelKey: 'typeAssertionReason', icon: Lightbulb },
  { key: 'statements', labelKey: 'typeStatements', icon: ListChecks },
  { key: 'direct', labelKey: 'typeDirect', icon: Target },
]

const ALL_TOPICS = '__all__'
type Step = 'subject' | 'period' | 'topic' | 'type'

// History → period selector (Ancient / Medieval / Modern), in chronological
// order. Shown only when the chosen subject is History; choosing a period
// filters the topic step to that period's topics. Mirrors HistoryPeriodsPage.
const HISTORY_PERIODS: {
  unit: HistoryPeriod
  titleKey: StringKey
  subKey: StringKey
  icon: LucideIcon
}[] = [
  { unit: 'ancient', titleKey: 'periodAncient', subKey: 'periodAncientSub', icon: Landmark },
  { unit: 'medieval', titleKey: 'periodMedieval', subKey: 'periodMedievalSub', icon: Castle },
  { unit: 'modern', titleKey: 'periodModern', subKey: 'periodModernSub', icon: Flag },
]

// ─── Per-subject visuals ─────────────────────────────────────────────────────
// Subjects are matched to an icon by keyword (the bank uses slightly different
// spellings), falling back to a generic book. The grid uses ONE restrained brand
// accent across every card (premium, not a playful rainbow); see SubjectStep.

function subjectIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes('physics')) return Atom
  if (n.includes('chemistry')) return FlaskConical
  if (n.includes('biology') || n.includes('science')) return Leaf
  if (n.includes('geograph')) return Globe2
  if (n.includes('national movement') || n.includes('inm')) return Flag
  if (n.includes('culture') || n.includes('heritage')) return Palette
  if (n.includes('history')) return Landmark
  if (n.includes('polity') || n.includes('constitution')) return Scale
  if (n.includes('econom')) return TrendingUp
  if (n.includes('administration')) return Building2
  if (n.includes('tamil') || n.includes('english')) return Languages
  return BookOpen
}

// ─── Session caches ──────────────────────────────────────────────────────────
// Module-level so the data survives navigating away and back: re-entering the
// picker is then instant (no spinner, no refetch). Cleared only on full reload.
let subjectsCache: { subject: string; total: number }[] | null = null
const topicsCache = new Map<string, string[]>()
const topicCountsCache = new Map<string, Record<string, number>>()
const qtypeCache = new Map<string, Record<string, number>>()
const qKey = (subject: string, topic?: string) => `${subject}|${topic ?? ALL_TOPICS}`

export default function SubjectPracticePage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t, lang } = useT()

  const [step, setStep] = useState<Step>('subject')

  const [subjects, setSubjects] = useState<{ subject: string; total: number }[]>(
    subjectsCache ?? []
  )
  const [subject, setSubject] = useState<string | null>(null)
  const [period, setPeriod] = useState<HistoryPeriod | null>(null) // History only
  const [topic, setTopic] = useState<string | null>(null) // null = none; ALL_TOPICS = all

  const [topics, setTopics] = useState<string[]>([])
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})

  const [loadingSubjects, setLoadingSubjects] = useState(!subjectsCache)
  const [loadingTopics, setLoadingTopics] = useState(false)
  // Boolean (not a string) so the fetch effects never depend on the unstable
  // `t()` identity - the message is translated at render time instead.
  const [errored, setErrored] = useState(false)
  const errorText = errored ? t('couldNotLoad') : ''

  // Step 1 - subjects (cached after first load).
  useEffect(() => {
    if (subjectsCache) return
    let cancelled = false
    api
      .subjects()
      .then((s) => {
        if (cancelled) return
        const order = bySyllabusOrder(
          s.map((r) => r.subject),
          SUBJECT_PRACTICE_ORDER
        )
        const sorted = [...s].sort((a, b) => order.indexOf(a.subject) - order.indexOf(b.subject))
        subjectsCache = sorted
        setSubjects(sorted)
      })
      .catch(() => !cancelled && setErrored(true))
      .finally(() => !cancelled && setLoadingSubjects(false))
    return () => {
      cancelled = true
    }
  }, [])

  // Step 2 - topics for the chosen subject (cached per subject), with the
  // per-topic question counts shown on each row.
  useEffect(() => {
    if (!subject) return
    setTopicCounts(topicCountsCache.get(subject) ?? {})
    const cached = topicsCache.get(subject)
    if (cached) {
      setTopics(cached)
      setLoadingTopics(false)
      return
    }
    let cancelled = false
    setLoadingTopics(true)
    setErrored(false)
    setTopics([])
    api
      .distinctTopics({ category: 'subject', subject })
      .then((tp) => {
        if (cancelled) return
        const ordered = bySyllabusOrder(tp, SUBJECT_TOPIC_ORDER[subject])
        topicsCache.set(subject, ordered)
        setTopics(ordered)
      })
      .catch(() => !cancelled && setErrored(true))
      .finally(() => !cancelled && setLoadingTopics(false))
    return () => {
      cancelled = true
    }
  }, [subject])

  // Step 2 - per-topic counts (cached per subject; independent of topic order).
  useEffect(() => {
    if (!subject || topicCountsCache.has(subject)) return
    let cancelled = false
    api
      .topicCounts({ category: 'subject', subject })
      .then((c) => {
        if (cancelled) return
        topicCountsCache.set(subject, c)
        setTopicCounts(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [subject])

  // Step 3 - per-type counts for subject (+ topic when a specific one is picked).
  useEffect(() => {
    if (!subject || !topic) return
    const key = qKey(subject, topic === ALL_TOPICS ? undefined : topic)
    const cached = qtypeCache.get(key)
    if (cached) {
      setCounts(cached)
      return
    }
    let cancelled = false
    setCounts({})
    api
      .questionTypeCounts({ subject, topic: topic === ALL_TOPICS ? undefined : topic })
      .then((c) => {
        if (cancelled) return
        qtypeCache.set(key, c)
        setCounts(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [subject, topic])

  // Under a History period, the topic step shows only that period's topics (the
  // period IS the grouping, so drop the subject's sub-headings); otherwise the
  // full topic list with its configured groups.
  const periodTopics = useMemo(
    () => (period ? topics.filter((tp) => historyPeriodForTopic(tp) === period) : topics),
    [topics, period]
  )
  const topicGroups = useMemo(
    () =>
      groupTopics(periodTopics, period ? undefined : subject ? SUBJECT_TOPIC_GROUPS[subject] : undefined),
    [periodTopics, subject, period]
  )

  // Per-period question totals (sum of the period's topic counts), shown on the
  // period cards. Derived from the same counts the topic step already fetches.
  const periodCounts = useMemo(() => {
    const acc: Record<HistoryPeriod, number> = { ancient: 0, medieval: 0, modern: 0 }
    for (const [tp, n] of Object.entries(topicCounts)) acc[historyPeriodForTopic(tp)] += n
    return acc
  }, [topicCounts])

  // ─── Step transitions ──────────────────────────────────────────────────────
  const chooseSubject = (s: string) => {
    setSubject(s)
    setPeriod(null)
    setTopic(null)
    setCounts({})
    // History funnels through the period selector first; every other subject
    // goes straight to its topic list.
    setStep(s === HISTORY_SUBJECT ? 'period' : 'topic')
  }
  const choosePeriod = (p: HistoryPeriod) => {
    setPeriod(p)
    setTopic(null)
    setStep('topic')
  }
  const chooseTopic = (tp: string) => {
    setTopic(tp)
    setStep('type')
  }
  const back = () => {
    if (step === 'type') return setStep('topic')
    if (step === 'topic') {
      if (period) {
        setTopic(null)
        return setStep('period')
      }
      setSubject(null)
      return setStep('subject')
    }
    if (step === 'period') {
      setSubject(null)
      setPeriod(null)
      return setStep('subject')
    }
    navigate('/test-arena')
  }

  const handleType = (qtype: SubjectQType | null, labelKey: StringKey) => {
    if (!subject || !topic) return
    const isAll = topic === ALL_TOPICS
    const periodSeg = period ? [{ t: HISTORY_PERIODS.find((p) => p.unit === period)!.titleKey }] : []
    startTest({
      category: 'subject',
      subject,
      topic: isAll ? undefined : topic,
      question_type: qtype ?? undefined,
      labelParts: [{ subject }, ...periodSeg, isAll ? { t: 'allTopics' } : { topic }, { t: labelKey }],
      availableCount: totalForType(qtype),
    })
  }

  const totalForType = (key: SubjectQType | null): number => {
    if (key) return counts[key] ?? 0
    return Object.values(counts).reduce((s, n) => s + n, 0) // Mixed = sum of all
  }

  const heading =
    step === 'subject'
      ? t('pickSubject')
      : step === 'period'
        ? t('historyPickPeriod')
        : step === 'topic'
          ? t('pickTopic')
          : t('pickType')
  const hint =
    step === 'subject'
      ? t('subjectStepHint')
      : step === 'period'
        ? t('subjectPeriodHint')
        : step === 'topic'
          ? t('topicStepHint')
          : t('typeStepHint')

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
        {/* Back + breadcrumb */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={back}
            className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} /> {step === 'subject' ? t('testArena') : t('back')}
          </button>
          <Breadcrumb
            step={step}
            subject={subject}
            subjectLabel={subject ? subjectName(subject, lang) : ''}
            period={period}
            periodLabel={period ? t(HISTORY_PERIODS.find((p) => p.unit === period)!.titleKey) : ''}
            topic={topic}
            topicLabel={topic && topic !== ALL_TOPICS ? topicName(topic, lang) : ''}
            allTopicsLabel={t('allTopics')}
            onSubject={() => subject && (setStep('subject'), setSubject(null), setPeriod(null))}
            onPeriod={() => setStep('period')}
            onTopic={() => setStep('topic')}
          />
        </div>

        {/* Title block */}
        <div className="mb-5">
          <span className="tamil font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
            {t('subjectPracticeBadge')}
          </span>
          <h1 className="tamil mt-1.5 font-display text-[22px] font-bold tracking-tight text-ink lg:text-[26px]">
            {heading}
          </h1>
          <p className="tamil mt-1 font-body text-[15px] text-muted">{hint}</p>
        </div>

        {/* Animated step body (re-keyed so each step animates in) */}
        <div key={step} className="animate-fadeInFast">
          {step === 'subject' && (
            <SubjectStep
              subjects={subjects}
              loading={loadingSubjects}
              error={errorText}
              questionsWord={t('questionsCount')}
              nameOf={(s) => subjectName(s, lang)}
              onPick={chooseSubject}
            />
          )}

          {step === 'period' && (
            <PeriodStep
              periods={HISTORY_PERIODS}
              counts={periodCounts}
              countsReady={Object.keys(topicCounts).length > 0}
              label={(k) => t(k)}
              questionsWord={t('questionsCount')}
              onPick={choosePeriod}
            />
          )}

          {step === 'topic' && (
            <TopicStep
              loading={loadingTopics}
              error={errorText}
              groups={topicGroups}
              topic={topic}
              topicCounts={topicCounts}
              questionsWord={t('questionsCount')}
              allTopicsLabel={t('allTopics')}
              allTopicsSub={t('allTopicsSub')}
              topicLabel={(tp) => topicName(tp, lang)}
              onPick={chooseTopic}
              // A period already scopes the test; the whole-subject "All Topics"
              // shortcut would break that scope, so hide it under a period.
              showAllTopics={!period}
            />
          )}

          {step === 'type' && (
            <TypeStep
              qtypes={QTYPES}
              totalForType={totalForType}
              label={(k) => t(k)}
              onPick={handleType}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Breadcrumb chips (Subject › Topic) ──────────────────────────────────────
function Breadcrumb({
  step,
  subject,
  subjectLabel,
  period,
  periodLabel,
  topic,
  topicLabel,
  allTopicsLabel,
  onSubject,
  onPeriod,
  onTopic,
}: {
  step: Step
  subject: string | null
  subjectLabel: string
  period: HistoryPeriod | null
  periodLabel: string
  topic: string | null
  topicLabel: string
  allTopicsLabel: string
  onSubject: () => void
  onPeriod: () => void
  onTopic: () => void
}) {
  if (step === 'subject' || !subject) return <span />
  const topicText = topic === ALL_TOPICS ? allTopicsLabel : topicLabel
  const chipCls =
    'max-w-[8rem] truncate rounded-full bg-tint-violet px-2.5 py-1 font-heading text-primary transition-opacity hover:opacity-80'
  const sep = <ChevronRight size={13} className="flex-shrink-0 text-ink2/40" />
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
      <button onClick={onSubject} className={chipCls}>
        {subjectLabel}
      </button>
      {/* Period chip (History only), shown once we're past the period step. */}
      {period && periodLabel && (step === 'topic' || step === 'type') && (
        <>
          {sep}
          <button onClick={onPeriod} className={chipCls}>
            {periodLabel}
          </button>
        </>
      )}
      {step === 'type' && topicText && (
        <>
          {sep}
          <button onClick={onTopic} className={chipCls}>
            {topicText}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Step 1: premium subject card grid ───────────────────────────────────────
function SubjectStep({
  subjects,
  loading,
  error,
  questionsWord,
  nameOf,
  onPick,
}: {
  subjects: { subject: string; total: number }[]
  loading: boolean
  error: string
  questionsWord: string
  nameOf: (s: string) => string
  onPick: (s: string) => void
}) {
  if (loading) return <CenterSpinner />
  if (error) return <ErrorText text={error} />

  return (
    <List>
      {subjects.map((s, i) => {
        const Icon = subjectIcon(s.subject)
        return (
          <ListRow
            key={s.subject}
            onClick={() => onPick(s.subject)}
            style={{ '--i': i } as React.CSSProperties}
            leading={
              <IconTile tint="violet">
                <Icon size={19} strokeWidth={2} />
              </IconTile>
            }
            title={nameOf(s.subject)}
            subtitle={
              <span className="flex items-baseline gap-1">
                <span className="font-heading font-bold tabular-nums text-primary">
                  {s.total.toLocaleString()}
                </span>
                <span>{questionsWord}</span>
              </span>
            }
          />
        )
      })}
    </List>
  )
}

// ─── History period selection (Ancient / Medieval / Modern) ─────────────────
// Shown only for the History subject, between the subject and topic steps. Each
// row carries the period's total question count (sum of its topics' counts).
function PeriodStep({
  periods,
  counts,
  countsReady,
  label,
  questionsWord,
  onPick,
}: {
  periods: { unit: HistoryPeriod; titleKey: StringKey; subKey: StringKey; icon: LucideIcon }[]
  counts: Record<HistoryPeriod, number>
  countsReady: boolean
  label: (k: StringKey) => string
  questionsWord: string
  onPick: (p: HistoryPeriod) => void
}) {
  return (
    <List>
      {periods.map(({ unit, titleKey, subKey, icon: Icon }, i) => {
        const n = counts[unit] ?? 0
        return (
          <ListRow
            // The three periods always exist; only disable one once counts have
            // loaded and it's genuinely empty.
            key={unit}
            disabled={countsReady && n === 0}
            onClick={() => onPick(unit)}
            style={{ '--i': i } as React.CSSProperties}
            leading={
              <IconTile tint="violet">
                <Icon size={19} strokeWidth={2} />
              </IconTile>
            }
            title={label(titleKey)}
            subtitle={label(subKey)}
            trailing={
              <span className="flex flex-shrink-0 items-center gap-2">
                {countsReady && (
                  <span className="font-heading text-sm font-semibold text-primary">
                    {n}{' '}
                    <span className="font-body text-xs font-normal text-muted">{questionsWord}</span>
                  </span>
                )}
                <ChevronRight size={18} className="text-muted/40" />
              </span>
            }
          />
        )
      })}
    </List>
  )
}

// ─── Step 2: topic selection (All Topics hero + grouped rows) ────────────────
function TopicStep({
  loading,
  error,
  groups,
  topic,
  topicCounts,
  questionsWord,
  allTopicsLabel,
  allTopicsSub,
  topicLabel,
  onPick,
  showAllTopics = true,
}: {
  loading: boolean
  error: string
  groups: { heading: string | null; topics: string[] }[]
  topic: string | null
  topicCounts: Record<string, number>
  questionsWord: string
  allTopicsLabel: string
  allTopicsSub: string
  topicLabel: (tp: string) => string
  onPick: (tp: string) => void
  showAllTopics?: boolean
}) {
  if (loading) return <CenterSpinner />
  if (error) return <ErrorText text={error} />

  const grandTotal = Object.values(topicCounts).reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-6">
      {/* All Topics - the highlighted shortcut (hidden when scoped to a period) */}
      {showAllTopics && (
      <button
        onClick={() => onPick(ALL_TOPICS)}
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
            {allTopicsLabel}
          </span>
          <span className="tamil block font-body text-xs text-white/70">
            {allTopicsSub}
            {grandTotal > 0 && (
              <>
                {' · '}
                <span className="font-heading font-semibold tabular-nums text-white/90">
                  {grandTotal.toLocaleString()}
                </span>{' '}
                {questionsWord}
              </>
            )}
          </span>
        </span>
        <ChevronRight
          size={18}
          className="relative flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
        />
      </button>
      )}

      {/* Topic rows, grouped into syllabus sections when configured */}
      {groups.map((g, gi) => (
        <section key={g.heading ?? `g${gi}`} className="space-y-1">
          {g.heading && <SectionHeader title={topicLabel(g.heading)} className="px-1" />}
          <List>
            {g.topics.map((tp, i) => {
              const n = topicCounts[tp]
              return (
                <ListRow
                  key={tp}
                  onClick={() => onPick(tp)}
                  style={{ '--i': i } as React.CSSProperties}
                  className={topic === tp ? 'rounded-field ring-2 ring-primary/40' : ''}
                  leading={
                    <IconTile tint="violet">
                      <Layers size={18} />
                    </IconTile>
                  }
                  title={topicLabel(tp)}
                  subtitle={
                    n != null ? (
                      <span className="flex items-baseline gap-1">
                        <span className="font-heading font-bold tabular-nums text-primary">
                          {n.toLocaleString()}
                        </span>
                        <span>{questionsWord}</span>
                      </span>
                    ) : undefined
                  }
                />
              )
            })}
          </List>
        </section>
      ))}
    </div>
  )
}

// ─── Step 3: question-type cards (with live counts) ──────────────────────────
function TypeStep({
  qtypes,
  totalForType,
  label,
  onPick,
}: {
  qtypes: { key: SubjectQType | null; labelKey: StringKey; icon: LucideIcon }[]
  totalForType: (k: SubjectQType | null) => number
  label: (k: StringKey) => string
  onPick: (k: SubjectQType | null, labelKey: StringKey) => void
}) {
  const [mixed, ...rest] = qtypes
  const mixedCount = totalForType(mixed.key)
  const MixedIcon = mixed.icon

  return (
    <div className="space-y-3">
      {/* Mixed - the recommended, highlighted option */}
      <button
        onClick={() => onPick(mixed.key, mixed.labelKey)}
        disabled={mixedCount === 0}
        className="hero-panel interactive group relative flex w-full items-center gap-4 p-5 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className="pointer-events-none absolute inset-0 bg-hero-grid opacity-50"
          style={{ backgroundSize: '18px 18px' }}
        />
        <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
          <MixedIcon size={20} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="tamil block font-heading text-base font-semibold text-white">
            {label(mixed.labelKey)}
          </span>
          {mixedCount > 0 && (
            <span className="block font-body text-xs text-white/70">
              {mixedCount} {label('questionsCount')}
            </span>
          )}
        </span>
        <ChevronRight
          size={18}
          className="relative flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
        />
      </button>

      <List>
        {rest.map(({ key, labelKey, icon: Icon }, i) => {
          const n = totalForType(key)
          return (
            <ListRow
              key={labelKey}
              onClick={() => onPick(key, labelKey)}
              disabled={n === 0}
              style={{ '--i': i } as React.CSSProperties}
              leading={
                <IconTile tint="violet">
                  <Icon size={18} />
                </IconTile>
              }
              title={label(labelKey)}
              trailing={
                <span className="flex-shrink-0 font-heading text-sm font-semibold text-muted">
                  {n > 0 ? n : '—'}
                </span>
              }
            />
          )
        })}
      </List>
    </div>
  )
}

// ─── Small shared bits ───────────────────────────────────────────────────────
function CenterSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  )
}
function ErrorText({ text }: { text: string }) {
  return <p className="py-12 text-center font-body text-sm text-wrong">{text}</p>
}
