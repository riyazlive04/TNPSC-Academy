import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { bundleAccess } from '../lib/premium.js'
import {
  creditBalance,
  grantDaily,
  DAILY_CREDIT_GRANT,
  DAILY_CREDIT_GRANT_BOOSTED,
  MOCK_PACK_FREE_CATEGORIES,
} from '../lib/credits.js'
import { maybeSendFirstTestNudge } from '../lib/firstTestNudge.js'

const router = Router()

/** premium/vettri/rankBooster/staff → unlimited (never spends credits); an
 *  active Mock Pack owner isn't unlimited but does get the bigger daily
 *  grant. One bundleAccess() read serves both, reused by GET / and /checkin. */
async function resolveCreditPlan(
  req: AuthedRequest
): Promise<{ unlimited: boolean; dailyGrant: number; freeCategories: string[] }> {
  const role = await roleOf(req.userId!)
  if (role === 'admin' || role === 'superadmin') {
    return { unlimited: true, dailyGrant: DAILY_CREDIT_GRANT, freeCategories: [] }
  }
  try {
    const b = await bundleAccess(req.db!)
    return {
      unlimited: b.creditsUnlimited,
      dailyGrant: b.mockPack ? DAILY_CREDIT_GRANT_BOOSTED : DAILY_CREDIT_GRANT,
      // Banks this caller draws free without being unlimited overall — the
      // Mock Pack's Group 1 PYQs. Served from here so the client's "this test
      // costs N credits" prompt matches what the quiz route will actually
      // charge, instead of re-deriving the rule and drifting from it.
      freeCategories: b.mockPack ? [...MOCK_PACK_FREE_CATEGORIES] : [],
    }
  } catch {
    return { unlimited: false, dailyGrant: DAILY_CREDIT_GRANT, freeCategories: [] }
  }
}

// ─── GET /api/credits ────────────────────────────────────────────────────────
// The caller's current credit balance + whether they're unlimited (so the client
// can hide the meter for paid/staff users).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const [balance, { unlimited, freeCategories }] = await Promise.all([
      creditBalance(req.userId!).catch(() => 0),
      resolveCreditPlan(req),
    ])
    res.json({ balance, unlimited, freeCategories })
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
      const { unlimited, dailyGrant, freeCategories } = await resolveCreditPlan(req)
      const r = await grantDaily(req.db!, dailyGrant)
      // freeCategories rides along here too: the client store is filled from
      // whichever of these two endpoints answers, so omitting it would let a
      // check-in blank out the Mock Pack's free-PYQ rule.
      res.json({ ...r, unlimited, freeCategories })
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
