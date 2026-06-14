// ─── Achievement / badge definitions ────────────────────────────────────────
// Shared between the Achievements page (display) and the Result page (reward
// detection). Icons are referenced by key so this file stays JSX-free; the
// page maps keys → lucide components.

export type BadgeIconKey =
  | 'flag'
  | 'book'
  | 'target'
  | 'cap'
  | 'zap'
  | 'crown'
  | 'flame'
  | 'brain'
  | 'sparkles'
  | 'trophy'
  | 'clock'

export interface GameStats {
  tests: number
  questions: number
  correct: number
  bestScore: number
  avgAccuracy: number
  minutes: number
  longestStreak: number
  currentStreak: number
  subjects: number
  totalSubjects: number
}

export interface BadgeDef {
  id: string
  title: string
  desc: string
  iconKey: BadgeIconKey
  /** Tailwind classes for the unlocked icon tile. */
  tile: string
  /** Fixed target; the special 'master' badge derives its target from stats. */
  target: number
  value: (s: GameStats) => number
}

export interface Badge extends Omit<BadgeDef, 'value'> {
  value: number
  unlocked: boolean
  pct: number
}

export const BADGES: BadgeDef[] = [
  { id: 'first', title: 'First Steps', desc: 'Finish your first test', iconKey: 'flag', tile: 'bg-brand-soft text-brand', target: 1, value: (s) => s.tests },
  { id: 'bookworm', title: 'Bookworm', desc: 'Complete 10 tests', iconKey: 'book', tile: 'bg-skysoft text-sky', target: 10, value: (s) => s.tests },
  { id: 'century', title: 'Centurion', desc: 'Answer 100 questions', iconKey: 'target', tile: 'bg-mintsoft text-mint', target: 100, value: (s) => s.questions },
  { id: 'scholar', title: 'Scholar', desc: 'Answer 500 questions', iconKey: 'cap', tile: 'bg-brand-soft text-brand', target: 500, value: (s) => s.questions },
  { id: 'sharp', title: 'Sharpshooter', desc: 'Score 90%+ in a test', iconKey: 'zap', tile: 'bg-goldsoft text-gold', target: 90, value: (s) => s.bestScore },
  { id: 'flawless', title: 'Flawless', desc: 'Score 100% in a test', iconKey: 'crown', tile: 'bg-coralsoft text-coral', target: 100, value: (s) => s.bestScore },
  { id: 'consistent', title: 'Consistent', desc: 'Reach a 3-day streak', iconKey: 'flame', tile: 'bg-streaksoft text-streak', target: 3, value: (s) => s.longestStreak },
  { id: 'onfire', title: 'On Fire', desc: 'Reach a 7-day streak', iconKey: 'flame', tile: 'bg-coralsoft text-coral', target: 7, value: (s) => s.longestStreak },
  { id: 'unstoppable', title: 'Unstoppable', desc: 'Reach a 30-day streak', iconKey: 'flame', tile: 'bg-goldsoft text-gold', target: 30, value: (s) => s.longestStreak },
  { id: 'sharpmind', title: 'Sharp Mind', desc: '75%+ average accuracy', iconKey: 'brain', tile: 'bg-mintsoft text-mint', target: 75, value: (s) => s.avgAccuracy },
  { id: 'explorer', title: 'Explorer', desc: 'Practice 5 subjects', iconKey: 'sparkles', tile: 'bg-skysoft text-sky', target: 5, value: (s) => s.subjects },
  { id: 'master', title: 'Syllabus Master', desc: 'Cover every syllabus subject', iconKey: 'trophy', tile: 'bg-goldsoft text-gold', target: 0, value: (s) => s.subjects },
  { id: 'timescholar', title: 'Time Scholar', desc: 'Study for 2 hours total', iconKey: 'clock', tile: 'bg-brand-soft text-brand', target: 120, value: (s) => s.minutes },
]

/** Resolve all badges against a stat snapshot. */
export function computeBadges(s: GameStats): Badge[] {
  return BADGES.map((b) => {
    const target = b.id === 'master' ? Math.max(1, s.totalSubjects) : b.target
    const value = b.value(s)
    return {
      id: b.id,
      title: b.title,
      desc: b.desc,
      iconKey: b.iconKey,
      tile: b.tile,
      target,
      value,
      unlocked: value >= target,
      pct: Math.min(100, Math.round((value / target) * 100)),
    }
  })
}

/** Ids of currently-unlocked badges (for reward diffing). */
export function unlockedBadgeIds(s: GameStats): string[] {
  return computeBadges(s)
    .filter((b) => b.unlocked)
    .map((b) => b.id)
}
