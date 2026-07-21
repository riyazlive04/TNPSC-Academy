import { useEffect, useState } from 'react'
import { Landmark, Castle, Flag } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { type Tint } from '../components/UI/IconTile'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'

// The PYQ History subject as stored in the DB; its rows are tagged by period in
// the `unit` column (ancient / medieval / modern).
const HISTORY_SUBJECT = 'History and INM'

// The three criteria a student picks before the test, in chronological order.
const PERIODS: {
  unit: 'ancient' | 'medieval' | 'modern'
  titleKey: StringKey
  subKey: StringKey
  icon: React.ReactNode
  tint: Tint
}[] = [
  { unit: 'ancient', titleKey: 'periodAncient', subKey: 'periodAncientSub', icon: <Landmark size={19} />, tint: 'violet' },
  { unit: 'medieval', titleKey: 'periodMedieval', subKey: 'periodMedievalSub', icon: <Castle size={19} />, tint: 'blue' },
  { unit: 'modern', titleKey: 'periodModern', subKey: 'periodModernSub', icon: <Flag size={19} />, tint: 'coral' },
]

/**
 * History → period selector. Reached when a student picks "History" on the PYQ
 * page. Shows the three criteria (Ancient / Medieval / Modern) with live counts;
 * choosing one starts a PYQ History test scoped to that period via the `unit`
 * filter on get_quiz_questions.
 */
export default function HistoryPeriodsPage() {
  const startTest = useStartTest()
  const { t } = useT()
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .historyPeriods()
      .then((c) => !cancelled && setCounts(c))
      .catch(() => !cancelled && setCounts({}))
    return () => {
      cancelled = true
    }
  }, [])

  const begin = (unit: string, title: string) => {
    startTest({
      category: 'pyq',
      subject: HISTORY_SUBJECT,
      unit,
      label: `PYQ · ${title}`,
      availableCount: counts?.[unit],
    })
  }

  return (
    <PickerPage badge={t('historyPeriodBadge')} backTo="/test-arena/pyq/group1">
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('historyPickPeriod')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('historyPickPeriodSub')}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-10">
          <LogoLoader size={56} />
        </div>
      ) : (
        <ChoiceGrid>
          {PERIODS.map(({ unit, titleKey, subKey, icon, tint }, i) => {
            const n = counts[unit] ?? 0
            const title = t(titleKey)
            return (
              <ChoiceCard
                key={unit}
                index={i}
                disabled={n === 0}
                onClick={() => begin(unit, title)}
                icon={icon}
                tint={tint}
                title={title}
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
      )}
    </PickerPage>
  )
}
