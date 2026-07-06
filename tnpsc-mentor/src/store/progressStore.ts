import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayIso } from '../lib/habit'

// Tracks what the user has already been congratulated for, so the reward
// overlay only fires on genuinely NEW level-ups / badge unlocks (never a flood).

export interface Rewards {
  newBadges: string[]
  leveledTo: number | null
}

/** Points granted for completing the daily Current-Affairs challenge. */
export const DAILY_REWARD_POINTS = 50

export interface DailyClaim {
  /** True only on the first daily completion of the calendar day. */
  granted: boolean
  /** Points awarded for this claim (0 when already claimed today). */
  points: number
  /** Cumulative lifetime daily-reward points after this claim. */
  total: number
}

interface ProgressState {
  initialized: boolean
  seenBadges: string[]
  seenLevel: number

  // Daily-challenge reward ledger.
  lastDailyDate: string | null
  dailyRewardPoints: number

  // Last IST day the "daily goal complete" celebration was shown.
  lastGoalDate: string | null

  /** Seed the baseline silently (called on the dashboard) - no rewards shown. */
  sync: (badgeIds: string[], level: number) => void
  /**
   * Compare the latest state against what's been seen, advance the baseline,
   * and return the deltas to celebrate. On a cold store (never seeded), this
   * seeds silently and returns nothing.
   */
  claim: (badgeIds: string[], level: number) => Rewards
  /**
   * Award the daily-challenge reward at most once per calendar day. The day
   * boundary is always IST (via todayIso()) so it agrees with the streak logic;
   * an explicit `today` may be passed in tests. Idempotent within the day.
   */
  claimDaily: (today?: string) => DailyClaim
  /**
   * Mark today's daily-goal completion as celebrated. Returns true only on the
   * first call of the IST day, so the "goal complete" popup can never repeat
   * (e.g. when a result page is revisited). Idempotent within the day.
   */
  claimGoalMet: (today?: string) => boolean
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      initialized: false,
      seenBadges: [],
      seenLevel: 1,
      lastDailyDate: null,
      dailyRewardPoints: 0,
      lastGoalDate: null,

      sync: (badgeIds, level) => {
        if (get().initialized) return
        set({ initialized: true, seenBadges: badgeIds, seenLevel: level })
      },

      claim: (badgeIds, level) => {
        const { initialized, seenBadges, seenLevel } = get()
        if (!initialized) {
          // First ever sighting - seed, don't celebrate retroactively.
          set({ initialized: true, seenBadges: badgeIds, seenLevel: level })
          return { newBadges: [], leveledTo: null }
        }
        const prev = new Set(seenBadges)
        const newBadges = badgeIds.filter((id) => !prev.has(id))
        const leveledTo = level > seenLevel ? level : null
        set({
          initialized: true,
          seenBadges: badgeIds,
          seenLevel: Math.max(level, seenLevel),
        })
        return { newBadges, leveledTo }
      },

      claimDaily: (today) => {
        // Normalise to the IST day so the reward and the streak share one
        // boundary, ignoring any caller-local string that may differ near
        // midnight off-IST.
        const day = today ?? todayIso()
        const { lastDailyDate, dailyRewardPoints } = get()
        if (lastDailyDate === day) {
          // Already rewarded today - no double-dipping.
          return { granted: false, points: 0, total: dailyRewardPoints }
        }
        const total = dailyRewardPoints + DAILY_REWARD_POINTS
        set({ lastDailyDate: day, dailyRewardPoints: total })
        return { granted: true, points: DAILY_REWARD_POINTS, total }
      },

      claimGoalMet: (today) => {
        const day = today ?? todayIso()
        if (get().lastGoalDate === day) return false
        set({ lastGoalDate: day })
        return true
      },
    }),
    { name: 'tnpsc-mentor-progress' }
  )
)
