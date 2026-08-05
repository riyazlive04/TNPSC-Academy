// ─── Admin / superadmin action trail ─────────────────────────────────────────
// Mounted on /api/admin and /api/superadmin, so EVERY privileged call is
// recorded whether or not the individual handler remembers to log. That
// completeness is the point: an audit trail with per-handler opt-in is an audit
// trail with holes, and the holes are exactly where a rogue or compromised admin
// account operates.
//
// The superadmin console can list every user with their email and phone, read
// the feedback inbox, grant and revoke paid plans and delete accounts. All of
// that now leaves a row in audit_log naming the actor, the target, the outcome
// and the IP. High-risk shapes additionally page the operator immediately.

import type { NextFunction, Response } from 'express'
import type { AuthedRequest } from './auth.js'
import { roleOf } from './auth.js'
import { audit, clientIp, clientUa, redact } from '../lib/audit.js'
import { isHighRiskAction, recordPrivilegedAction } from '../lib/securityAlerts.js'

/**
 * The user this request is ABOUT, if it names one. Checked in specificity
 * order — an explicit user id in the body beats a generic `:id` route param,
 * which may well be a question or coupon id rather than a user.
 */
function subjectOf(req: AuthedRequest): string | null {
  const bag = {
    ...(req.params as Record<string, unknown>),
    ...(req.query as Record<string, unknown>),
    ...((req.body ?? {}) as Record<string, unknown>),
  }
  for (const key of ['user_id', 'userId', 'target_user_id', 'targetUserId']) {
    const v = bag[key]
    if (typeof v === 'string' && v) return v
  }
  // A bare `:id` counts as a user only on a route that is about users.
  if (/\/users?\b/i.test(req.baseUrl + req.path)) {
    const id = (req.params as Record<string, unknown>).id
    if (typeof id === 'string' && id) return id
  }
  return null
}

export function auditAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  // Captured now: a handler is free to mutate req.body, and Express clears
  // req.params by the time 'finish' fires on some routers.
  const params = { ...(req.params as Record<string, unknown>) }
  const query = { ...(req.query as Record<string, unknown>) }
  const body = req.method === 'GET' ? undefined : req.body
  const subjectId = subjectOf(req)

  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0]
    const action = `${req.method} ${path}`
    const status = res.statusCode

    // roleOf is the 30-second-cached lookup requireAdmin already used on this
    // request, so this costs nothing in the normal case.
    void (async () => {
      const actorRole = req.userId ? await roleOf(req.userId) : null

      audit({
        category: 'admin',
        action,
        actorId: req.userId ?? null,
        actorRole,
        subjectId,
        status,
        ip: clientIp(req),
        userAgent: clientUa(req),
        detail: {
          params: redact(params),
          query: redact(query),
          ...(body ? { body: redact(body) } : {}),
        },
      })

      // Alert only on actions that SUCCEEDED — a 403 here is already covered by
      // the authz-probe detector, and alerting on both would double-page.
      if (status < 400 && isHighRiskAction(action)) {
        recordPrivilegedAction({
          action,
          actorId: req.userId ?? null,
          actorRole,
          subjectId,
          ip: clientIp(req),
        })
      }
    })()
  })

  next()
}
