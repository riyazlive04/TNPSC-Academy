import { Router } from 'express'
import webpush from 'web-push'
import { config, pushEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

// Configure web-push once at module load (only when keys are present).
if (pushEnabled) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

// ─── Audience helpers ────────────────────────────────────────────────────────
/** user_ids with an active (paid, <1yr) premium_annual order — the 'premium'
 *  audience. Mirrors the entitlement rule in payments. */
async function premiumUserIds(): Promise<Set<string>> {
  const since = new Date(Date.now() - YEAR_MS).toISOString()
  const { data } = await supabaseAdmin
    .from('payments')
    .select('user_id, notes')
    .eq('status', 'paid')
    .gte('created_at', since)
  const ids = new Set<string>()
  for (const r of data ?? []) {
    if ((r.notes as { plan?: string } | null)?.plan === 'premium_annual') {
      ids.add((r as { user_id: string }).user_id)
    }
  }
  return ids
}

/** Whether a single user matches a notification's audience. */
function matches(
  audience: string,
  audienceValue: string | null,
  ctx: { premium: boolean; group: string | null; isAdmin: boolean }
): boolean {
  switch (audience) {
    case 'premium':
      return ctx.premium
    case 'free':
      return !ctx.premium
    case 'group':
      return !!audienceValue && ctx.group === audienceValue
    case 'admin':
      return ctx.isAdmin
    case 'all':
    default:
      return true
  }
}

// ─── GET /api/notifications/vapid-public-key ─────────────────────────────────
// The browser needs the PUBLIC key to create a push subscription. Null when push
// isn't configured — the client then shows in-app notifications only.
router.get(
  '/vapid-public-key',
  requireAuth,
  asyncH(async (_req, res) => {
    res.json({ key: pushEnabled ? config.vapidPublicKey : null })
  })
)

// ─── POST /api/notifications/subscribe ───────────────────────────────────────
// Store (or refresh) this browser's Web Push subscription.
router.post(
  '/subscribe',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    if (!pushEnabled) return res.status(503).json({ error: 'Push notifications are not configured.' })
    const sub = req.body?.subscription
    const endpoint = sub?.endpoint
    const p256dh = sub?.keys?.p256dh
    const auth = sub?.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid push subscription.' })
    }
    // Upsert on endpoint so re-subscribing the same device doesn't duplicate, and
    // a device that changed hands gets reassigned to the current user.
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        user_id: req.userId,
        endpoint,
        p256dh,
        auth,
        user_agent: String(req.headers['user-agent'] ?? '').slice(0, 300),
      },
      { onConflict: 'endpoint' }
    )
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── POST /api/notifications/unsubscribe ─────────────────────────────────────
router.post(
  '/unsubscribe',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const endpoint = req.body?.endpoint
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint.' })
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', req.userId)
      .eq('endpoint', endpoint)
    res.json({ ok: true })
  })
)

// ─── GET /api/notifications ──────────────────────────────────────────────────
// The signed-in user's in-app feed: notifications whose audience matches them,
// each flagged read/unread, plus the unread count for the bell badge.
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const [{ data: profile }, premiumIds, { data: rows }, { data: reads }] = await Promise.all([
      supabaseAdmin.from('profiles').select('target_group, role').eq('id', req.userId).single(),
      premiumUserIds(),
      supabaseAdmin
        .from('notifications')
        .select('id, kind, title, body, url, audience, audience_value, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin.from('notification_reads').select('notification_id').eq('user_id', req.userId),
    ])

    const role = (profile?.role as string | null) ?? null
    const ctx = {
      premium: premiumIds.has(req.userId!),
      group: (profile?.target_group as string | null) ?? null,
      isAdmin: role === 'admin' || role === 'superadmin',
    }
    const readSet = new Set((reads ?? []).map((r) => (r as { notification_id: string }).notification_id))

    const items = (rows ?? [])
      .filter((n) => matches(n.audience as string, (n.audience_value as string | null) ?? null, ctx))
      .slice(0, 50)
      .map((n) => ({
        id: n.id as string,
        kind: n.kind as 'push' | 'system',
        title: n.title as string,
        body: n.body as string,
        url: (n.url as string | null) ?? null,
        created_at: n.created_at as string,
        read: readSet.has(n.id as string),
      }))

    res.json({ notifications: items, unread: items.filter((i) => !i.read).length })
  })
)

