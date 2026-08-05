// ─── Access log + live security signals ──────────────────────────────────────
// One structured line per API request on stdout, which PM2 writes to
// ~/.pm2/logs/tnpsc-api-out.log and logrotate keeps for 90 days (see
// deploy/logrotate-tnpsc). Before this, the server logged nothing but crashes:
// there was no way to tell, after the fact, that someone had walked the API.
//
// What is logged is deliberately thin — method, path, status, duration, user id,
// IP. No request bodies, no query strings, no headers: the log is a security
// artefact, not a copy of the users' data, and a leaked verbose log would itself
// be the breach it exists to detect. The query string is dropped because ours
// carry user ids and search terms.
//
// The same hook feeds the detectors in lib/securityAlerts.ts, so 403/429/5xx
// bursts raise an alert without a second pass over the request.

import type { NextFunction, Response } from 'express'
import type { AuthedRequest } from './auth.js'
import { clientIp } from '../lib/audit.js'
import {
  recordForbidden,
  recordRateLimited,
  recordServerError,
} from '../lib/securityAlerts.js'

/** Health checks run every few seconds from the uptime monitor — logging them
 *  would bury everything else and tell us nothing. */
const SKIP = new Set(['/api/health'])

export function requestLog(req: AuthedRequest, res: Response, next: NextFunction): void {
  const started = Date.now()

  res.on('finish', () => {
    // originalUrl includes the query string; keep only the path.
    const path = req.originalUrl.split('?')[0]
    if (SKIP.has(path)) return

    const status = res.statusCode
    const ip = clientIp(req)

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        lvl: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        m: req.method,
        p: path,
        s: status,
        ms: Date.now() - started,
        // Present only once requireAuth has run, which is the point: an
        // authenticated call is attributable, an anonymous one is not.
        uid: req.userId ?? null,
        ip,
      })
    )

    if (status === 403) recordForbidden(ip, path)
    else if (status === 429) recordRateLimited(ip, path)
    else if (status >= 500) recordServerError(path, status)
  })

  next()
}
