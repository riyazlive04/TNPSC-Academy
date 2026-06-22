// ─── XP & levels ────────────────────────────────────────────────────────────
// A light progression layer derived entirely from existing analytics - no new
// tables. XP rewards correct answers most, attempts a little, and finishing
// tests. Levels use a gently escalating curve.

export interface XpStats {
  totalCorrect: number
  totalQuestions: number
  testsTaken: number
}

export interface LevelInfo {
  level: number
  title: string
  xp: number
  into: number // xp accumulated within the current level
  span: number // xp required to clear the current level
  pct: number // 0-100 progress to the next level
  toNext: number // xp remaining to next level
}

/** Total lifetime XP. */
export function computeXp(s: XpStats): number {
  const wrong = Math.max(0, s.totalQuestions - s.totalCorrect)
  return s.totalCorrect * 10 + wrong * 2 + s.testsTaken * 25
}

const TITLES: ReadonlyArray<readonly [number, string]> = [
  [18, 'Legend'],
  [13, 'Master'],
  [9, 'Achiever'],
  [5, 'Scholar'],
  [3, 'Aspirant'],
  [1, 'Beginner'],
]

export function titleForLevel(level: number): string {
  return TITLES.find(([lvl]) => level >= lvl)?.[1] ?? 'Beginner'
}

/** Resolve a lifetime XP total into level + progress. */
// Hard ceiling on the level walk so a corrupted/huge XP value can't spin the
// loop forever. At a 1.35x span growth this is far beyond any reachable level.
const MAX_LEVEL = 999

export function levelInfo(xp: number): LevelInfo {
  let level = 1
  let acc = 0
  let span = 100
  while (xp >= acc + span && level < MAX_LEVEL) {
    acc += span
    level += 1
    span = Math.round(span * 1.35)
  }
  const into = xp - acc
  return {
    level,
    title: titleForLevel(level),
    xp,
    into,
    span,
    pct: Math.min(100, Math.round((into / span) * 100)),
    toNext: Math.max(0, span - into),
  }
}
