import type { NextFunction, Request, Response } from 'express'
import { supabaseAdmin } from '../supabase.js'
import { readMaintenanceMode } from '../lib/settings.js'
import { bearer, roleOf } from './auth.js'

// Short-TTL cache so the flag isn't re-read from the DB on every single API
// request while maintenance is off (the common case). Deliberately shorter
// and separate from requireAdmin/requireSuperadmin's 30s roleCache — a
// maintenance flip should take effect fast, and the two have no reason to be
// coupled.
const CACHE_TTL_MS = 5_000
let cached: { on: boolean; expires: number } | null = null

async function maintenanceOn(): Promise<boolean> {
  if (cached && cached.expires > Date.now()) return cached.on
  // Fail OPEN (treat as "not in maintenance"), not open-the-error-up: this
  // runs ahead of every gated route, so an unhandled rejection here would
  // hang or 500 the whole API on a transient settings-read hiccup — far
  // worse than the flag being a few seconds stale. Matches the fail-toward-
  // default convention every other app_settings reader already uses.
  let on = false
  try {
    on = await readMaintenanceMode()
  } catch (err) {
    console.error('[maintenanceGate] settings read failed, treating as off:', (err as Error).message)
  }
  cached = { on, expires: Date.now() + CACHE_TTL_MS }
  return on
}

/**
 * Gate mounted after /api/auth and /api/telegram (both self-authenticating /
 * needed for an admin to even log in) and before every other router. While
 * maintenance is on, only an authenticated admin/superadmin passes through —
 * everyone else gets a 503 the frontend recognizes and turns into the
 * full-screen maintenance page (see src/lib/api.ts's request() wrapper).
 */
export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  if (!(await maintenanceOn())) return next()

  const token = bearer(req)
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    const role = !error && data.user ? await roleOf(data.user.id) : null
    if (role === 'admin' || role === 'superadmin') return next()
    // Maintenance closes the STUDENT app. The telecaller lead desk is a
    // separate internal tool and leads keep arriving throughout a deploy, so a
    // telecaller keeps working — but only on /api/crm, not on the rest of the
    // API they have no business calling anyway.
    if (role === 'telecaller' && req.path.startsWith('/crm')) return next()
  }

  res.status(503).json({
    error: 'maintenance',
    message: 'TNPSC Mentor is under maintenance. Please check back shortly.',
  })
}
