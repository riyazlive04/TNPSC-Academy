// ─── Concurrent-session limiting ────────────────────────────────────────────
// Track active device sessions per account so a login can be capped at MAX_DEVICES
// simultaneous devices (anti credential-sharing). All writes go through the
// service-role client; the browser only ever reads its own rows (RLS).

import { supabaseAdmin } from './supabase.js'

export const MAX_DEVICES = 2
// A session not seen within this window stops counting, so a device that was just
// closed (never signed out) eventually frees its slot instead of locking the user
// out of their own account forever.
const IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const now = () => new Date().toISOString()
const ttlSince = () => new Date(Date.now() - IDLE_TTL_MS).toISOString()

/**
 * Extract the GoTrue `session_id` claim from a Supabase access token. The token is
 * minted and signed by Supabase, so — unlike the `device_id` the browser sends —
 * the caller cannot forge or reuse this value: it identifies the ACTUAL auth
 * session, so the device cap binds to real sessions, not a client string. Decode
 * only (no signature check): the caller has already verified the token (we either
 * just minted it, or requireAuth validated it via getUser). Returns '' for a
 * malformed token or one predating session_id claims (→ caller falls back).
 */
export function sessionIdFromToken(accessToken: string | undefined | null): string {
  if (!accessToken) return ''
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return ''
    const json = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8')
    const claims = JSON.parse(json) as { session_id?: unknown }
    return typeof claims.session_id === 'string' ? claims.session_id : ''
  } catch {
    return ''
  }
}

/**
 * Best-effort friendly label from a User-Agent ("Chrome on iPhone").
 *
 * The OS check distinguishes iPad / iPhone / iPod / Android individually (the old
 * label lumped them all into "iOS"/"Android"), so the device list can tell a
 * tablet from a phone. One inherent limit we can't beat server-side: iPadOS 13+
 * Safari masquerades as a desktop ("Macintosh") by default, so most iPads report
 * as "Safari on Mac" — only the rare iPad that keeps the legacy "iPad" UA token
 * is detected as a tablet here.
 */
export function deviceLabel(ua?: string): string | null {
  if (!ua) return null
  const browser = /edg/i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /ipad/i.test(ua)
    ? 'iPad'
    : /iphone/i.test(ua)
      ? 'iPhone'
      : /ipod/i.test(ua)
        ? 'iPod'
        : /android/i.test(ua)
          ? 'Android'
          : /windows/i.test(ua)
            ? 'Windows'
            : /cros/i.test(ua)
              ? 'ChromeOS'
              : /macintosh|mac os/i.test(ua)
                ? 'Mac'
                : /linux/i.test(ua)
                  ? 'Linux'
                  : ''
  return os ? `${browser} on ${os}` : browser
}

export type ClientPlatform = 'web' | 'android' | 'ios'

/**
 * The platform our own client sends on every request (Capacitor.getPlatform(),
 * see src/lib/api.ts) — trustworthy since it's not user-agent guesswork. Null
 * for a pre-upgrade client that doesn't send the header yet.
 */
export function clientPlatform(req: { headers: Record<string, unknown> }): ClientPlatform | null {
  const raw = req.headers['x-client-platform']
  const v = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined
  return v === 'web' || v === 'android' || v === 'ios' ? v : null
}

