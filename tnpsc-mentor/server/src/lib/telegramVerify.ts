// ─── Telegram signup phone verification (bot contact-share) ──────────────────
// Fallback when the number being registered has no WhatsApp. Telegram bots
// cannot message a phone number, so the direction is reversed: the signup page
// opens a one-time deep link (t.me/<bot>?start=<token>), the user taps the
// bot's "Share my phone number" button, and Telegram delivers their
// AUTHENTICATED contact to our webhook. If that number matches the one on the
// signup form, the pending row flips to 'verified' and the polling endpoint
// hands the client the same phone-verified ticket the WhatsApp flow issues —
// /register itself doesn't know or care which channel proved ownership.
//
// Trust model: the token is crypto-random and single-use; the contact update
// is only accepted when contact.user_id === message.from.id (the sender shared
// THEIR OWN number, not a forwarded contact card); the webhook itself is
// authenticated by a secret header derived from the bot token (set once via
// setWebhook — see server/setup-telegram-webhook.mjs).

import { createHmac, randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { supabaseAdmin } from '../supabase.js'
import { normalizeMobile } from './msg91.js'

const TOKEN_TTL_MIN = 10
const TG_API = 'https://api.telegram.org'

/** Webhook auth secret, derived from the bot token so no extra env var is
 * needed — Telegram echoes it back in X-Telegram-Bot-Api-Secret-Token. */
export function webhookSecret(): string {
  return createHmac('sha256', config.telegramBotToken).update('tg-webhook').digest('hex').slice(0, 48)
}

export type StartResult = { token: string; url: string }

export type StatusResult =
  | { status: 'pending' }
  | { status: 'verified'; phone: string }
  | { status: 'mismatch' }
  | { status: 'expired' }

/** Fire a Telegram Bot API method. Best-effort by design: a failed reply to the
 * user must never break the verification state machine — log and move on. */
async function tg(method: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${TG_API}/bot${config.telegramBotToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[tg-verify]', method, 'failed', res.status, body.slice(0, 200))
    }
  } catch (e) {
    console.error('[tg-verify]', method, 'network error', e instanceof Error ? e.message : e)
  }
}

/** Create a pending verification and hand back the bot deep link. */
export async function startTelegramVerification(tenDigit: string): Promise<StartResult | null> {
  // 24 bytes → 32-char base64url: comfortably inside Telegram's 64-char,
  // [A-Za-z0-9_-] start-payload limit and unguessable.
  const token = randomBytes(24).toString('base64url')
  const { error } = await supabaseAdmin.from('telegram_verifications').insert({
    token,
    phone: tenDigit,
    status: 'pending',
    expires_at: new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString(),
  })
  if (error) {
    console.error('[tg-verify] start insert failed', error.message)
    return null
  }
  // Opportunistic sweep of long-dead rows (same pattern as phone_otps).
  void supabaseAdmin
    .from('telegram_verifications')
    .delete()
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .then(({ error: e }) => {
      if (e) console.error('[tg-verify] cleanup failed', e.message)
    })
  return { token, url: `https://t.me/${config.telegramBotUsername}?start=${token}` }
}

/** Poll a pending verification. 'verified' is consumed on read (single-use):
 * the caller immediately turns it into a phone-verified ticket. */
export async function checkTelegramVerification(token: string): Promise<StatusResult> {
  const { data: row } = await supabaseAdmin
    .from('telegram_verifications')
    .select('phone, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!row) return { status: 'expired' }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await supabaseAdmin.from('telegram_verifications').delete().eq('token', token)
    return { status: 'expired' }
  }
  if (row.status === 'verified') {
    await supabaseAdmin.from('telegram_verifications').delete().eq('token', token)
    return { status: 'verified', phone: row.phone as string }
  }
  if (row.status === 'mismatch') return { status: 'mismatch' }
  return { status: 'pending' }
}

// ─── Webhook update handling ──────────────────────────────────────────────────

/** The slice of a Telegram update the flow needs (Bot API "Update" object). */
interface TgUpdate {
  message?: {
    text?: string
    chat?: { id?: number }
    from?: { id?: number }
    contact?: { phone_number?: string; user_id?: number }
  }
}

