import { supabaseAdmin } from '../supabase.js'
import { notifyUser } from '../notify.js'
import { readReportResolvedMessage } from './settings.js'

// Closing the loop on a student "report this question" (see question_reports.sql):
// when an admin marks a reported question RESOLVED, every student who flagged it
// gets a targeted in-app notification + Web Push. The copy is superadmin-editable
// (app_settings key `report_resolved_message`) rather than hard-coded here.
//
// Re-sends are guarded by question_report_status.notified_at: only reporters whose
// report is NEWER than the last send are messaged. So resolving twice is a no-op,
// while a reopen → new report → resolve cycle notifies just the new reporter.

/** Replace {subject} / {note} and tidy the whitespace an empty token leaves. */
function applyTokens(text: string, tokens: { subject: string; note: string }): string {
  return text
    .replace(/\{subject\}/g, tokens.subject)
    .replace(/\{note\}/g, tokens.note)
    // An unfilled token on its own line would leave a hole — collapse runs.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Notify the reporters of a question that their report was resolved.
 *
 * Best-effort and never throws: the admin's triage action must succeed even if
 * the message fails. Returns how many students were notified.
 */
export async function notifyReportResolved(
  questionId: string,
  note: string | null
): Promise<number> {
  try {
    const msg = await readReportResolvedMessage()
    if (!msg.enabled) return 0

    // Last send watermark for this question (null = never notified).
    const { data: statusRow } = await supabaseAdmin
      .from('question_report_status')
      .select('notified_at')
      .eq('question_id', questionId)
      .maybeSingle()
    const notifiedAt = (statusRow as { notified_at?: string | null } | null)?.notified_at ?? null

    let q = supabaseAdmin
      .from('question_reports')
      .select('user_id')
      .eq('question_id', questionId)
    if (notifiedAt) q = q.gt('updated_at', notifiedAt)
    const { data: reports, error } = await q
    if (error) {
      console.warn('[notifyReportResolved] reporter lookup failed:', error.message)
      return 0
    }
    const userIds = [...new Set((reports ?? []).map((r) => (r as { user_id: string }).user_id))]
    if (userIds.length === 0) return 0

    // {subject} context. The question may have been deleted — fall back to ''.
    const { data: qRow } = await supabaseAdmin
      .from('questions')
      .select('subject')
      .eq('id', questionId)
      .maybeSingle()
    const tokens = {
      subject: ((qRow as { subject?: string | null } | null)?.subject ?? '').trim(),
      note: (note ?? '').trim(),
    }

    const payload = {
      title: applyTokens(msg.title, tokens),
      body: applyTokens(msg.body, tokens),
      title_ta: applyTokens(msg.title_ta, tokens),
      body_ta: applyTokens(msg.body_ta, tokens),
      url: null,
    }

    const results = await Promise.allSettled(userIds.map((id) => notifyUser(id, payload)))
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length

    // Stamp the watermark even on a partial failure — a retry would re-message
    // the students who already got it, which is worse than one missed message.
    await supabaseAdmin
      .from('question_report_status')
      .update({ notified_at: new Date().toISOString() })
      .eq('question_id', questionId)

    return sent
  } catch (e) {
    console.warn('[notifyReportResolved] threw:', e instanceof Error ? e.message : e)
    return 0
  }
}