/** Active (not revoked, seen within TTL) session count, optionally excluding one device. */
async function activeCount(userId: string, excludeDeviceId?: string): Promise<number> {
  let q = supabaseAdmin
    .from('user_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('last_seen_at', ttlSince())
  if (excludeDeviceId) q = q.neq('device_id', excludeDeviceId)
  const { count } = await q
  return count ?? 0
}

/**
 * Revoke a browser's OWN earlier active sessions before it claims a new slot.
 *
 * Every login mints a fresh GoTrue `session_id` (our `sessionKey`), so a user who
 * just closes the tab without signing out leaves a stale active row behind. The
 * next login from the SAME browser would otherwise count as a brand-new device
 * and — after two — trip the cap on a single browser (the exact "you're logged in
 * elsewhere but it's the same browser" bug). Matching on the stable client
 * `device_id` the browser sends collapses those repeat logins into one slot, so
 * the limit counts DISTINCT devices, not accumulated login sessions. No-op when
 * the client sent no stable id (legacy build / private-mode storage blocked).
 */
async function revokeSameDevice(
  userId: string,
  clientDeviceId: string,
  keepSessionKey: string
): Promise<void> {
  if (!clientDeviceId) return
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: now() })
    .eq('user_id', userId)
    .eq('client_device_id', clientDeviceId)
    .neq('device_id', keepSessionKey)
    .is('revoked_at', null)
}

/**
 * Register a device at LOGIN. Returns `{ blocked: true }` when the account already
 * has MAX_DEVICES active sessions on OTHER devices. The same device re-logging in
 * always reuses its slot. A missing sessionKey (legacy client) is never blocked.
 *
 * `sessionKey` is the unforgeable GoTrue session_id (stored in device_id), kept as
 * the cap-binding key. `clientDeviceId` is the browser's stable localStorage id,
 * recorded so repeat logins from one browser dedupe to a single slot.
 */
export async function registerLoginSession(
  userId: string,
  sessionKey: string,
  clientDeviceId: string,
  label: string | null,
  platform: ClientPlatform | null = null
): Promise<{ blocked: boolean }> {
  if (!sessionKey) return { blocked: false }

  // Free any slot this same browser is still holding from an earlier login, so a
  // re-login here replaces it instead of stacking a second "device".
  await revokeSameDevice(userId, clientDeviceId, sessionKey)

  const { data: existing } = await supabaseAdmin
    .from('user_sessions')
    .select('id, revoked_at, platform')
    .eq('user_id', userId)
    .eq('device_id', sessionKey)
    .maybeSingle()

  // This session already holds an active slot → just heartbeat. Coalesce onto
  // the known platform so a stray call from a stale cached client (no header
  // yet) can't null out a value an earlier call already established.
  if (existing && !existing.revoked_at) {
    await supabaseAdmin
      .from('user_sessions')
      .update({
        last_seen_at: now(),
        label,
        client_device_id: clientDeviceId || null,
        platform: platform ?? existing.platform,
      })
      .eq('id', existing.id)
    return { blocked: false }
  }

  // New (or previously revoked) device → enforce the limit against other devices.
  // NOTE: this check-then-act is NOT atomic. Two simultaneous logins on two new
  // devices can both read activeCount < MAX_DEVICES and both insert, briefly
  // overshooting the cap. There is no SECURITY DEFINER registration RPC to defer
  // to, and supabase-js can't express a conditional insert in one round-trip, so
  // we tighten with a post-insert re-check: after claiming the slot we recount
  // OTHER active devices and, if the account is now over the cap (another login
  // raced us), we roll our own row back and report blocked. This collapses the
  // window to a brief over-count that self-heals instead of a durable breach.
  if ((await activeCount(userId, sessionKey)) >= MAX_DEVICES) return { blocked: true }

  // Reactivate a revoked row or insert a fresh one.
  await supabaseAdmin.from('user_sessions').upsert(
    {
      user_id: userId,
      device_id: sessionKey,
      client_device_id: clientDeviceId || null,
      label,
      platform: platform ?? existing?.platform ?? null,
      last_seen_at: now(),
      created_at: now(),
      revoked_at: null,
    },
    { onConflict: 'user_id,device_id' }
  )

  // Re-check after the write: if a concurrent login pushed OTHER devices to the
  // cap while we were inserting, undo our own claim so we don't exceed MAX_DEVICES.
  if ((await activeCount(userId, sessionKey)) >= MAX_DEVICES) {
    await supabaseAdmin
      .from('user_sessions')
      .update({ revoked_at: now() })
      .eq('user_id', userId)
      .eq('device_id', sessionKey)
      .is('revoked_at', null)
    return { blocked: true }
  }
  return { blocked: false }
}

