import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'

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

// ─── GET /api/superadmin/users?search=&limit= ────────────────────────────────
router.get(
  '/users',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Number(req.query.limit ?? 200)
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
    const { data, error } = await req.db!.rpc('superadmin_set_role', {
      p_user: userId,
      p_role: role,
    })
    if (error) return sendDbError(res, error)
    res.json({ user: data })
  })
)

// ─── GET /api/superadmin/feedback?limit= ─────────────────────────────────────
router.get(
  '/feedback',
  asyncH(async (req: AuthedRequest, res) => {
    const limit = Number(req.query.limit ?? 100)
    const { data, error } = await req.db!.rpc('list_app_feedback', { p_limit: limit })
    if (error) return sendDbError(res, error)
    res.json({ feedback: data ?? [] })
  })
)

export default router
