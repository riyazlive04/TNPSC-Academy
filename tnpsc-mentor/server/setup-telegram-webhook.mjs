// One-time setup: point the Telegram bot's webhook at this deployment.
// Reads TELEGRAM_BOT_TOKEN from server/.env and registers the webhook with the
// same derived secret_token lib/telegramVerify.ts expects, so no extra env var
// is needed. Run AFTER the API server is deployed and reachable over HTTPS.
//
// Usage:
//   node -r dotenv/config setup-telegram-webhook.mjs                        # default prod URL
//   node -r dotenv/config setup-telegram-webhook.mjs https://host/api/telegram/webhook
//   node -r dotenv/config setup-telegram-webhook.mjs --delete               # unregister

import { createHmac } from 'node:crypto'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!TOKEN) {
  console.error('FATAL: TELEGRAM_BOT_TOKEN not set (server/.env).')
  process.exit(2)
}

const arg = process.argv[2]
const URL_ = arg && arg !== '--delete' ? arg : 'https://app.tnpscmentors.in/api/telegram/webhook'
const secret = createHmac('sha256', TOKEN).update('tg-webhook').digest('hex').slice(0, 48)

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  })
  return res.json()
}

const me = await tg('getMe')
if (!me.ok) {
  console.error('FATAL: token rejected by Telegram:', JSON.stringify(me))
  process.exit(1)
}
console.log(`Bot: @${me.result.username} (${me.result.first_name})`)

if (arg === '--delete') {
  console.log('deleteWebhook:', JSON.stringify(await tg('deleteWebhook')))
} else {
  const set = await tg('setWebhook', {
    url: URL_,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  })
  console.log('setWebhook →', URL_, ':', JSON.stringify(set))
}

const info = await tg('getWebhookInfo')
console.log('getWebhookInfo:', JSON.stringify(info.result))
