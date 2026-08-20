import { Router } from 'express'
import { config, pushEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { sendPushTo } from '../notify.js'
import { PREMIUM_VALIDITY_MS } from '../pricing.js'
import { premiumEntitlement } from '../lib/premium.js'

const router = Router()

// ─── Audience helpers (shared with routes/alerts.ts) ─────────────────────────
/** user_ids with an active (paid, within the validity window) premium_annual
 *  order — the 'premium' audience. Mirrors the entitlement rule in payments
 *  exactly via the shared PREMIUM_VALIDITY_MS so the two can't drift.
 *
 *  Scans the whole payments table, so it's only for fan-out (resolving an
 *  entire audience's user_ids to push to). A single caller's own membership
 *  should use `premiumEntitlement(req.db!)` instead (RLS-scoped, one row read). */
export async function premiumUserIds(): Promise<Set<string>> {
  const since = new Date(Date.now() - PREMIUM_VALIDITY_MS).toISOString()
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
export function matchesAudience(
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
    // Anti-hijack: a plain upsert on `endpoint` would let any authenticated user
    // reassign another user's endpoint to themselves (silencing the victim). The
    // composite (user_id, endpoint) uniqueness can't be relied on here, so instead
    // we scope by ownership: look up the existing row for this endpoint and only
    // write when it's UNOWNED or already owned by the caller. An endpoint owned by
    // a different user is left untouched (no reassignment).
    const agent = String(req.headers['user-agent'] ?? '').slice(0, 300)
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (existing && existing.user_id !== req.userId) {
      // Endpoint belongs to someone else — refuse to reassign it.
      return res.status(409).json({ error: 'This subscription is registered to another account.' })
    }

    const { error } = existing
      ? await supabaseAdmin
          .from('push_subscriptions')
          .update({ p256dh, auth, user_agent: agent })
          .eq('id', existing.id)
          .eq('user_id', req.userId!) // belt-and-braces: never touch another user's row
      : await supabaseAdmin
          .from('push_subscriptions')
          .insert({ user_id: req.userId, endpoint, p256dh, auth, user_agent: agent })
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

// ─── POST /api/notifications/device ──────────────────────────────────────────
// Register an APNs/FCM device token for the installed app. The web build uses
// /subscribe (Web Push) instead; the two coexist because a user can be on both.
//
// Upsert on `token`, not on (user, platform): the token is what the transport
// addresses, it rotates on its own, and the SAME device can be handed to a
// different account. Conflicting on the token therefore re-points a reused token
// at whoever is signed in now, instead of silently pushing one user's
// notifications to another's phone.
router.post(
  '/device',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const token = String(req.body?.token ?? '').trim()
    const platform = String(req.body?.platform ?? '')
    if (!token) return res.status(400).json({ error: 'Missing device token.' })
    if (platform !== 'ios' && platform !== 'android') {
      return res.status(400).json({ error: 'Unknown platform.' })
    }

    const { error } = await supabaseAdmin
      .from('push_devices')
      .upsert({ user_id: req.userId, token, platform }, { onConflict: 'token' })
    if (error) return sendDbError(res, error)
    res.json({ ok: true })
  })
)

// ─── DELETE /api/notifications/device ────────────────────────────────────────
// Stop pushing to this user's devices. A specific `token` unregisters just that
// device; without one, every device on the account is dropped (the Profile
// toggle's "turn notifications off" for this account).
router.delete(
  '/device',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const token = String(req.body?.token ?? '').trim()
    let q = supabaseAdmin.from('push_devices').delete().eq('user_id', req.userId)
    if (token) q = q.eq('token', token)
    const { error } = await q
    if (error) return sendDbError(res, error)
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
    const [{ data: profile }, premium, { data: rows }, { data: reads }] = await Promise.all([
      supabaseAdmin.from('profiles').select('target_group, role').eq('id', req.userId).single(),
      // RLS-scoped to this one caller (req.db), not a full-table scan of every
      // paying user — premiumUserIds() is reserved for audience fan-out below.
      premiumEntitlement(req.db!)
        .then((r) => r.premium)
        .catch(() => false), // fail closed on a ledger read error
      supabaseAdmin
        .from('notifications')
        .select('id, kind, title, body, title_ta, body_ta, url, audience, audience_value, target_user_id, created_at')
        // Broadcasts (target_user_id null) + this user's own targeted messages.
        // (req.userId is a verified-JWT UUID, safe to interpolate.)
        .or(`target_user_id.is.null,target_user_id.eq.${req.userId}`)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin.from('notification_reads').select('notification_id').eq('user_id', req.userId),
    ])

    const role = (profile?.role as string | null) ?? null
    const ctx = {
      premium,
      group: (profile?.target_group as string | null) ?? null,
      isAdmin: role === 'admin' || role === 'superadmin',
    }
    const readSet = new Set((reads ?? []).map((r) => (r as { notification_id: string }).notification_id))

    const items = (rows ?? [])
      .filter((n) => {
        // A targeted message is for its user only; broadcasts use audience rules.
        const target = (n.target_user_id as string | null) ?? null
        if (target) return target === req.userId
        return matchesAudience(n.audience as string, (n.audience_value as string | null) ?? null, ctx)
      })
      .slice(0, 50)
      .map((n) => ({
        id: n.id as string,
        kind: n.kind as 'push' | 'system',
        title: n.title as string,
        body: n.body as string,
        // Tamil variants (when authored): the bell renders by the user's LIVE
        // language choice, so both ship and the client picks.
        title_ta: (n.title_ta as string | null) ?? null,
        body_ta: (n.body_ta as string | null) ?? null,
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
    // Optional Tamil variants (mirrors alerts.ts): Tamil-language users receive
    // these; blank = English goes to everyone, as before.
    const titleTa = String(req.body?.titleTa ?? '').trim() || null
    const bodyTa = String(req.body?.bodyTa ?? '').trim() || null
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
      .insert({
        kind,
        title,
        body,
        title_ta: titleTa,
        body_ta: bodyTa,
        url,
        audience,
        audience_value: audienceValue,
        created_by: req.userId,
      })
      .select('*')
      .single()
    if (error) return sendDbError(res, error)

    let pushSent = 0
    if (kind === 'push' && pushEnabled) {
      const targets = await audienceUserIds(audience, audienceValue)
      pushSent = await sendPushTo(targets, {
        id: row.id as string,
        title,
        body,
        title_ta: titleTa,
        body_ta: bodyTa,
        url,
      })
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