// ─── POST /api/notifications/read ────────────────────────────────────────────
// Mark specific notifications (or all of the supplied ids) as read.
router.post(
  '/read',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Cap the batch: the feed never returns more than ~50 items, so a larger
    // array is abuse — bound it so one request can't write unbounded rows.
    const ids: string[] = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 100)
      : []
    if (ids.length === 0) return res.json({ ok: true })
    const rowsToInsert = ids.map((notification_id) => ({ user_id: req.userId, notification_id }))
    const { error } = await supabaseAdmin
      .from('notification_reads')
      .upsert(rowsToInsert, { onConflict: 'user_id,notification_id' })
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── Superadmin: author + send ───────────────────────────────────────────────
const admin = [requireAuth, requireSuperadmin] as const

/** Send a Web Push to every subscription of the given users. Prunes dead subs. */
async function sendPushTo(
  userIds: string[],
  payload: { id: string; title: string; body: string; url: string | null }
): Promise<number> {
  if (!pushEnabled || userIds.length === 0) return 0
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (!subs || subs.length === 0) return 0

  const body = JSON.stringify(payload)
  const dead: string[] = []
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
        body
      )
    )
  )
  let sent = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++
    } else {
      // 404/410 = the subscription is gone (browser revoked / reinstalled) → prune.
      const code = (r.reason as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) dead.push(subs[i].endpoint as string)
    }
  })
  if (dead.length) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', dead)
  }
  return sent
}

/** Resolve the concrete user_ids an audience targets (for push delivery). */
async function audienceUserIds(audience: string, audienceValue: string | null): Promise<string[]> {
  if (audience === 'premium') return [...(await premiumUserIds())]
  if (audience === 'free') {
    const [{ data: all }, premium] = await Promise.all([
      supabaseAdmin.from('profiles').select('id'),
      premiumUserIds(),
    ])
    return (all ?? []).map((p) => p.id as string).filter((id) => !premium.has(id))
  }
  if (audience === 'group') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('target_group', audienceValue ?? '')
    return (data ?? []).map((p) => p.id as string)
  }
  if (audience === 'admin') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'superadmin'])
    return (data ?? []).map((p) => p.id as string)
  }
  // 'all'
  const { data } = await supabaseAdmin.from('profiles').select('id')
  return (data ?? []).map((p) => p.id as string)
}

// POST /api/notifications — create a notification; if kind='push', deliver it.
router.post(
  '/',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const kind = req.body?.kind === 'system' ? 'system' : 'push'
    const title = String(req.body?.title ?? '').trim()
    const body = String(req.body?.body ?? '').trim()
    const url = req.body?.url ? String(req.body.url).trim() : null
    const audience = ['all', 'premium', 'free', 'group'].includes(req.body?.audience)
      ? (req.body.audience as string)
      : 'all'
    const audienceValue = audience === 'group' ? String(req.body?.audienceValue ?? '').trim() || null : null

    if (!title || !body) return res.status(400).json({ error: 'Title and message are required.' })
    if (audience === 'group' && !audienceValue) {
      return res.status(400).json({ error: 'Pick a target group for the group audience.' })
    }

    const { data: row, error } = await supabaseAdmin
      .from('notifications')
      .insert({ kind, title, body, url, audience, audience_value: audienceValue, created_by: req.userId })
      .select('*')
      .single()
    if (error) return sendDbError(res, error)

    let pushSent = 0
    if (kind === 'push' && pushEnabled) {
      const targets = await audienceUserIds(audience, audienceValue)
      pushSent = await sendPushTo(targets, { id: row.id as string, title, body, url })
      await supabaseAdmin.from('notifications').update({ push_sent: pushSent }).eq('id', row.id)
    }

    res.status(201).json({ notification: { ...row, push_sent: pushSent }, pushSent, pushEnabled })
  })
)

// GET /api/notifications/admin — history of authored notifications.
router.get(
  '/admin',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return sendDbError(res, error)
    res.json({ notifications: data ?? [] })
  })
)

// DELETE /api/notifications/:id — remove an authored notification (and its reads).
router.delete(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await supabaseAdmin.from('notifications').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

export default router
