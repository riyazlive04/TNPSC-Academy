import { supabaseAdmin } from '../supabase.js'
import { notifyUser } from '../notify.js'

// ─── "A lead just arrived" — off-screen ──────────────────────────────────────
// The desk's own arrival popup only fires while /crm is open AND visible: the
// poll behind it deliberately freezes on a hidden tab, which is right for
// battery and wrong for a telecaller who has switched apps. This is the other
// half — a Web Push / in-app notification that reaches them with the tab shut.
//
// Fired from the signup paths rather than from a database trigger, because
// Postgres cannot send a push and the server is the only thing that can.

/** Cache the roster briefly: a signup burst would otherwise re-read profiles
 *  once per registration to find the same two or three agents. */
const ROSTER_TTL_MS = 60_000
let roster: { ids: string[]; expires: number } | null = null

async function telecallerIds(): Promise<string[]> {
  if (roster && roster.expires > Date.now()) return roster.ids
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'telecaller')
  if (error) {
    console.warn('[crmAlerts] roster read failed:', error.message)
    return roster?.ids ?? []
  }
  const ids = (data ?? []).map((r) => String(r.id))
  roster = { ids, expires: Date.now() + ROSTER_TTL_MS }
  return ids
}

/**
 * Tell every telecaller that a fresh lead is waiting.
 *
 * Best-effort and never awaited by the caller: a registration must not fail, or
 * even slow down, because a push did not go out. The 2026-08 signup collapse is
 * a standing reminder that anything bolted onto /register has to be incapable
 * of breaking it.
 */
export function notifyNewLead(name: string | null, targetGroup?: string | null): void {
  void (async () => {
    try {
      const ids = await telecallerIds()
      if (ids.length === 0) return // nobody to tell; skip the work entirely

      const who = (name ?? '').trim() || 'Someone'
      const what = targetGroup ? ` · ${targetGroup}` : ''
      await Promise.all(
        ids.map((id) =>
          notifyUser(id, {
            title: 'New lead',
            body: `${who} just signed up${what}. Call while they are still on the app.`,
            url: '/crm',
            push: true,
          })
        )
      )
    } catch (e) {
      console.warn('[crmAlerts] notify failed:', e instanceof Error ? e.message : e)
    }
  })()
}

/** Clear the cached roster — call after a role change so a newly appointed
 *  telecaller starts receiving alerts without waiting out the TTL. */
export function invalidateTelecallerRoster(): void {
  roster = null
}
