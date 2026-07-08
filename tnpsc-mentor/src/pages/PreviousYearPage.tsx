import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Landmark,
  Palette,
  Scale,
  Globe2,
  Building2,
  Leaf,
  Atom,
  FlaskConical,
  TrendingUp,
  Calculator,
  BookOpen,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import VettriCard from '../components/UI/VettriCard'
import { List, ListRow } from '../components/UI/ListRow'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import { deriveGateKey } from '../lib/freeGate'
import { PYQ_SUBJECTS, subjectName } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

// The History PYQ subject is split by period - picking it opens the
// Ancient/Medieval/Modern selector instead of starting a test directly.
const HISTORY_SUBJECT = 'History and INM'
// The Aptitude PYQ subject is split by style (Numerics / Reasoning) - picking it
// opens that selector first, mirroring the standalone Aptitude section.
const APTITUDE_SUBJECT = 'Aptitude'

// Match a PYQ subject to an icon by keyword (bank spellings vary slightly).
function subjectIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes('culture') || n.includes('heritage')) return Palette
  if (n.includes('history')) return Landmark
  if (n.includes('polity')) return Scale
  if (n.includes('geograph')) return Globe2
  if (n.includes('administration')) return Building2
  if (n.includes('biology')) return Leaf
  if (n.includes('physics')) return Atom
  if (n.includes('chemistry')) return FlaskConical
  if (n.includes('econom')) return TrendingUp
  if (n.includes('aptitude')) return Calculator
  return BookOpen
}

// Exam years present in the Group 1 PYQ bank (newest first); null = all years.
const PYQ_YEARS = [2025, 2024, 2022, 2021, 2019]

// Cache per-subject counts per year so flicking between years is instant.
const countsCache = new Map<number | 'all', Record<string, number>>()
const yearKey = (y: number | null): number | 'all' => y ?? 'all'

export default function PreviousYearPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t, lang } = useT()

  // Selected exam year (null = all years). Scopes every test + the subject counts.
  const [year, setYear] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(
    countsCache.get('all') ?? null
  )

  // Free-tier gate: one PYQ test per subject. `unlimited` (premium/vettri) has no
  // locks; otherwise `usedKeys` lists the subjects whose free test is spent.
  const [unlimited, setUnlimited] = useState(true)
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set())
  const [showUpsell, setShowUpsell] = useState(false)

  // (Re)load per-subject counts (category='pyq') whenever the year changes.
  useEffect(() => {
    const key = yearKey(year)
    const cached = countsCache.get(key)
    if (cached) {
      setCounts(cached)
      return
    }
    setCounts(null)
    let cancelled = false
    Promise.all(
      PYQ_SUBJECTS.map((s) =>
        api
          .countQuestions({ category: 'pyq', subject: s, year: year ?? undefined })
          .then((n) => [s, n] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      countsCache.set(key, map)
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [year])

  // Lock state (which subjects have used their one free test).
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

  const isLocked = (subj: string) => {
    if (unlimited) return false
    const key = deriveGateKey({ category: 'pyq', subject: subj })
    return key ? usedKeys.has(key) : false
  }

  const begin = (subj: string) => {
    // A subject whose free test is spent diverts to the upsell instead of starting.
    if (isLocked(subj)) {
      setShowUpsell(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // With "All years" selected, History opens the period selector and Aptitude the
    // numeric/reasoning selector. With a specific YEAR selected, that year already
    // narrows the pool, so every subject (incl. History/Aptitude) starts directly,
    // scoped to the year.
    if (year === null) {
      if (subj === HISTORY_SUBJECT) {
        navigate('/test-arena/pyq/history')
        return
      }
      if (subj === APTITUDE_SUBJECT) {
        navigate('/test-arena/pyq/aptitude')
        return
      }
    }
    startTest({
      category: 'pyq',
      subject: subj,
      year: year ?? undefined,
      labelParts: year ? ['PYQ', { subject: subj }, String(year)] : ['PYQ', { subject: subj }],
      availableCount: counts?.[subj],
    })
  }

  return (
    <PickerPage badge={t('pyqBadge')}>
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">{t('pickSubject')}</h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('subjectStepHint')}</p>
      </div>

      {/* Exam-year filter. "All Years" + each year; scopes every subject below. */}
      <div className="mb-5">
        <p className="tamil mb-2 font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
          {t('filterByYear')}
        </p>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          <YearChip label={t('allYears')} active={year === null} onClick={() => setYear(null)} />
          {PYQ_YEARS.map((y) => (
            <YearChip key={y} label={String(y)} active={year === y} onClick={() => setYear(y)} />
          ))}
        </div>
      </div>

      {showUpsell && (
        <div className="mb-5 animate-fadeInFast">
          <p className="tamil mb-3 font-body text-[15px] text-muted">{t('topicFreeUsed')}</p>
          <VettriCard />
        </div>
      )}

      {counts === null ? (
        <div className="flex justify-center py-16">
          <LogoLoader size={56} />
        </div>
      ) : (
        // Subjects as a hairline-divided list with small tint tiles + chevron.
        <List>
          {PYQ_SUBJECTS.map((s, i) => {
            const Icon = subjectIcon(s)
            const n = counts[s] ?? 0
            const isHistory = s === HISTORY_SUBJECT
            const isAptitude = s === APTITUDE_SUBJECT
            const locked = isLocked(s)
            return (
              <ListRow
                key={s}
                onClick={() => begin(s)}
                style={{ '--i': i } as React.CSSProperties}
                leading={
                  <IconTile tint="violet">
                    <Icon size={19} strokeWidth={2} />
                  </IconTile>
                }
                trailing={
                  locked ? (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-brand-dark">
                      <Lock size={11} /> {t('lockedLabel')}
                    </span>
                  ) : undefined
                }
                title={subjectName(s, lang)}
                subtitle={
                  <span className="flex items-baseline gap-1">
                    <span className="font-heading font-bold tabular-nums text-primary">
                      {n.toLocaleString()}
                    </span>
                    <span>
                      {t('questionsCount')}
                      {year === null && isHistory
                        ? ` · ${t('byPeriod')}`
                        : year === null && isAptitude
                          ? ` · ${t('byType')}`
                          : ''}
                    </span>
                  </span>
                }
              />
            )
          })}
        </List>
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
        active ? 'bg-primary text-white' : 'bg-tint-violet text-primary hover:bg-primary/15'
      }`}
    >
      {label}
    </button>
  )
}
