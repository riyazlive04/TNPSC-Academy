import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { bundleAccess } from '../lib/premium.js'
import { creditBalance, grantDaily } from '../lib/credits.js'

const router = Router()

/** premium OR vettri OR staff → unlimited (never spends credits). Fails closed. */
async function isUnlimited(req: AuthedRequest): Promise<boolean> {
  const role = await roleOf(req.userId!)
  if (role === 'admin' || role === 'superadmin') return true
  try {
    return (await bundleAccess(req.db!)).unlimited
  } catch {
    return false
  }
}

// ─── GET /api/credits ────────────────────────────────────────────────────────
// The caller's current credit balance + whether they're unlimited (so the client
// can hide the meter for paid/staff users).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const [balance, unlimited] = await Promise.all([
      creditBalance(req.userId!).catch(() => 0),
      isUnlimited(req),
    ])
    res.json({ balance, unlimited })
  })
)

// ─── POST /api/credits/checkin ───────────────────────────────────────────────
// Grants the +10 daily bonus if it hasn't been granted this IST day, then returns
// the balance. Called once on app load; the RPC is idempotent per day.
router.post(
  '/checkin',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    try {
      const r = await grantDaily(req.db!)
      const unlimited = await isUnlimited(req)
      res.json({ ...r, unlimited })
    } catch (e) {
      return sendDbError(res, e as Parameters<typeof sendDbError>[1])
    }
  })
)

export default router
