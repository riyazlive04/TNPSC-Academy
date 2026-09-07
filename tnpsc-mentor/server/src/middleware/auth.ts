import type { NextFunction, Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin, userClient } from '../supabase.js'

/** Fields we attach to the request once a valid Bearer token is verified. */
export interface AuthedRequest extends Request {
  userId?: string
  accessToken?: string
  /** A DB client scoped to the authenticated user (RLS + auth.uid() apply). */
  db?: SupabaseClient
  /** The caller's profile role, populated by the role gates that resolve it
   *  (currently requireCrmStaff, whose routes branch on telecaller vs admin). */
  role?: string | null
}

/** Exported so `middleware/maintenance.ts` can resolve a caller's role without
 *  duplicating the token-parse logic (it can't reuse `requireAuth` directly —
 *  that always 401s on a missing/invalid token, where the gate needs to fall
 *  through to a 503 instead). */
export function bearer(req: Request): string | null {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return null
  return h.slice(7).trim() || null
}

/**
 * Require a valid Supabase access token. Verifies it with GoTrue (service
 * client), then exposes `req.userId` and a user-scoped `req.db` so downstream
 * handlers run queries as that user.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = bearer(req)
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.userId = data.user.id
  req.accessToken = token
  req.db = userClient(token)
  next()
}

// Short-TTL role cache: requireAdmin/requireSuperadmin run on every admin
// request, each costing a profiles round-trip. Caching the role for a few
// seconds avoids that without meaningfully delaying a role revocation taking
// effect (the DB RPCs are is_admin()/is_superadmin()-gated regardless).
const ROLE_TTL_MS = 30_000
const roleCache = new Map<string, { role: string | null; expires: number }>()

/**
 * Forget a cached role, so a role change takes effect on the very next request
 * instead of up to ROLE_TTL_MS later.
 *
 * Without this, promoting someone to telecaller left them locked out of /crm
 * for half a minute — the desk polls every 10s, so they got a burst of 403s at
 * exactly the moment they were told to try it, and it tripped the authz-probe
 * detector into paging the operator about their own new hire.
 */
export function forgetRole(userId: string): void {
  roleCache.delete(userId)
}

/** Look up the authenticated user's role (null if missing/unknown), cached ~30s. */
export async function roleOf(userId: string): Promise<string | null> {
  const cached = roleCache.get(userId)
  if (cached && cached.expires > Date.now()) return cached.role

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (error) return null // transient errors aren't cached (retry next request)
  const role = (data?.role as string) ?? null
  roleCache.set(userId, { role, expires: Date.now() + ROLE_TTL_MS })
  return role
}

/**
 * Require the authenticated user to be an admin OR superadmin (superadmins
 * inherit every admin ability). Runs after requireAuth. The DB is still the
 * source of truth (RPCs are is_admin()-gated server-side); this is a fast fail.
 */
export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' })
  const role = await roleOf(req.userId)
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/**
 * Require the authenticated user to be CRM staff: a telecaller, or an
 * admin/superadmin supervising them.
 *
 * `telecaller` sits OUTSIDE the superadmin ⊃ admin ⊃ user hierarchy — it is a
 * staff role that grants the lead desk and nothing else, so requireAdmin above
 * deliberately still rejects it. This is the only gate that lets it through.
 */
export async function requireCrmStaff(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' })
  const role = await roleOf(req.userId)
  if (role !== 'telecaller' && role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: 'CRM access required' })
  }
  req.role = role
  next()
}

/**
 * Require the authenticated user to be a superadmin. Gates the platform console
 * routes (metrics, user management, feedback inbox). The underlying RPCs are
 * also is_superadmin()-gated server-side — this is defence in depth.
 */
export async function requireSuperadmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' })
  const role = await roleOf(req.userId)
  if (role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' })
  }
  next()
}
