import webpush from 'web-push'
import { config, pushEnabled } from './config.js'
import { supabaseAdmin } from './supabase.js'

// Configure web-push once at module load (only when keys are present). Importing
// this module anywhere (the notifications route, post-submit hooks) wires it up.
if (pushEnabled) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
}

export interface PushPayload {
  id: string
  title: string
  body: string
  url: string | null
}

/**
 * Send a Web Push to every subscription of the given users, pruning dead subs
 * (404/410). Returns the count of successful sends. Best-effort — callers treat
 * push as fire-and-forget, so this never throws.
 */
export async function sendPushTo(userIds: string[], payload: PushPayload): Promise<number> {
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

/**
 * File an in-app 'system' notification aimed at admins/superadmins (audience
 * 'admin', resolved in routes/notifications.ts). In-app only — no Web Push — so
 * it surfaces passively in the admin's bell/feed.
 *
 * Best-effort: never throws. A failed alert must not break the action that
 * triggered it (e.g. a coupon redemption). Returns the new id, or null.
 */
export async function notifyAdmins(
  title: string,
  body: string,
  url: string | null = null
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        kind: 'system',
        title,
        body,
        url,
        audience: 'admin',
        audience_value: null,
        created_by: null,
      })
      .select('id')
      .single()
    if (error) {
      console.warn('[notifyAdmins] insert failed:', error.message)
      return null
    }
    return (data?.id as string) ?? null
  } catch (e) {
    console.warn('[notifyAdmins] threw:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * File an in-app notification aimed at ONE user (target_user_id) and — unless
 * `push` is false — also deliver it to that user's devices via Web Push. The
 * feed (GET /api/notifications) surfaces it passively in their bell; the push is
 * the active, on-device nudge. Best-effort: never throws, so a notification
 * failure can't break the action that triggered it. Returns the new id, or null.
 */
export async function notifyUser(
  userId: string,
  opts: { title: string; body: string; url?: string | null; push?: boolean }
): Promise<string | null> {
  const { title, body, url = null, push = true } = opts
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        kind: push ? 'push' : 'system',
        title,
        body,
        url,
        audience: 'all', // ignored for matching once target_user_id is set
        audience_value: null,
        target_user_id: userId,
        created_by: null,
      })
      .select('id')
      .single()
    if (error) {
      console.warn('[notifyUser] insert failed:', error.message)
      return null
    }
    const id = (data?.id as string) ?? null
    if (push && id) {
      const sent = await sendPushTo([userId], { id, title, body, url })
      if (sent > 0) {
        await supabaseAdmin.from('notifications').update({ push_sent: sent }).eq('id', id)
      }
    }
    return id
  } catch (e) {
    console.warn('[notifyUser] threw:', e instanceof Error ? e.message : e)
    return null
  }
}