/**
 * Heartbeat on refresh/boot. Upserts the row (creating one lazily for sessions that
 * predate this feature) and bumps last_seen. Returns `{ revoked: true }` when the
 * device's session was explicitly revoked (remote sign-out) so the caller can 401.
 * Does NOT enforce the device count — enforcement happens only at login, so
 * shipping this never logs existing users out.
 */
export async function touchSession(
  userId: string,
  sessionKey: string,
  clientDeviceId: string,
  label: string | null,
  platform: ClientPlatform | null = null
): Promise<{ revoked: boolean }> {
  if (!sessionKey) return { revoked: false }
  const { data: existing } = await supabaseAdmin
    .from('user_sessions')
    .select('id, revoked_at, platform')
    .eq('user_id', userId)
    .eq('device_id', sessionKey)
    .maybeSingle()
  if (existing?.revoked_at) return { revoked: true }
  // Persisting client_device_id/platform here backfills them onto rows that
  // predate the columns, so a browser's stale duplicate slots can be deduped
  // and older sessions eventually pick up their platform on the next refresh.
  // Coalesced onto the known value so a stale cached client (no header yet)
  // can't null out a platform an earlier call already established.
  if (existing) {
    await supabaseAdmin
      .from('user_sessions')
      .update({
        last_seen_at: now(),
        label,
        client_device_id: clientDeviceId || null,
        platform: platform ?? existing.platform,
      })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('user_sessions')
      .insert({
        user_id: userId,
        device_id: sessionKey,
        client_device_id: clientDeviceId || null,
        label,
        platform,
        last_seen_at: now(),
      })
  }
  return { revoked: false }
}

/** Revoke this device's session at logout (frees a slot). */
export async function revokeSession(userId: string, deviceId: string): Promise<void> {
  if (!deviceId) return
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: now() })
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .is('revoked_at', null)
}

/**
 * Revoke a session by its device_id WITHOUT a userId. Used by logout when the
 * access token is already expired (getUser fails), so we can't resolve the owner
 * — but the caller possesses the device's session key, which is enough to free
 * that one slot. The match is on the exact device_id (the unforgeable session_id
 * for modern clients), so it can only revoke the row that key owns.
 */
export async function revokeSessionByDeviceId(deviceId: string): Promise<void> {
  if (!deviceId) return
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: now() })
    .eq('device_id', deviceId)
    .is('revoked_at', null)
}

/** Revoke a session by id (manage-devices screen). Scoped to the owner. */
export async function revokeSessionById(userId: string, id: string): Promise<void> {
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: now() })
    .eq('user_id', userId)
    .eq('id', id)
}

export interface DeviceSession {
  id: string
  device_id: string
  label: string | null
  platform: ClientPlatform | null
  created_at: string
  last_seen_at: string
  /** True for the row matching the requester's own session (set by listSessions
   * when a current session id is supplied). Lets the UI mark "this device" and
   * exclude it from the sign-out-others list without trusting a client value. */
  current?: boolean
}

/**
 * Active sessions for the manage-devices screen, newest activity first.
 * When `currentSessionId` (the GoTrue session_id, now stored in `device_id`) is
 * supplied, the matching row is flagged `current: true`.
 */
export async function listSessions(
  userId: string,
  currentSessionId?: string
): Promise<DeviceSession[]> {
  const { data } = await supabaseAdmin
    .from('user_sessions')
    .select('id, device_id, label, platform, created_at, last_seen_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('last_seen_at', ttlSince())
    .order('last_seen_at', { ascending: false })
  return (data ?? []).map((d) => ({
    ...(d as DeviceSession),
    current: !!currentSessionId && (d as DeviceSession).device_id === currentSessionId,
  }))
}
