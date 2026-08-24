// ─── Security detectors + alerting ───────────────────────────────────────────
// Detection is the half of the Privacy Policy's §10 breach promise that used to
// be missing: the app could be scraped, brute-forced or accessed with a stolen
// admin token and nobody would have learned about it until a user complained.
//
// This module watches the signals the API already produces — failed sign-ins,
// 403s, 429s, 5xx, privileged actions — and does two things when one of them
// looks abnormal:
//
//   1. writes a `security` row to audit_log (the durable record), and
//   2. pushes a message to the operator's Telegram, if configured, so a human
//      finds out in minutes rather than at the next dashboard visit.
//
// Deliberately in-process and dependency-free. A single API instance runs on the
// VPS (deploy/ecosystem.config.cjs, instances: 1), so an in-memory counter sees
// every request. If that ever becomes a cluster, these counters must move to the
// database or Redis — otherwise each worker counts only its own share and the
// thresholds silently stop firing.

import { config } from '../config.js'
import { audit } from './audit.js'

/** A rolling counter: event timestamps per key, oldest pruned on read. */
type Window = Map<string, number[]>

/**
 * Cap on tracked keys per detector. Keys are attacker-controlled (an IP per
 * packet), so an uncapped map is a memory-exhaustion bug waiting to happen.
 * When full we drop the least recently touched half.
 */
const MAX_KEYS = 5_000

function bump(win: Window, key: string, windowMs: number): number {
  const now = Date.now()
  if (win.size > MAX_KEYS) {
    // Map preserves insertion order; the first half is the stalest.
    let dropped = 0
    for (const k of win.keys()) {
      win.delete(k)
      if (++dropped >= MAX_KEYS / 2) break
    }
  }
  const hits = (win.get(key) ?? []).filter((t) => now - t < windowMs)
  hits.push(now)
  win.set(key, hits)
  return hits.length
}

// ─── Thresholds ──────────────────────────────────────────────────────────────
// Tuned to sit well above ordinary use (a real person mistypes a password three
// or four times, not thirty) and well below the volume an automated attack
// produces. Raise one only after checking audit_log for what actually tripped it.

const RULES = {
  /** Failed sign-ins from one IP. Credential stuffing / password spraying. */
  authFailurePerIp: { windowMs: 10 * 60_000, threshold: 10 },
  /** Failed sign-ins across all IPs — a distributed attempt no single IP shows. */
  authFailureGlobal: { windowMs: 10 * 60_000, threshold: 60 },
  /** 403s from one IP: someone poking at admin/superadmin routes they can't use. */
  forbiddenPerIp: { windowMs: 10 * 60_000, threshold: 15 },
  /** Sustained rate-limiting of one IP — scraping, not a stuck retry loop. */
  rateLimitedPerIp: { windowMs: 10 * 60_000, threshold: 60 },
  /** Server errors overall. A 5xx spike often IS the incident, or precedes it. */
  serverErrorGlobal: { windowMs: 5 * 60_000, threshold: 25 },
  /**
   * Postgres statement-timeout (57014) or an outbound Supabase call that
   * exhausted all its network retries. Unlike the noisy 403/429/generic-5xx
   * counters above, EITHER of these means the DB/infra itself is struggling —
   * worth paging on a handful of occurrences, not 25. (2026-08-22: a
   * full-table-scan bug in two RPCs caused ~332 of these over 6 days before
   * anyone noticed, because the generic 25-in-5-minutes rule never tripped on
   * a slow drip. See supabase/fix_quiz_scan_perf.sql.)
   */
  infraDegraded: { windowMs: 15 * 60_000, threshold: 3 },
} as const

const windows: Record<keyof typeof RULES, Window> = {
  authFailurePerIp: new Map(),
  authFailureGlobal: new Map(),
  forbiddenPerIp: new Map(),
  rateLimitedPerIp: new Map(),
  serverErrorGlobal: new Map(),
  infraDegraded: new Map(),
}

// ─── Alert delivery ──────────────────────────────────────────────────────────

