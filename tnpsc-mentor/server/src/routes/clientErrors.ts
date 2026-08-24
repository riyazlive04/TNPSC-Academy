// ─── /api/client-errors — a real user hit a 'server' or 'generic' error ───────
// Fired by src/components/UI/ErrorState.tsx and ErrorBoundary's crash screen
// (see reportClientError.ts on the client) so the team hears about it via the
// same Telegram pipe as the security detectors, instead of relying on someone
// noticing a support message or scrolling PM2 logs. 'network' errors are never
// reported here — a dropped connection is the user's own, not ours to fix.
//
// Deliberately unauthenticated: a page can fail before login ever succeeds
// (the login/landing screens make API calls too), so this can't sit behind
// requireAuth. The rate limiter plus raise()'s own per-kind+path cooldown are
// what stand between this and abuse.

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { asyncH } from '../util.js'
import { recordClientError } from '../lib/securityAlerts.js'
import { clientIp } from '../lib/audit.js'

const router = Router()

const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many requests.' },
})

router.post(
  '/',
  limiter,
  asyncH(async (req, res) => {
    const kind = req.body?.kind
    if (kind !== 'server' && kind !== 'generic') {
      return res.status(400).json({ error: "kind must be 'server' or 'generic'" })
    }
    const path = String(req.body?.path ?? '(unknown)').slice(0, 200)
    const message = String(req.body?.message ?? '(no message)').slice(0, 500)
    const status =
      typeof req.body?.status === 'number' && req.body.status >= 100 && req.body.status <= 599
        ? req.body.status
        : undefined
    const userId =
      typeof req.body?.userId === 'string' ? req.body.userId.slice(0, 100) : null
    const componentStack =
      typeof req.body?.componentStack === 'string'
        ? req.body.componentStack.slice(0, 2000)
        : null

    recordClientError({
      kind,
      path,
      message,
      status,
      userId,
      componentStack,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    })
    res.json({ ok: true })
  })
)

export default router
