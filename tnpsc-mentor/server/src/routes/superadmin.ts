import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { listSessions, revokeSessionById } from '../sessions.js'

const router = Router()

// All routes require an authenticated superadmin. The underlying RPCs are also
// is_superadmin()-gated server-side, so this is defence in depth.
router.use(requireAuth, requireSuperadmin)

// ─── GET /api/superadmin/metrics ─────────────────────────────────────────────
router.get(
  '/metrics',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_platform_metrics')
    if (error) return sendDbError(res, error)
    res.json({ metrics: data ?? {} })
  })
)

// ─── GET /api/superadmin/revenue ─────────────────────────────────────────────
router.get(
  '/revenue',
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_revenue_metrics')
    if (error) return sendDbError(res, error)
    res.json({ revenue: data ?? {} })
  })
)

// ─── GET /api/superadmin/users?search=&limit= ────────────────────────────────
router.get(
  '/users',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 200, 1), 1000)
    const search = req.query.search ? String(req.query.search) : null
    const { data, error } = await req.db!.rpc('superadmin_list_users', {
      p_limit: limit,
      p_search: search,
    })
    if (error) return sendDbError(res, error)
    res.json({ users: data ?? [] })
  })
)

// ─── POST /api/superadmin/users/role ─────────────────────────────────────────
router.post(
  '/users/role',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId, role } = req.body ?? {}
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role are required' })
    }
    // Allow-list the role before it reaches the RPC (the RPC also validates,
    // but reject obviously-bad input early with a clear message).
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: `Invalid role: ${role}` })
    }
    const { data, error } = await req.db!.rpc('superadmin_set_role', {
      p_user: userId,
      p_role: role,
    })
    if (error) return sendDbError(res, error)
    res.json({ user: data })
  })
)

// ─── POST /api/superadmin/users/revoke-premium ───────────────────────────────
// Withdraw a user's premium: flips their paid payment rows to 'revoked', which
// the premium computation (status = 'paid') then excludes. Returns the count.
router.post(
  '/users/revoke-premium',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const { data, error } = await req.db!.rpc('superadmin_revoke_premium', {
      p_user: userId,
    })
    if (error) return sendDbError(res, error)
    res.json({ revoked: Number(data ?? 0) })
  })
)

// ─── POST /api/superadmin/users/delete ───────────────────────────────────────
// Hard-delete a user: removes the auth account (GoTrue admin API), which
// cascades the profile + every user-owned row. Guards prevent deleting yourself
// or any superadmin (demote them first) — both are easy ways to lock the
// platform out of administration.
router.post(
  '/users/delete',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId } = req.body ?? {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' })
    }

    // Don't let a superadmin be deleted out from under the console.
    const { data: target, error: lookupErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (lookupErr || !target) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (target.role === 'superadmin') {
      return res.status(400).json({ error: 'Demote this superadmin before deleting.' })
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ deleted: true })
  })
)

// ─── GET /api/superadmin/users/:userId/sessions ──────────────────────────────
// A user's active device sessions (where they're signed in) for the console's
// "Devices" view. Reuses listSessions (service-role read; filters revoked +
// idle-expired rows). The raw device_id / session key is stripped — the console
// only needs the opaque row `id` (to sign out) plus display fields.
router.get(
  '/users/:userId/sessions',
  asyncH(async (req: AuthedRequest, res) => {
    const userId = String(req.params.userId)
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const list = await listSessions(userId)
    const sessions = list.map((d) => ({
      id: d.id,
      label: d.label,
      created_at: d.created_at,
      last_seen_at: d.last_seen_at,
    }))
    res.json({ sessions })
  })
)

// ─── POST /api/superadmin/users/sessions/revoke ──────────────────────────────
// Remotely sign a user out of one device. revokeSessionById is scoped to the
// (userId, id) pair, so a mismatched id is a no-op rather than a cross-account
// sign-out. The device logs out on its next token refresh.
router.post(
  '/users/sessions/revoke',
  asyncH(async (req: AuthedRequest, res) => {
    const { userId, id } = req.body ?? {}
    if (!userId || !id) {
      return res.status(400).json({ error: 'userId and id are required' })
    }
    await revokeSessionById(String(userId), String(id))
    res.json({ ok: true })
  })
)

// ─── GET /api/superadmin/feedback?limit= ─────────────────────────────────────
router.get(
  '/feedback',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 100, 1), 1000)
    const { data, error } = await req.db!.rpc('list_app_feedback', { p_limit: limit })
    if (error) return sendDbError(res, error)
    res.json({ feedback: data ?? [] })
  })
)

export default router
