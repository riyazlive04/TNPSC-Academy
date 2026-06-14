import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/profile ────────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single()
    if (error) return sendDbError(res, error)
    res.json({ profile: data })
  })
)

// ─── PATCH /api/profile ──────────────────────────────────────────────────────
// Update onboarding/goal fields (exam_date, daily_goal, target_group, name…).
router.patch(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const allowed = ['full_name', 'phone', 'target_group', 'exam_date', 'daily_goal']
    const fields: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in (req.body ?? {})) fields[k] = req.body[k]
    }
    const { data, error } = await req.db!
      .from('profiles')
      .update(fields)
      .eq('id', req.userId)
      .select('*')
      .single()
    if (error) return sendDbError(res, error)
    res.json({ profile: data })
  })
)

// ─── GET /api/profile/percentile ─────────────────────────────────────────────
router.get(
  '/percentile',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('user_percentile', { p_user: req.userId })
    if (error) return sendDbError(res, error)
    res.json({ percentile: data == null ? null : Math.round(Number(data)) })
  })
)

// ─── GET /api/profile/activity?days=60 ───────────────────────────────────────
// Daily-activity rows for streak/goal computation (done client-side).
router.get(
  '/activity',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const days = Number(req.query.days ?? 60)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString().slice(0, 10)
    const { data, error } = await req.db!
      .from('daily_activity')
      .select('activity_date,questions,tests')
      .eq('user_id', req.userId)
      .gte('activity_date', sinceIso)
      .order('activity_date', { ascending: true })
    if (error) return sendDbError(res, error)
    res.json({ rows: data ?? [] })
  })
)

// ─── POST /api/profile/activity ──────────────────────────────────────────────
// Increment today's activity counters (read-modify-write done server-side).
router.post(
  '/activity',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const questions = Number(req.body?.questions ?? 0)
    const tests = Number(req.body?.tests ?? 1)
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await req.db!
      .from('daily_activity')
      .select('questions,tests')
      .eq('user_id', req.userId)
      .eq('activity_date', today)
      .maybeSingle()
    const prevQ = (existing?.questions as number) ?? 0
    const prevT = (existing?.tests as number) ?? 0
    const { error } = await req.db!.from('daily_activity').upsert(
      {
        user_id: req.userId,
        activity_date: today,
        questions: prevQ + questions,
        tests: prevT + tests,
      },
      { onConflict: 'user_id,activity_date' }
    )
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

export default router
