import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

  /** Seed the baseline silently (called on the dashboard) - no rewards shown. */
  sync: (badgeIds: string[], level: number) => void
  /**
   * Compare the latest state against what's been seen, advance the baseline,
   * and return the deltas to celebrate. On a cold store (never seeded), this
   * seeds silently and returns nothing.
   */
  claim: (badgeIds: string[], level: number) => Rewards
  /**
   * Award the daily-challenge reward at most once per calendar day. `today` is
   * a YYYY-MM-DD string (caller's local day). Idempotent within the day.
   */
  claimDaily: (today: string) => DailyClaim
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      initialized: false,
      seenBadges: [],
      seenLevel: 1,
      lastDailyDate: null,
      dailyRewardPoints: 0,

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
        const { lastDailyDate, dailyRewardPoints } = get()
        if (lastDailyDate === today) {
          // Already rewarded today - no double-dipping.
          return { granted: false, points: 0, total: dailyRewardPoints }
        }
        const total = dailyRewardPoints + DAILY_REWARD_POINTS
        set({ lastDailyDate: today, dailyRewardPoints: total })
        return { granted: true, points: DAILY_REWARD_POINTS, total }
      },
    }),
    { name: 'tnpsc-mentor-progress' }
  )
)
