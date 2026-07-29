// ─── Telegram channel broadcast ──────────────────────────────────────────────
// Posting a document to the public channel, used by /api/ca-telegram to publish
// a current-affairs issue as a PDF. Unrelated to lib/telegramVerify.ts (signup
// phone verification) beyond sharing a bot token by default — a bot can both
// answer DMs and post to a channel it administers.
//
// The upload is a plain multipart POST built from Node's global FormData/Blob
// (no dependency needed on Node 20). Unlike the verification helper, failures
// here are NOT swallowed: the superadmin pressed "Send" and must be told
// exactly what Telegram said.

import { config } from '../config.js'

const TG_API = 'https://api.telegram.org'

/** Telegram's hard cap on a caption, in characters (not bytes). */
export const CAPTION_MAX = 1024
/** Telegram's hard cap on a document uploaded by a bot. */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024

export type SendResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string }

/** Turn a Bot API failure into something a human can act on. */
function describe(status: number, description: string): string {
  const d = description || `Telegram returned ${status}`
  if (/chat not found/i.test(d)) {
    return 'Telegram could not find that channel. Check the @username (or numeric id) in the settings above.'
  }
  if (/not enough rights|need administrator|CHAT_ADMIN_REQUIRED/i.test(d)) {
    return 'The bot is not allowed to post there. Add it to the channel as an administrator with "Post Messages".'
  }
  if (/bot was blocked|bot is not a member/i.test(d)) {
    return 'The bot is not a member of that channel. Add it as an administrator and try again.'
  }
  if (/too many requests|retry after/i.test(d)) {
    return 'Telegram is rate-limiting the bot. Wait a minute and send again.'
  }
  return d
}

interface TgResponse {
  ok?: boolean
  description?: string
  result?: { message_id?: number }
}

/** One sendDocument call. `parseMode` undefined → the caption goes as plain text. */
async function postDocument(
  chatId: string,
  pdf: Buffer,
  filename: string,
  caption: string,
  parseMode?: 'HTML'
): Promise<{ status: number; body: TgResponse }> {
  const form = new FormData()
  form.append('chat_id', chatId)
  if (caption) form.append('caption', caption)
  if (parseMode) form.append('parse_mode', parseMode)
  form.append(
    'document',
    // Buffer → Uint8Array view keeps this a zero-copy Blob over the same memory.
    new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
    filename
  )

  const res = await fetch(`${TG_API}/bot${config.telegramCaBotToken}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const body = (await res.json().catch(() => ({}))) as TgResponse
  return { status: res.status, body }
}

/**
 * Send one PDF to the channel with its caption.
 *
 * The caption is submitted as HTML so a superadmin can bold a headline, but a
 * stray '<' in ordinary prose would make Telegram reject the whole post — so an
 * entity-parse failure is retried once as plain text rather than surfaced. Any
 * other failure is reported.
 */
export async function sendChannelDocument({
  chatId,
  pdf,
  filename,
  caption,
}: {
  chatId: string
  pdf: Buffer
  filename: string
  caption: string
}): Promise<SendResult> {
  if (!config.telegramCaBotToken) {
    return { ok: false, error: 'No Telegram bot token is configured on the server.' }
  }
  try {
    let { status, body } = await postDocument(chatId, pdf, filename, caption, 'HTML')

    if (!body?.ok && /can'?t parse entities|unsupported start tag|unclosed/i.test(body?.description ?? '')) {
      ;({ status, body } = await postDocument(chatId, pdf, filename, caption))
    }

    if (!body?.ok) {
      console.error('[tg-channel] sendDocument failed', status, body?.description)
      return { ok: false, error: describe(status, body?.description ?? '') }
    }
    return { ok: true, messageId: Number(body.result?.message_id ?? 0) }
  } catch (e) {
    console.error('[tg-channel] network error', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Could not reach Telegram. Please try again.' }
  }
}
