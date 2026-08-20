import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { bundleAccess } from '../lib/premium.js'
import { creditBalance, grantDaily, DAILY_CREDIT_GRANT, DAILY_CREDIT_GRANT_BOOSTED } from '../lib/credits.js'
import { maybeSendFirstTestNudge } from '../lib/firstTestNudge.js'

const router = Router()

/** premium/vettri/rankBooster/staff → unlimited (never spends credits); an
 *  active Mock Pack owner isn't unlimited but does get the bigger daily
 *  grant. One bundleAccess() read serves both, reused by GET / and /checkin. */
async function resolveCreditPlan(
  req: AuthedRequest
): Promise<{ unlimited: boolean; dailyGrant: number }> {
  const role = await roleOf(req.userId!)
  if (role === 'admin' || role === 'superadmin') {
    return { unlimited: true, dailyGrant: DAILY_CREDIT_GRANT }
  }
  try {
    const b = await bundleAccess(req.db!)
    return {
      unlimited: b.creditsUnlimited,
      dailyGrant: b.mockPack ? DAILY_CREDIT_GRANT_BOOSTED : DAILY_CREDIT_GRANT,
    }
  } catch {
    return { unlimited: false, dailyGrant: DAILY_CREDIT_GRANT }
  }
}

// ─── GET /api/credits ────────────────────────────────────────────────────────
// The caller's current credit balance + whether they're unlimited (so the client
// can hide the meter for paid/staff users).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const [balance, { unlimited }] = await Promise.all([
      creditBalance(req.userId!).catch(() => 0),
      resolveCreditPlan(req),
    ])
    res.json({ balance, unlimited })
  })
)

// ─── POST /api/credits/checkin ───────────────────────────────────────────────
// Grants the daily bonus (+10, or +50 for an active Mock Pack owner) if it
// hasn't been granted this IST day, then returns the balance. Called once on
// app load; the RPC is idempotent per day.
router.post(
  '/checkin',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    try {
      const { unlimited, dailyGrant } = await resolveCreditPlan(req)
      const r = await grantDaily(req.db!, dailyGrant)
      res.json({ ...r, unlimited })
      // A day-old account that still has zero completed tests gets its one-time
      // "take your first test" push/in-app nudge. Fire-and-forget after the
      // response — it must never slow down or fail the check-in.
      void maybeSendFirstTestNudge(req.userId!)
    } catch (e) {
      return sendDbError(res, e as Parameters<typeof sendDbError>[1])
    }
  })
)

export default router
