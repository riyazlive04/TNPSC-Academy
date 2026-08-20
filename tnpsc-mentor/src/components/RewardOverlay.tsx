import { useEffect } from 'react'
import { Check, Flame, Gift } from 'lucide-react'
import { badgeIcon } from './badgeIcons'
import type { Badge } from '../lib/achievements'
import { SHOW_STREAK } from '../lib/features'
import { useT } from '../lib/i18n'
import { hapticSuccess } from '../lib/haptics'

export interface DailyReward {
  /** Points awarded for today's daily-challenge completion. */
  points: number
  /** Current day-streak, for the flame chip. */
  streak: number
}

interface RewardOverlayProps {
  leveledTo: number | null
  newBadges: Badge[]
  /** Present when a fresh daily-challenge reward was just claimed. */
  daily?: DailyReward | null
  /** True when this test just completed the daily question goal. */
  goalDone?: boolean
  onClose: () => void
}

/**
 * Minimal celebration shown when the user levels up, unlocks badges, completes
 * the daily goal and/or earns the daily-challenge reward. Fired from the Result
 * page after a test and from the dashboard for unlocks first seen there (e.g.
 * streak badges). Restrained, premium - no confetti.
 */
export default function RewardOverlay({
  leveledTo,
  newBadges,
  daily,
  goalDone = false,
  onClose,
}: RewardOverlayProps) {
  const { t } = useT()
  const hasProgress = leveledTo != null || newBadges.length > 0
  // Fires once per mount - the caller only mounts this when there's actually
  // something to celebrate, so this never fires on an empty reveal.
  useEffect(() => {
    hapticSuccess()
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('achievements')}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 px-4"
    >
      <div className="animate-pop w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-card">
        {daily && (
          <div className={!hasProgress && !goalDone ? '' : 'mb-5 border-b border-line pb-5'}>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Gift size={26} />
            </div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
              {t('dailyReward')}
            </p>
            <p className="tamil mt-1 font-heading text-2xl font-semibold tracking-tight text-ink">
              {t('dailyChallengeComplete')}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 font-heading text-sm font-semibold text-white">
                +{daily.points} {t('rewardPoints')}
              </span>
              {SHOW_STREAK && daily.streak > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-streaksoft px-3 py-1 font-heading text-sm font-semibold text-streak">
                  <Flame size={14} /> {daily.streak}
                </span>
              )}
            </div>
            <p className="tamil mt-3 font-body text-sm text-ink2">{t('comeBackTomorrow')}</p>
          </div>
        )}

        {goalDone && (
          <div className={hasProgress ? 'mb-5 border-b border-line pb-5' : ''}>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-mintsoft text-mint">
              <Check size={26} strokeWidth={3} className="animate-checkPop" />
            </div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
              {t('dailyGoal')}
            </p>
            <p className="tamil mt-1 font-heading text-2xl font-semibold tracking-tight text-ink">
              {t('goalDone')}
            </p>
            {!daily && (
              <p className="tamil mt-3 font-body text-sm text-ink2">{t('comeBackTomorrow')}</p>
            )}
          </div>
        )}

        {leveledTo != null && (
          <>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
              Level up
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold tracking-tight text-ink">
              Level {leveledTo}
            </p>
          </>
        )}

        {newBadges.length > 0 && (
          <>
            <p className="mt-2 mb-4 font-body text-sm text-ink2">
              {leveledTo != null ? 'And you unlocked' : 'You unlocked'}{' '}
              {newBadges.length === 1 ? 'a new badge' : `${newBadges.length} new badges`}.
            </p>
            <div className="mb-5 flex flex-wrap justify-center gap-3">
              {newBadges.map((b) => (
                <div key={b.id} className="flex w-24 flex-col items-center gap-1.5">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                    {badgeIcon(b.iconKey, 20)}
                  </span>
                  <span className="font-heading text-xs font-semibold leading-tight text-ink">
                    {b.title}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!hasProgress && !daily && !goalDone && (
          <p className="mb-4 font-heading text-xl font-semibold text-ink">Nice work</p>
        )}

        <button onClick={onClose} className="btn-brand w-full px-6 py-3 text-sm">
          Continue
        </button>
      </div>
    </div>
  )
}
