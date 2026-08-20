import {
  useAuthStore,
  selectIsSuperAdmin,
  selectProfileNeedsOnboarding,
} from '../store/authStore'
import { useLanguageStore } from '../store/languageStore'

/**
 * Resolve where to send a user immediately after a successful sign-in. Shared by
 * the email/password login and the Google button so both honour the same rules:
 *
 *  1. Profile missing target group / phone (a fresh Google signup) → onboarding.
 *  2. Superadmins → their console.
 *  3. A deep link the user was bounced from (unless it's the arena default).
 *  4. Otherwise the arena, or the one-time language screen if not chosen yet.
 *
 * Reads the live store state, so call it AFTER the sign-in action has resolved.
 */
export function postAuthDestination(fromPath?: string): string {
  const state = useAuthStore.getState()
  if (selectProfileNeedsOnboarding(state)) return '/complete-profile'
  if (selectIsSuperAdmin(state)) return '/superadmin'
  if (fromPath && fromPath !== '/test-arena') return fromPath
  const langAlreadySet = useLanguageStore.getState().lang !== null
  return langAlreadySet ? '/test-arena' : '/language'
}

/** Landing pages where a successful auth should resume checkout immediately
 *  rather than dropping the user back on the page cold. */
const AUTO_ENROLL_PATHS = new Set(['/rank-booster'])

export function isAutoEnrollPath(fromPath?: string): boolean {
  return !!fromPath && AUTO_ENROLL_PATHS.has(fromPath)
}

/**
 * Router state to pass alongside postAuthDestination(fromPath). Two jobs:
 *
 *  - Landing straight on an auto-enroll page (e.g. /rank-booster) → tells it
 *    to resume checkout immediately instead of waiting for a second "Enroll"
 *    tap right when intent was highest.
 *  - Landing on /complete-profile instead (a fresh Google signup still needs
 *    a phone number) → carries the ORIGINAL fromPath forward as the same
 *    `{ from: { pathname } }` shape login/register already read from
 *    location.state, so CompleteProfilePage's own postAuthDestination() call
 *    at the end still resolves back to the intended page — otherwise the
 *    deep link is lost the moment onboarding gets in the way.
 */
export function postAuthState(
  fromPath?: string
): { autoEnroll: true } | { from: { pathname: string } } | undefined {
  const dest = postAuthDestination(fromPath)
  if (fromPath && dest === fromPath && isAutoEnrollPath(fromPath)) return { autoEnroll: true }
  if (dest === '/complete-profile' && fromPath) return { from: { pathname: fromPath } }
  return undefined
}
