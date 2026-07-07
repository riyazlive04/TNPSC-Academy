import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { premiumUserIds, matchesAudience } from './notifications.js'

/**
 * Popup Alerts — superadmin-authored announcements shown to users as a modal
 * popup on app open. Unlike notifications (bell feed / device push), an alert
 * interrupts: it keeps re-appearing each session until the user dismisses it,
 * with the dismissal stored per ACCOUNT (alert_dismissals) so it never repeats
 * across devices. Same trust model as notifications: the server (service role)
 * does all reads/writes and applies audience filtering per user.
 */
const router = Router()

// ─── GET /api/alerts/active ──────────────────────────────────────────────────
// The signed-in user's pending popup alerts: active, not expired, audience-
// matched, and not yet dismissed by them. Oldest first so a backlog plays in
// the order it was published.
router.get(
  '/active',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const [{ data: profile }, premiumIds, { data: rows }, { data: dismissals }] = await Promise.all([
      supabaseAdmin.from('profiles').select('target_group, role').eq('id', req.userId).single(),
      premiumUserIds(),
      supabaseAdmin
        .from('app_alerts')
        .select('id, title, body, title_ta, body_ta, url, audience, audience_value, expires_at, created_at')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(20),
      supabaseAdmin.from('alert_dismissals').select('alert_id').eq('user_id', req.userId),
    ])

    const role = (profile?.role as string | null) ?? null
    const ctx = {
      premium: premiumIds.has(req.userId!),
      group: (profile?.target_group as string | null) ?? null,
      isAdmin: role === 'admin' || role === 'superadmin',
    }
    const dismissed = new Set((dismissals ?? []).map((d) => (d as { alert_id: string }).alert_id))
    const now = Date.now()

    const alerts = (rows ?? [])
      .filter((a) => {
        if (dismissed.has(a.id as string)) return false
        const exp = a.expires_at as string | null
        if (exp && new Date(exp).getTime() <= now) return false
        return matchesAudience(a.audience as string, (a.audience_value as string | null) ?? null, ctx)
      })
      .map((a) => ({
        id: a.id as string,
        title: a.title as string,
        body: a.body as string,
        title_ta: (a.title_ta as string | null) ?? null,
        body_ta: (a.body_ta as string | null) ?? null,
        url: (a.url as string | null) ?? null,
        created_at: a.created_at as string,
      }))

    res.json({ alerts })
  })
)

// ─── POST /api/alerts/:id/dismiss ────────────────────────────────────────────
// "Got it" — record the per-account dismissal so this alert never shows again.
router.post(
  '/:id/dismiss',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await supabaseAdmin
      .from('alert_dismissals')
      .upsert({ user_id: req.userId, alert_id: req.params.id }, { onConflict: 'user_id,alert_id' })
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── Superadmin: author + manage ─────────────────────────────────────────────
const admin = [requireAuth, requireSuperadmin] as const

// POST /api/alerts — publish a popup alert.
router.post(
  '/',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const title = String(req.body?.title ?? '').trim()
    const body = String(req.body?.body ?? '').trim()
    const titleTa = String(req.body?.titleTa ?? '').trim() || null
    const bodyTa = String(req.body?.bodyTa ?? '').trim() || null
    const url = req.body?.url ? String(req.body.url).trim() : null
    const audience = ['all', 'premium', 'free', 'group'].includes(req.body?.audience)
      ? (req.body.audience as string)
      : 'all'
    const audienceValue = audience === 'group' ? String(req.body?.audienceValue ?? '').trim() || null : null
    // Optional expiry — reject garbage dates rather than storing Invalid Date.
    const expiresRaw = req.body?.expiresAt ? String(req.body.expiresAt) : null
    const expiresAt = expiresRaw && !Number.isNaN(new Date(expiresRaw).getTime())
      ? new Date(expiresRaw).toISOString()
      : null

    if (!title || !body) return res.status(400).json({ error: 'Title and message are required.' })
    if (audience === 'group' && !audienceValue) {
      return res.status(400).json({ error: 'Pick a target group for the group audience.' })
    }

    const { data: row, error } = await supabaseAdmin
      .from('app_alerts')
      .insert({
        title,
        body,
        title_ta: titleTa,
        body_ta: bodyTa,
        url,
        audience,
        audience_value: audienceValue,
        expires_at: expiresAt,
        created_by: req.userId,
      })
      .select('*')
      .single()
    if (error) return sendDbError(res, error)
    res.status(201).json({ alert: row })
  })
)

// GET /api/alerts/admin — authored history, each with its dismissal (seen) count.
router.get(
  '/admin',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('app_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return sendDbError(res, error)

    const rows = data ?? []
    // Head-only count queries (no row payload): the list is capped at 100.
    const counts = await Promise.all(
      rows.map((a) =>
        supabaseAdmin
          .from('alert_dismissals')
          .select('alert_id', { count: 'exact', head: true })
          .eq('alert_id', a.id)
          .then(({ count }) => count ?? 0)
      )
    )
    res.json({ alerts: rows.map((a, i) => ({ ...a, dismissed_count: counts[i] })) })
  })
)

// PATCH /api/alerts/:id — toggle active (pull / re-publish an alert).
router.patch(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ error: 'Nothing to update.' })
    }
    const { data: row, error } = await supabaseAdmin
      .from('app_alerts')
      .update({ active: req.body.active })
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) return sendDbError(res, error)
    res.json({ alert: row })
  })
)

// DELETE /api/alerts/:id — remove an alert (and its dismissals, via FK cascade).
router.delete(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await supabaseAdmin.from('app_alerts').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

export default router
