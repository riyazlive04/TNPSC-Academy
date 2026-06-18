import { supabaseAdmin } from './supabase.js'

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
