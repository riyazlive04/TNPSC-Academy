import { Check, Flame } from 'lucide-react'
import { todayIso } from '../lib/habit'
import { useT } from '../lib/i18n'

interface StreakCalendarProps {
  /** Daily activity (date = YYYY-MM-DD, IST calendar days) from the habit layer. */
  last30: { date: string; questions: number }[]
  currentStreak: number
  /** Longest-ever streak - shown as a quiet caption when known. */
  bestStreak?: number
  className?: string
}

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The last 7 days as a row of day-dots - active days filled & checked, today
 * ringed. Day boundaries follow the habit layer's IST calendar (todayIso), and
 * a day counts as active when a ledger row exists for it - the same predicate
 * computeStreak uses, so the dots always agree with the streak number.
 */
export default function StreakCalendar({
  last30,
  currentStreak,
  bestStreak = 0,
  className = '',
}: StreakCalendarProps) {
  const { t } = useT()
  const active = new Set(last30.map((d) => d.date))
  // Anchor on the IST day string, then step in whole UTC days - the strings are
  // plain calendar dates, so this walk stays aligned to IST midnights.
  const today = todayIso()
  const base = new Date(today + 'T00:00:00Z')

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() - (6 - i))
    const iso = d.toISOString().slice(0, 10)
    return { iso, label: WD[d.getUTCDay()], on: active.has(iso), isToday: iso === today }
  })

  return (
    <div className={['rounded-card border border-line bg-card p-4', className].join(' ')}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-streaksoft text-streak">
          <Flame size={15} />
        </span>
        <span className="tamil font-heading text-sm font-semibold text-ink">
          {currentStreak > 0 ? `${currentStreak} ${t('dayStreak')}` : t('startStreak')}
        </span>
        {bestStreak > 0 && (
          <span className="tamil ml-auto font-body text-xs text-muted">
            {t('bestStreak')} · {bestStreak}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="font-heading text-2xs font-medium uppercase text-ink2">
              {d.label}
            </span>
            <span
              className={[
                'grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold transition',
                d.on
                  ? 'bg-brand text-white'
                  : d.isToday
                    ? 'border border-ink/25 text-ink2'
                    : 'bg-tint text-ink2/40',
              ].join(' ')}
            >
              {d.on ? <Check size={15} /> : '·'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
