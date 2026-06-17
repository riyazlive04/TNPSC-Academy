import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
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
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { api } from '../lib/api'
import { PYQ_SUBJECTS, subjectName } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

// The History PYQ subject is split by period - picking it opens the
// Ancient/Medieval/Modern selector instead of starting a test directly.
const HISTORY_SUBJECT = 'History and INM'

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
  return BookOpen
}

// Cache the per-subject counts so re-entering the page is instant.
let countsCache: Record<string, number> | null = null

export default function PreviousYearPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const [counts, setCounts] = useState<Record<string, number> | null>(countsCache)

  // One count per subject (category='pyq'), fetched in parallel once.
  useEffect(() => {
    if (countsCache) return
    let cancelled = false
    Promise.all(
      PYQ_SUBJECTS.map((s) =>
        api
          .countQuestions({ category: 'pyq', subject: s })
          .then((n) => [s, n] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      countsCache = map
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const begin = (subj: string) => {
    // History opens the period selector; every other subject starts a test.
    if (subj === HISTORY_SUBJECT) {
      navigate('/test-arena/pyq/history')
      return
    }
    startTest({ category: 'pyq', subject: subj, label: `PYQ · ${subjectName(subj, lang)}` })
  }

  return (
    <PickerPage badge={t('pyqBadge')}>
      <div className="mb-5 text-center">
        <h2 className="font-heading text-xl font-bold tracking-tight text-ink">{t('pickSubject')}</h2>
        <p className="tamil mt-1 font-body text-sm text-ink2">{t('subjectStepHint')}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PYQ_SUBJECTS.map((s, i) => {
            const Icon = subjectIcon(s)
            const n = counts[s] ?? 0
            const isHistory = s === HISTORY_SUBJECT
            return (
              <button
                key={s}
                onClick={() => begin(s)}
                style={{ '--i': i } as React.CSSProperties}
                className="stagger-item relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card p-3 text-left shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
              >
                <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-soft text-brand ring-1 ring-brand/10">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tamil block font-heading text-sm font-bold leading-snug text-ink">
                    {subjectName(s, lang)}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1">
                    <span className="font-heading text-xs font-bold tabular-nums text-brand">
                      {n.toLocaleString()}
                    </span>
                    <span className="font-body text-[11px] text-ink2">
                      {t('questionsCount')}
                      {isHistory ? ` · ${t('byPeriod')}` : ''}
                    </span>
                  </span>
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-ink2/25" />
              </button>
            )
          })}
        </div>
      )}
    </PickerPage>
  )
}
