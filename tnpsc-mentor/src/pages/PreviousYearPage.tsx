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
  Calculator,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { api } from '../lib/api'
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
    // History opens the period selector, Aptitude the numeric/reasoning selector;
    // every other subject starts a test directly.
    if (subj === HISTORY_SUBJECT) {
      navigate('/test-arena/pyq/history')
      return
    }
    if (subj === APTITUDE_SUBJECT) {
      navigate('/test-arena/pyq/aptitude')
      return
    }
    startTest({
      category: 'pyq',
      subject: subj,
      labelParts: ['PYQ', { subject: subj }],
      availableCount: counts?.[subj],
    })
  }

  return (
    <PickerPage badge={t('pyqBadge')}>
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">{t('pickSubject')}</h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('subjectStepHint')}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        // Subjects as a hairline-divided list with small tint tiles + chevron.
        <List>
          {PYQ_SUBJECTS.map((s, i) => {
            const Icon = subjectIcon(s)
            const n = counts[s] ?? 0
            const isHistory = s === HISTORY_SUBJECT
            const isAptitude = s === APTITUDE_SUBJECT
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
                title={subjectName(s, lang)}
                subtitle={
                  <span className="flex items-baseline gap-1">
                    <span className="font-heading font-bold tabular-nums text-primary">
                      {n.toLocaleString()}
                    </span>
                    <span>
                      {t('questionsCount')}
                      {isHistory ? ` · ${t('byPeriod')}` : isAptitude ? ` · ${t('byType')}` : ''}
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
