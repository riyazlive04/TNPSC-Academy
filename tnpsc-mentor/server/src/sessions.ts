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

/** Best-effort friendly label from a User-Agent ("Chrome on Windows"). */
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
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /android/i.test(ua)
      ? 'Android'
      : /iphone|ipad|ios/i.test(ua)
        ? 'iOS'
        : /macintosh|mac os/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} on ${os}` : browser
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
 * Register a device at LOGIN. Returns `{ blocked: true }` when the account already
 * has MAX_DEVICES active sessions on OTHER devices. The same device re-logging in
 * always reuses its slot. A missing deviceId (legacy client) is never blocked.
 */
export async function registerLoginSession(
  userId: string,
  deviceId: string,
  label: string | null
): Promise<{ blocked: boolean }> {
  if (!deviceId) return { blocked: false }

  const { data: existing } = await supabaseAdmin
    .from('user_sessions')
    .select('id, revoked_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()

  // This device already holds an active slot → just heartbeat.
  if (existing && !existing.revoked_at) {
    await supabaseAdmin
      .from('user_sessions')
      .update({ last_seen_at: now(), label })
      .eq('id', existing.id)
    return { blocked: false }
  }

  // New (or previously revoked) device → enforce the limit against other devices.
  if ((await activeCount(userId, deviceId)) >= MAX_DEVICES) return { blocked: true }

  // Reactivate a revoked row or insert a fresh one.
  await supabaseAdmin.from('user_sessions').upsert(
    { user_id: userId, device_id: deviceId, label, last_seen_at: now(), created_at: now(), revoked_at: null },
    { onConflict: 'user_id,device_id' }
  )
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
  deviceId: string,
  label: string | null
): Promise<{ revoked: boolean }> {
  if (!deviceId) return { revoked: false }
  const { data: existing } = await supabaseAdmin
    .from('user_sessions')
    .select('id, revoked_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (existing?.revoked_at) return { revoked: true }
  if (existing) {
    await supabaseAdmin.from('user_sessions').update({ last_seen_at: now(), label }).eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('user_sessions')
      .insert({ user_id: userId, device_id: deviceId, label, last_seen_at: now() })
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
    .select('id, device_id, label, created_at, last_seen_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('last_seen_at', ttlSince())
    .order('last_seen_at', { ascending: false })
  return (data ?? []).map((d) => ({
    ...(d as DeviceSession),
    current: !!currentSessionId && (d as DeviceSession).device_id === currentSessionId,
  }))
}
