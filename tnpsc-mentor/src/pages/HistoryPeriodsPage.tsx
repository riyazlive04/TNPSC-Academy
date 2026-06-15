import { useEffect, useState } from 'react'
import { Landmark, Castle, Flag, ChevronRight, Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
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
  tile: string
}[] = [
  { unit: 'ancient', titleKey: 'periodAncient', subKey: 'periodAncientSub', icon: <Landmark size={22} />, tile: 'bg-brand-soft text-brand' },
  { unit: 'medieval', titleKey: 'periodMedieval', subKey: 'periodMedievalSub', icon: <Castle size={22} />, tile: 'bg-gold/15 text-gold' },
  { unit: 'modern', titleKey: 'periodModern', subKey: 'periodModernSub', icon: <Flag size={22} />, tile: 'bg-accentwarmsoft text-accentwarm' },
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
    })
  }

  return (
    <PickerPage badge={t('historyPeriodBadge')}>
      <div className="mx-auto max-w-xl">
        <h2 className="mb-1 text-center font-heading text-lg font-semibold tracking-tight text-ink">
          {t('historyPickPeriod')}
        </h2>
        <p className="mb-6 text-center font-body text-sm text-ink2">{t('historyPickPeriodSub')}</p>

        {counts === null ? (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-3">
            {PERIODS.map(({ unit, titleKey, subKey, icon, tile }) => {
              const n = counts[unit] ?? 0
              const title = t(titleKey)
              return (
                <button
                  key={unit}
                  disabled={n === 0}
                  onClick={() => begin(unit, title)}
                  className="card interactive group flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${tile}`}>
                    {icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="tamil block font-heading text-[15px] font-semibold leading-tight text-ink">
                      {title}
                    </span>
                    <span className="tamil mt-0.5 block truncate font-body text-xs text-ink2">
                      {t(subKey)}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <span className="font-heading text-sm font-semibold text-brand">
                      {n} <span className="font-body text-xs font-normal text-ink2">{t('questionsCount')}</span>
                    </span>
                    <ChevronRight size={18} className="text-ink2/30 transition group-hover:text-brand" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </PickerPage>
  )
}