const SHARE_KEYBOARD = {
  keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

/**
 * Process one webhook update. Two shapes matter:
 *   "/start <token>"  → bind the chat to the pending row, ask for the contact
 *   contact message   → match the Telegram-verified number against the row
 * Everything else gets a gentle pointer back to the app. Never throws — the
 * webhook route must always 200 or Telegram retries the update forever.
 */
export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  const msg = update?.message
  const chatId = msg?.chat?.id
  if (!msg || typeof chatId !== 'number') return

  try {
    // ── /start <token> ────────────────────────────────────────────────────────
    const text = typeof msg.text === 'string' ? msg.text.trim() : ''
    if (text.startsWith('/start')) {
      const token = text.slice('/start'.length).trim()
      const { data: row } = token
        ? await supabaseAdmin
            .from('telegram_verifications')
            .select('token, status, expires_at')
            .eq('token', token)
            .maybeSingle()
        : { data: null }
      const live =
        row &&
        row.status === 'pending' &&
        new Date(row.expires_at as string).getTime() > Date.now()
      if (!live) {
        await tg('sendMessage', {
          chat_id: chatId,
          text:
            'This verification link has expired or was already used. ' +
            'Please go back to the TNPSC Mentor app and start again.\n\n' +
            'இந்த சரிபார்ப்பு இணைப்பு காலாவதியாகிவிட்டது. TNPSC Mentor செயலிக்குத் திரும்பி மீண்டும் தொடங்கவும்.',
        })
        return
      }
      await supabaseAdmin
        .from('telegram_verifications')
        .update({ chat_id: chatId })
        .eq('token', row.token)
      await tg('sendMessage', {
        chat_id: chatId,
        text:
          'Welcome to TNPSC Mentor! 🎓\n\n' +
          'To verify your mobile number, tap the button below and allow Telegram to share it.\n\n' +
          'உங்கள் கைபேசி எண்ணைச் சரிபார்க்க, கீழே உள்ள பொத்தானை அழுத்தி எண்ணைப் பகிரவும்.',
        reply_markup: SHARE_KEYBOARD,
      })
      return
    }

    // ── shared contact ────────────────────────────────────────────────────────
    if (msg.contact) {
      // Only the sender's own contact proves ownership — a forwarded contact
      // card carries someone else's user_id (or none) and must be rejected.
      if (msg.contact.user_id !== msg.from?.id) {
        await tg('sendMessage', {
          chat_id: chatId,
          text: 'Please share your own phone number using the button below.',
          reply_markup: SHARE_KEYBOARD,
        })
        return
      }
      const { data: rows } = await supabaseAdmin
        .from('telegram_verifications')
        .select('token, phone, expires_at')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      const row = rows?.[0]
      if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
        await tg('sendMessage', {
          chat_id: chatId,
          text:
            'This verification has expired. Please go back to the app and start again.\n\n' +
            'இந்த சரிபார்ப்பு காலாவதியாகிவிட்டது. செயலிக்குத் திரும்பி மீண்டும் தொடங்கவும்.',
          reply_markup: { remove_keyboard: true },
        })
        return
      }
      const shared = normalizeMobile(msg.contact.phone_number ?? '')
      const matches = Boolean(shared) && shared === row.phone
      await supabaseAdmin
        .from('telegram_verifications')
        .update({ status: matches ? 'verified' : 'mismatch' })
        .eq('token', row.token)
      await tg('sendMessage', {
        chat_id: chatId,
        text: matches
          ? '✅ Number verified! Return to the TNPSC Mentor app to finish creating your account.\n\n' +
            '✅ எண் சரிபார்க்கப்பட்டது! கணக்கை முடிக்க TNPSC Mentor செயலிக்குத் திரும்பவும்.'
          : '❌ This Telegram account is linked to a different mobile number than the one you entered. ' +
            'Please sign up with the number your Telegram uses, or go back and enter a number that has WhatsApp.\n\n' +
            '❌ இந்த Telegram கணக்கு நீங்கள் உள்ளிட்ட எண்ணுடன் இணைக்கப்படவில்லை. ' +
            'உங்கள் Telegram எண்ணுடன் பதிவு செய்யவும் அல்லது WhatsApp உள்ள எண்ணை உள்ளிடவும்.',
        reply_markup: { remove_keyboard: true },
      })
      return
    }

    // ── anything else ─────────────────────────────────────────────────────────
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'This bot verifies mobile numbers for TNPSC Mentor signups. Please start from the app.',
    })
  } catch (e) {
    // Log and swallow — the route's 200 must go out regardless.
    console.error('[tg-verify] update handling failed', e instanceof Error ? e.message : e)
  }
}
