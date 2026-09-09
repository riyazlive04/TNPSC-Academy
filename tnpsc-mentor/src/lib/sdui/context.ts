// ─── Server-driven UI: the audience context ──────────────────────────────────
// The one place a layout is allowed to see app state. Every field a `when`
// clause can test is assembled here, from stores the app already keeps, and
// nothing else is reachable from a layout — that is what stops a published row
// from becoming a way to read arbitrary client state.
//
// This is also what makes SDUI worth having over a static screen: the SAME
// published layout can show a Tamil free user on Android a different banner
// than an English paying user on the web, decided on the device with no extra
// round trip and no reload when a payment lands.

import { useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuthStore, selectIsAdmin, selectIsSuperAdmin } from '../../store/authStore'
import { useLanguageStore } from '../../store/languageStore'
import { useEntitlementsStore } from '../../store/entitlementsStore'
import { useCreditsStore } from '../../store/creditsStore'

/**
 * Progress facts the app only knows after a fetch (analytics, the habit strip).
 * A slot's host page passes in whatever it has already loaded for its own use —
 * see TestArenaPage, which has both on hand — rather than every banner paying
 * for a round trip of its own. Absent signals read as 0, so a condition on them
 * simply doesn't match: a layout can never be MORE visible for missing data.
 */
export interface SduiSignals {
  tests_taken?: number
  streak?: number
  days_since_signup?: number
}

export interface SduiContext {
  lang: 'en' | 'ta' | 'both'
  platform: 'web' | 'android' | 'ios'
  app_version: string
  role: 'guest' | 'user' | 'admin' | 'superadmin'
  premium: boolean
  vettri: boolean
  unlimited: boolean
  rank_booster: boolean
  mock_pack: boolean
  signed_in: boolean
  credits: number
  tests_taken: number
  streak: number
  days_since_signup: number
  hour: number
  /** First name, for the one binding a layout may interpolate into copy. */
  name: string
}

/**
 * The native versionName, read once at boot and parked here. Module-level
 * rather than state because it cannot change while the app runs, and every
 * condition evaluation would otherwise pay for an async plugin call.
 *
 * Empty on the web build, where `app_version` conditions never match — correct,
 * since a version window exists to protect older NATIVE installs from a layout
 * that names a component they don't ship.
 */
let nativeVersion = ''

/** Called once from the native bootstrap (hooks/useNativeBootstrap). */
export function setSduiAppVersion(v: string | null): void {
  nativeVersion = v ?? ''
}

/** What the client reports to the server so it can pick a matching row. */
export function sduiClientParams(): { platform: string; v: string } {
  return { platform: Capacitor.getPlatform(), v: nativeVersion }
}

/** IST hour (0-23). The app's day boundary is IST everywhere else (credits,
 *  streaks, the study gate), so a "revise tonight" banner uses the same clock. */
function istHour(): number {
  const utcMs = Date.now() + new Date().getTimezoneOffset() * 60_000
  return new Date(utcMs + 5.5 * 60 * 60_000).getHours()
}

/**
 * Build the context for the current render. Subscribes to each store, so a
 * layout re-evaluates its conditions the moment a payment lands or the language
 * changes — a paywall banner disappears without a reload, like the app's other
 * gates.
 */
export function useSduiContext(signals?: SduiSignals): SduiContext {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = useAuthStore(selectIsAdmin)
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)
  const lang = useLanguageStore((s) => s.lang)
  const premium = useEntitlementsStore((s) => s.premium)
  const vettri = useEntitlementsStore((s) => s.vettri)
  const unlimited = useEntitlementsStore((s) => s.unlimited)
  const rankBooster = useEntitlementsStore((s) => s.rankBooster)
  const mockPack = useEntitlementsStore((s) => s.mockPack)
  const credits = useCreditsStore((s) => s.balance)
  const creditsUnlimited = useCreditsStore((s) => s.unlimited)

  const testsTaken = signals?.tests_taken ?? 0
  const streak = signals?.streak ?? 0
  const daysSinceSignup = signals?.days_since_signup ?? 0

  return useMemo(
    () => ({
      lang: lang ?? 'en',
      platform: Capacitor.getPlatform() as 'web' | 'android' | 'ios',
      app_version: nativeVersion,
      role: !user ? 'guest' : isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : 'user',
      premium,
      vettri,
      // Staff and paid accounts both read as unlimited to the credit meter;
      // a "you're out of credits" banner must not fire for either.
      unlimited: unlimited || creditsUnlimited,
      rank_booster: rankBooster,
      mock_pack: mockPack,
      signed_in: Boolean(user),
      credits,
      tests_taken: testsTaken,
      streak,
      days_since_signup: daysSinceSignup,
      hour: istHour(),
      name: profile?.full_name?.trim().split(/\s+/)[0] ?? '',
    }),
    [
      lang,
      user,
      profile,
      isAdmin,
      isSuperAdmin,
      premium,
      vettri,
      unlimited,
      creditsUnlimited,
      rankBooster,
      mockPack,
      credits,
      testsTaken,
      streak,
      daysSinceSignup,
    ]
  )
}
