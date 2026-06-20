import { useEffect, useState } from 'react'
import { Calculator, Brain, ChevronRight, Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile, { type Tint } from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'

// The PYQ Aptitude subject as stored in the DB; its rows carry the standard
// aptitude_type tag ('numerics' | 'reasoning') from the original import.
const APTITUDE_SUBJECT = 'Aptitude'

// The two aptitude styles a student picks before the test.
const TYPES: {
  type: 'numerics' | 'reasoning'
  titleKey: StringKey
  subKey: StringKey
  icon: React.ReactNode
  tint: Tint
}[] = [
  { type: 'numerics', titleKey: 'numerics', subKey: 'numericsSub', icon: <Calculator size={19} />, tint: 'violet' },
  { type: 'reasoning', titleKey: 'reasoning', subKey: 'reasoningSub', icon: <Brain size={19} />, tint: 'blue' },
]

/**
 * Aptitude → type selector. Reached when a student picks "Aptitude" on the PYQ
 * page. Shows Numerics / Reasoning with live counts; choosing one starts a PYQ
 * Aptitude test scoped to that style via the `aptitude_type` filter — mirroring
 * the standalone Aptitude section's first step.
 */
export default function PyqAptitudePage() {
  const startTest = useStartTest()
  const { t } = useT()
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(
      TYPES.map(({ type }) =>
        api
          .countQuestions({ category: 'pyq', subject: APTITUDE_SUBJECT, aptitude_type: type })
          .then((n) => [type, n] as const)
          .catch(() => [type, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      setCounts(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const begin = (type: 'numerics' | 'reasoning') => {
    startTest({
      category: 'pyq',
      subject: APTITUDE_SUBJECT,
      aptitude_type: type,
      labelParts: ['PYQ', { subject: APTITUDE_SUBJECT }, { t: type === 'numerics' ? 'numerics' : 'reasoning' }],
      availableCount: counts?.[type],
    })
  }

  return (
    <PickerPage badge={t('pyqAptitudeBadge')}>
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('pyqAptitudePickType')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('pyqAptitudePickTypeSub')}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-10">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <List>
          {TYPES.map(({ type, titleKey, subKey, icon, tint }) => {
            const n = counts[type] ?? 0
            return (
              <ListRow
                key={type}
                disabled={n === 0}
                onClick={() => begin(type)}
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
      )}
    </PickerPage>
  )
}
