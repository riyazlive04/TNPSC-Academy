import { supabaseAdmin } from '../supabase.js'
import { notifyUser } from '../notify.js'
import { FIRST_TEST_BONUS } from './credits.js'

// ─── First-test nudge ────────────────────────────────────────────────────────
// A user who signed up but never completed a test gets ONE push + in-app nudge,
// the first time they check in after their account is 24h old (younger accounts
// are still inside the signup-tour funnel and shouldn't be pestered). Triggered
// from POST /api/credits/checkin, which every client hits on app load.

/** Deep link carried on the nudge. Doubles as the once-ever dedup key: the
 *  notifications row we insert is itself the "already sent" record. */
export const FIRST_TEST_NUDGE_URL = '/test-arena?src=first-test-nudge'

const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Send the nudge if (and only if) this user is >24h old, has no completed test,
 * and was never nudged before. Best-effort and fire-and-forget: any failure is
 * logged and swallowed — it must never affect the check-in response.
 */
export async function maybeSendFirstTestNudge(userId: string): Promise<void> {
  try {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('created_at, role')
      .eq('id', userId)
      .single()
    if (!prof?.created_at) return
    if (prof.role === 'admin' || prof.role === 'superadmin') return
    if (Date.now() - new Date(prof.created_at as string).getTime() < MIN_ACCOUNT_AGE_MS) return

    const { count: tests, error: tErr } = await supabaseAdmin
      .from('test_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    if (tErr || (tests ?? 0) > 0) return

    const { count: sent, error: nErr } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('target_user_id', userId)
      .eq('url', FIRST_TEST_NUDGE_URL)
    if (nErr || (sent ?? 0) > 0) return

    await notifyUser(userId, {
      title: 'உங்கள் முதல் தேர்வு காத்திருக்கிறது 🎯 Your first test awaits',
      body:
        `18 கேள்விகள், சுமார் 20 நிமிடங்கள் — முடித்தால் +${FIRST_TEST_BONUS} போனஸ் கிரெடிட்கள்! ` +
        `18 questions, ~20 minutes — finish it and earn +${FIRST_TEST_BONUS} bonus credits.`,
      url: FIRST_TEST_NUDGE_URL,
    })
  } catch (e) {
    console.warn('[first-test-nudge]', e instanceof Error ? e.message : e)
  }
}
