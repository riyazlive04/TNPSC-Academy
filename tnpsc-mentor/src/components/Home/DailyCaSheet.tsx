import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarClock, ChevronRight, ListChecks } from 'lucide-react'
import { api, type CaDailySet } from '../../lib/api'
import { issueDateLabel } from '../../lib/caMagazine'
import { dailyCaConfig } from '../../lib/caDaily'
import { todayIso } from '../../lib/habit'
import { useStartTest } from '../../hooks/useStartTest'
import { tapScaleSubtle } from '../../lib/motion'
import { Skeleton } from '../UI/Skeleton'
import BottomSheet from './BottomSheet'
import { useT } from '../../lib/i18n'

/**
 * The Daily Current-Affairs test picker, opened from its dashboard card: today's
 * paper as the one obvious action, with every earlier published day beneath it.
 * A popup rather than a screen, so reading the day's magazine and taking the
 * day's test never leaves the home surface.
 *
 * Publication-driven — only sets a superadmin has approved appear (the same
 * approval that exposes that day's answer PDF).
 */

// Module-level cache so re-opening the sheet doesn't refetch/flash.
let cache: CaDailySet[] | null = null

/** How many days the picker offers (today + the days before it). */
const DAYS = 10

export default function DailyCaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const startTest = useStartTest()
  const [sets, setSets] = useState<CaDailySet[] | null>(cache)

  // Fetch on first open — the dashboard shouldn't pay for a list nobody asked for.
  useEffect(() => {
    if (!open || cache) return
    let cancelled = false
    api.caQuestions
      .dailyPublished(DAYS)
      .then((list) => {
        cache = list
        if (!cancelled) setSets(list)
      })
      .catch(() => {
        // Show the empty state rather than an error screen — the CA section and
        // the rest of the dashboard keep working either way.
        if (!cancelled) setSets([])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  /** Launch a day's paper through the normal pre-test flow (rules + credits). */
  const start = (s: CaDailySet) => startTest(dailyCaConfig(s, lang))

  const today = todayIso()
  const latest = sets?.[0]
  const earlier = sets?.slice(1) ?? []

  return (
    <BottomSheet open={open} onClose={onClose} title={t('caDailyTitle')}>
      {sets === null && (
        <div className="space-y-3">
          <Skeleton className="h-[84px] w-full rounded-card" />
          <Skeleton className="h-[68px] w-full rounded-card" />
        </div>
      )}

      {sets !== null && sets.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ListChecks size={28} className="text-ink2/50" />
          <p className="tamil max-w-xs font-body text-sm text-ink2">{t('caDailyEmpty')}</p>
        </div>
      )}

      {latest && (
        <div className="space-y-3">
          {/* The newest published day — the single obvious action in here. */}
          <motion.button
            type="button"
            onClick={() => start(latest)}
            className="focus-ring group flex w-full items-center gap-3.5 rounded-card border border-primary/25 bg-tint-green/50 p-4 text-left transition-colors hover:border-primary/45"
            whileTap={tapScaleSubtle}
          >
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-mint to-sky text-white shadow-sm">
              <ListChecks size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="tamil block font-heading text-base font-semibold leading-tight text-ink">
                {latest.date === today
                  ? t('caDailyToday')
                  : issueDateLabel('day_wise', latest.date, lang)}
              </span>
              <span className="tamil mt-0.5 block font-body text-xs leading-snug text-muted">
                <span className="font-heading font-bold tabular-nums text-primary">
                  {latest.total}
                </span>{' '}
                {t('questionsCount')} · {t('caDailySub')}
              </span>
            </span>
            <span className="hidden flex-shrink-0 items-center gap-1.5 rounded-pill bg-brand-gradient px-4 py-2 font-display text-sm font-semibold text-white transition-all group-hover:gap-2.5 sm:inline-flex">
              {t('start')} <ChevronRight size={15} />
            </span>
            <ChevronRight size={19} className="flex-shrink-0 text-primary/60 sm:hidden" />
          </motion.button>

          {/* Every earlier day, so a missed one is still a single tap. */}
          {earlier.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {earlier.map((s) => (
                <motion.button
                  key={s.id}
                  type="button"
                  onClick={() => start(s)}
                  className="focus-ring flex flex-col gap-1 rounded-card border border-line bg-card p-3 text-left transition-colors hover:border-brand/40"
                  whileTap={tapScaleSubtle}
                >
                  <span className="inline-flex items-center gap-1 font-heading text-2xs font-bold uppercase tracking-wide text-muted">
                    <CalendarClock size={11} />
                    {shortDay(s.date, lang)}
                  </span>
                  <span className="tamil font-body text-xs leading-snug text-ink2">
                    <span className="font-heading font-bold tabular-nums text-primary">
                      {s.total}
                    </span>{' '}
                    {t('questionsCount')}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/** '2026-08-03' → '3 Aug' / '3 ஆகஸ்ட்' — the compact label the day chips carry. */
function shortDay(date: string, lang: 'en' | 'ta' | 'both'): string {
  const l = lang === 'both' ? 'en' : lang
  const [day, month] = issueDateLabel('day_wise', date, l).split(' ')
  if (!month) return date
  // Tamil month names are already short; English ones clip to three letters.
  return `${day} ${l === 'ta' ? month : month.slice(0, 3)}`
}
