// ─── Feature visibility flags ───────────────────────────────────────────────
// Toggles for surfaces that are temporarily hidden from users while their
// underlying logic/data is kept intact. Flip a flag back to `true` to re-enable
// the feature with no other code changes.

/** Day-streak surfaces: streak chips, the 7-day calendar, streak badges. */
export const SHOW_STREAK = false

/** Daily-question goal + exam-date countdown surfaces (Test Arena & Setup). */
export const SHOW_GOALS = false

/** Badge ids tied to the streak feature - hidden from the grid when SHOW_STREAK is off. */
export const STREAK_BADGE_IDS = new Set(['consistent', 'onfire', 'unstoppable'])

/** Whether a badge should be hidden from display/celebration right now. */
export function isHiddenBadge(id: string): boolean {
  return !SHOW_STREAK && STREAK_BADGE_IDS.has(id)
}
