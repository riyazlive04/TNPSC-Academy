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