/** Minimum gap between two alerts with the same key — stops a flood re-alerting
 *  every request once a threshold is crossed. */
const ALERT_COOLDOWN_MS = 15 * 60_000
const lastSent = new Map<string, number>()

const TG_API = 'https://api.telegram.org'

/** Post the alert to Telegram. Best-effort: never throws, never awaited by a
 *  request handler. Silent no-op when no alert chat is configured. */
async function notifyOperator(text: string): Promise<void> {
  if (!securityAlertsEnabled) return
  try {
    const r = await fetch(`${TG_API}/bot${config.securityAlertBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.securityAlertChatId,
        text,
        disable_web_page_preview: true,
      }),
    })
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error('[security] alert delivery failed', r.status, await r.text())
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[security] alert delivery threw', (e as Error).message)
  }
}

/** True when a bot token AND a destination chat are configured. */
export const securityAlertsEnabled = Boolean(
  config.securityAlertBotToken && config.securityAlertChatId
)

/**
 * Raise a security event: durable row in audit_log, plus an operator ping.
 * `key` is what the cooldown de-duplicates on — include the IP so two different
 * attackers don't suppress each other's alerts.
 */
export function raise(
  action: string,
  key: string,
  summary: string,
  detail: Record<string, unknown> = {}
): void {
  audit({
    category: 'security',
    action,
    ip: typeof detail.ip === 'string' ? detail.ip : null,
    detail: { ...detail, summary },
  })
  // eslint-disable-next-line no-console
  console.error(`[security] ${action} — ${summary}`)

  const dedupe = `${action}:${key}`
  const last = lastSent.get(dedupe) ?? 0
  if (Date.now() - last < ALERT_COOLDOWN_MS) return
  lastSent.set(dedupe, Date.now())

  void notifyOperator(
    `🚨 TNPSC Mentors — ${action}\n\n${summary}\n\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Check: audit_log (category='security') and the superadmin console.\n` +
      `If this looks like a personal-data breach, open docs/BREACH_RESPONSE.md — ` +
      `the DPDP clock starts now.`
  )
}

// ─── Detectors ───────────────────────────────────────────────────────────────

/** Called on every failed sign-in attempt (wrong password, bad OTP, blocked). */
export function recordAuthFailure(ip: string, detail: Record<string, unknown> = {}): void {
  const rule = RULES.authFailurePerIp
  const perIp = bump(windows.authFailurePerIp, ip || 'unknown', rule.windowMs)
  if (perIp === rule.threshold) {
    raise(
      'auth_failure_burst',
      ip,
      `${perIp} failed sign-in attempts from ${ip || 'an unknown IP'} in ${rule.windowMs / 60_000} minutes.`,
      { ip, ...detail }
    )
  }

  const g = RULES.authFailureGlobal
  const global = bump(windows.authFailureGlobal, 'all', g.windowMs)
  if (global === g.threshold) {
    raise(
      'auth_failure_spike',
      'all',
      `${global} failed sign-ins across all IPs in ${g.windowMs / 60_000} minutes — possible distributed credential stuffing.`,
      {}
    )
  }
}

/** Called for every 403 — the shape of someone testing an admin route. */
export function recordForbidden(ip: string, path: string): void {
  const rule = RULES.forbiddenPerIp
  const n = bump(windows.forbiddenPerIp, ip || 'unknown', rule.windowMs)
  if (n === rule.threshold) {
    raise(
      'authz_probe',
      ip,
      `${n} authorisation failures from ${ip || 'an unknown IP'} in ${rule.windowMs / 60_000} minutes (last: ${path}).`,
      { ip, path }
    )
  }
}

/** Called for every 429 — sustained rate-limiting means scraping, not a bug. */
export function recordRateLimited(ip: string, path: string): void {
  const rule = RULES.rateLimitedPerIp
  const n = bump(windows.rateLimitedPerIp, ip || 'unknown', rule.windowMs)
  if (n === rule.threshold) {
    raise(
      'rate_limit_abuse',
      ip,
      `${ip || 'An unknown IP'} hit the rate limit ${n} times in ${rule.windowMs / 60_000} minutes (last: ${path}).`,
      { ip, path }
    )
  }
}

/** Called for every 5xx. */
export function recordServerError(path: string, status: number): void {
  const rule = RULES.serverErrorGlobal
  const n = bump(windows.serverErrorGlobal, 'all', rule.windowMs)
  if (n === rule.threshold) {
    raise(
      'error_spike',
      'all',
      `${n} server errors in ${rule.windowMs / 60_000} minutes (last: ${status} ${path}).`,
      { path, status }
    )
  }
}

/**
 * Called when the CLIENT itself renders a 'server' or 'generic' error screen
 * (components/UI/ErrorState.tsx, ErrorBoundary's crash screen) — i.e. a real
 * person actually saw the failure, not just a status code in a log. Unlike
 * recordServerError's 25-in-5-minutes spike threshold, this alerts on the
 * FIRST occurrence of a given kind+path: a rare-but-real bug shouldn't need to
 * hit 25 users before anyone hears about it. `raise`'s own 15-minute per-key
 * cooldown is what keeps a recurring failure from paging on every retry.
 * Deliberately excludes 'network' — a user's own dropped connection isn't
 * something the team can act on.
 */
export function recordClientError(opts: {
  kind: 'server' | 'generic'
  path: string
  message: string
  status?: number
  userId?: string | null
  /** React's component tree at crash time (ErrorBoundary only) — kept out of the
   *  Telegram summary (too long to page on) but stored in audit_log.detail so a
   *  superadmin can actually find the component, not just the route. */
  componentStack?: string | null
}): void {
  const { kind, path, message, status, userId, componentStack } = opts
  raise(
    'client_error',
    `${kind}:${path}`,
    `A user hit a ${kind} error on ${path}${status ? ` (HTTP ${status})` : ''}: ${message}`,
    { kind, path, status, user_id: userId, component_stack: componentStack ?? undefined }
  )
}

/**
 * Called on a Postgres statement-timeout (57014) or an outbound Supabase call
 * that exhausted every retry — the two failure shapes behind "Failed to fetch"
 * / "can't reach server" reports. `reason` is a short machine tag ('db_timeout'
 * | 'supabase_unreachable'), `detail` is a one-line description for the alert.
 */
export function recordInfraDegraded(reason: string, detail: string): void {
  const rule = RULES.infraDegraded
  const n = bump(windows.infraDegraded, 'all', rule.windowMs)
  if (n === rule.threshold) {
    raise(
      'infra_degraded',
      'all',
      `${n} infra-level failures (DB statement timeouts / unreachable Supabase) in ` +
        `${rule.windowMs / 60_000} minutes — users are likely seeing "Failed to fetch" ` +
        `or "can't reach server". Last: ${reason} — ${detail}.`,
      { reason, detail }
    )
  }
}

/**
 * Privileged actions that are alerted the FIRST time they happen, not on a
 * threshold: each one either changes who has power over the data or moves data
 * out of the product, so a single unexpected occurrence is worth a look.
 */
const HIGH_RISK = [
  /^(POST|PATCH|PUT|DELETE) \/api\/superadmin\/users/i,
  /role/i,
  /grant|revoke/i,
  /delete/i,
  /export/i,
] as const

/** True when an admin API call is one of the high-risk shapes above. */
export function isHighRiskAction(action: string): boolean {
  return HIGH_RISK.some((re) => re.test(action))
}

/** Alert on a successful privileged action by an admin/superadmin. */
export function recordPrivilegedAction(opts: {
  action: string
  actorId?: string | null
  actorRole?: string | null
  subjectId?: string | null
  ip?: string
}): void {
  raise(
    'privileged_action',
    `${opts.actorId ?? 'unknown'}:${opts.action}`,
    `${opts.actorRole ?? 'admin'} ${opts.actorId ?? 'unknown'} performed ${opts.action}` +
      (opts.subjectId ? ` on user ${opts.subjectId}` : '') +
      '.',
    { ip: opts.ip, actor_id: opts.actorId, subject_id: opts.subjectId }
  )
}
