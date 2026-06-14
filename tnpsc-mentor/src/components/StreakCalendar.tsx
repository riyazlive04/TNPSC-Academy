import { Check, Flame } from 'lucide-react'

interface StreakCalendarProps {
  /** Daily activity (date = YYYY-MM-DD, UTC) from the habit layer. */
  last30: { date: string; questions: number }[]
  currentStreak: number
  className?: string
}

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * The last 7 days as a row of day-dots — active days filled & checked, today
 * ringed. Mirrors the streak calendar from the design reference.
 */
export default function StreakCalendar({
  last30,
  currentStreak,
  className = '',
}: StreakCalendarProps) {
  const active = new Set(last30.filter((d) => d.questions > 0).map((d) => d.date))
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - (6 - i))
    const iso = isoUTC(d)
    return { iso, label: WD[d.getUTCDay()], on: active.has(iso), isToday: i === 6 }
  })

  return (
    <div className={['card p-4', className].join(' ')}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-tint text-ink2">
          <Flame size={15} />
        </span>
        <span className="font-heading text-sm font-semibold text-ink">
          {currentStreak > 0 ? `${currentStreak}-day streak` : 'Start your streak'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="font-heading text-[10px] font-medium uppercase text-ink2">
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
