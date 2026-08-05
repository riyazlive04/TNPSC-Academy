// ─── Audit + security event trail ────────────────────────────────────────────
// The write side of supabase/audit_log.sql. Everything that could later matter
// to a breach investigation goes through here: admin actions, auth events, and
// the detectors in lib/securityAlerts.ts.
//
// THREE RULES, all of them load-bearing:
//
//  1. NEVER throw into a request. An audit write failing must not 500 a user's
//     sign-in. Every helper swallows its error and reports it to stderr, where
//     PM2 captures it (see deploy/logrotate-tnpsc for the 90-day retention the
//     Privacy Policy promises).
//  2. NEVER block the response. Writes are fire-and-forget; the caller does not
//     await them.
//  3. NEVER log a secret. `redact()` is applied to every body/query before it
//     reaches the DB, because the trail is readable by superadmins and is
//     exactly the kind of table an attacker would go looking in.

import { supabaseAdmin } from '../supabase.js'
import type { Request } from 'express'

export type AuditCategory = 'admin' | 'auth' | 'security' | 'data'

export interface AuditEntry {
  category: AuditCategory
  /** Stable machine-readable name — alerts and queries match on this. */
  action: string
  actorId?: string | null
  actorRole?: string | null
  /** The user whose data was touched, when the request names one. */
  subjectId?: string | null
  status?: number | null
  ip?: string | null
  userAgent?: string | null
  detail?: Record<string, unknown>
}

/**
 * Keys whose VALUE is never safe to persist. Matched case-insensitively as a
 * substring, so `password`, `newPassword`, `razorpay_signature`, `id_token` and
 * `otpTicket` are all caught by the short list below.
 */
const SECRET_KEY = /pass|token|secret|otp|signature|auth|key|credential|cookie|session_id/i

/** Values longer than this are truncated — the trail is evidence, not a mirror. */
const MAX_VALUE_LEN = 200

/**
 * Deep-copy a request body/query with secret values replaced by '[redacted]'.
 * Unknown shapes are stringified defensively: this runs on attacker-controlled
 * input, so it must not be possible to make it throw or recurse forever.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 4) return '[deep]'
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LEN ? `${value.slice(0, MAX_VALUE_LEN)}…` : value
  }
  return value
}

/** Client IP as seen through Nginx (`trust proxy` is set in index.ts). */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? ''
}

/** User-agent, truncated — a long UA is not worth 2 KB per row. */
export function clientUa(req: Request): string {
  const ua = req.headers['user-agent']
  return typeof ua === 'string' ? ua.slice(0, 300) : ''
}

/**
 * Write one entry. Fire-and-forget: callers do NOT await this, and a failure is
 * reported to stderr rather than propagated.
 */
export function audit(entry: AuditEntry): void {
  void supabaseAdmin
    .from('audit_log')
    .insert({
      category: entry.category,
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_role: entry.actorRole ?? null,
      subject_id: entry.subjectId ?? null,
      status: entry.status ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      detail: (redact(entry.detail ?? {}) as Record<string, unknown>) ?? {},
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[audit] write failed', entry.category, entry.action, error.message)
      }
    })
}

/**
 * Record an authentication event. This is the trail that answers "was this
 * account accessed by someone else, and from where" — the single most common
 * question in a breach triage, and one we previously could not answer at all
 * (GoTrue's own auth.audit_log_entries table is empty in this project).
 *
 * `subjectId` is the account involved. It is deliberately nullable: a failed
 * sign-in for an address that doesn't exist has no user id, and looking one up
 * to fill this in would build the account-enumeration oracle the login handler
 * is careful not to expose.
 */
export function auditAuth(
  req: Request,
  action:
    | 'login_success'
    | 'login_failed'
    | 'login_device_limit'
    | 'login_device_replaced'
    | 'register_success'
    | 'register_rejected'
    | 'logout'
    | 'password_reset_requested'
    | 'oauth_login_success',
  opts: { subjectId?: string | null; status?: number; detail?: Record<string, unknown> } = {}
): void {
  audit({
    category: 'auth',
    action,
    subjectId: opts.subjectId ?? null,
    status: opts.status ?? null,
    ip: clientIp(req),
    userAgent: clientUa(req),
    detail: opts.detail,
  })
}

// ─── Retention ───────────────────────────────────────────────────────────────
// The policy's "up to 90 days" for technical/security logs is only true if
// something actually deletes them. prune_audit_log() (audit_log.sql) does the
// deleting; this runs it daily from the API process rather than depending on
// pg_cron, which is not enabled on every Supabase plan.

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000

async function pruneOnce(): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc('prune_audit_log')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] prune failed', error.message)
    return
  }
  if (typeof data === 'number' && data > 0) {
    // eslint-disable-next-line no-console
    console.log(`[audit] pruned ${data} expired rows`)
  }
}

/** Start the daily retention sweep. Called once at boot from index.ts. */
export function startAuditRetention(): void {
  void pruneOnce()
  // unref() so a pending timer never holds the process open during a restart.
  setInterval(() => void pruneOnce(), PRUNE_INTERVAL_MS).unref()
}
