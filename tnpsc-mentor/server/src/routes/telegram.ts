// ─── /api/telegram — signup phone verification via the Telegram bot ──────────
// Fallback channel when the number being registered has no WhatsApp (see
// lib/telegramVerify.ts for the flow and trust model). Mounted OUTSIDE
// /api/auth on purpose: the signup page polls /status every few seconds, which
// would exhaust the strict 30-req/min band /api/auth lives under.

import { Router, type Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import { asyncH } from '../util.js'
import { telegramVerifyEnabled } from '../config.js'
import { normalizeMobile } from '../lib/msg91.js'
import { phoneTakenByOther } from '../lib/phone.js'
import { issuePhoneVerifyTicket } from '../lib/otpTicket.js'
import {
  startTelegramVerification,
  checkTelegramVerification,
  handleTelegramUpdate,
  webhookSecret,
} from '../lib/telegramVerify.js'

const router = Router()

/** Same phone+IP keying rationale as the OTP limiters in routes/auth.ts. */
function phoneIpKey(req: Request): string {
  const phone = typeof req.body?.phone === 'string' ? normalizeMobile(req.body.phone) : ''
  return `${phone}|${req.ip}`
}

/** Verification starts per phone+IP. Cheap (no message is sent — the user
 * initiates inside Telegram) but each mints a DB row, so keep it bounded. */
const startLimiter = rateLimit({
  windowMs: 30 * 60_000,
  max: 10,
  keyGenerator: phoneIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many attempts. Please wait a while and try again.' },
})

/** Status polls per IP — the page polls every ~3 s for up to 5 minutes. */
const statusLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many requests. Please slow down.' },
})

// ─── POST /api/telegram/start ─────────────────────────────────────────────────
// Begin a verification for a number being signed up: returns the one-time bot
// deep link plus the token the page will poll with.
router.post(
  '/start',
  startLimiter,
  asyncH(async (req, res) => {
    if (!telegramVerifyEnabled) {
      return res.status(503).json({ error: 'Telegram verification is not configured' })
    }
    const phone = normalizeMobile(typeof req.body?.phone === 'string' ? req.body.phone : '')
    if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' })
    // Same pre-check as the WhatsApp send — fail before the user leaves the app.
    if (await phoneTakenByOther(phone)) {
      return res.status(409).json({ error: 'phone_already_registered' })
    }
    const started = await startTelegramVerification(phone)
    if (!started) {
      return res.status(502).json({ error: 'Could not start verification. Please try again.' })
    }
    res.json(started)
  })
)

// ─── POST /api/telegram/status ────────────────────────────────────────────────
// Poll a pending verification. On 'verified' the response carries the SAME
// phone-verified ticket the WhatsApp flow issues — /register treats both alike.
router.post(
  '/status',
  statusLimiter,
  asyncH(async (req, res) => {
    if (!telegramVerifyEnabled) {
      return res.status(503).json({ error: 'Telegram verification is not configured' })
    }
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) return res.status(400).json({ error: 'Token is required' })
    const result = await checkTelegramVerification(token)
    if (result.status === 'verified') {
      return res.json({ status: 'verified', ticket: issuePhoneVerifyTicket(result.phone) })
    }
    res.json({ status: result.status })
  })
)

// ─── POST /api/telegram/webhook ───────────────────────────────────────────────
// Telegram pushes bot updates here (configured via setWebhook with a
// secret_token — see server/setup-telegram-webhook.mjs). The secret header is
// the auth: anything without it is dropped. Always 200 fast on valid requests;
// Telegram retries non-2xx responses indefinitely.
router.post(
  '/webhook',
  asyncH(async (req, res) => {
    if (!telegramVerifyEnabled) return res.status(503).json({ error: 'not configured' })
    if (req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret()) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    await handleTelegramUpdate(req.body ?? {})
    res.json({ ok: true })
  })
)

export default router
