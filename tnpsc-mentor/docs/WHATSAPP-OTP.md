# WhatsApp signup OTP (Evolution API)

Signup now verifies that the aspirant **owns** the mobile number they register:
a 6-digit code is sent to that number **on WhatsApp**, and the account is only
created after the code checks out. Delivery goes through
[Evolution API](https://github.com/EvolutionAPI/evolution-api) — a self-hosted
WhatsApp gateway that pairs a real WhatsApp number (QR scan, like WhatsApp Web)
and exposes a REST API for sending messages.

## How the flow works

```
RegisterPage (form valid)
  → POST /api/auth/register/otp/send    { phone }
      · rejects numbers already on an account (phone_already_registered)
      · rejects numbers with no WhatsApp   (phone_no_whatsapp)
      · generates a 6-digit code, stores ONLY its HMAC in public.phone_otps
        (10-min expiry, 5 wrong guesses, 45 s resend cooldown)
      · sends the code via Evolution API → the user's WhatsApp
  → user types the code
  → POST /api/auth/register/otp/verify  { phone, otp }
      · success returns a signed 15-min "phone-verified ticket"
  → POST /api/auth/register             { ...form, phoneTicket }
      · server accepts ONLY with a valid ticket matching the phone
```

Everything is server-enforced: with `EVOLUTION_*` configured, `/register`
returns `403 phone_not_verified` without a valid ticket — the OTP step cannot
be skipped with curl. With the vars blank, signup behaves exactly as before.

- Rate limits: 5 sends / 30 min and 10 verify attempts / 15 min per phone+IP
  (same limiters as the MSG91 login OTP), plus the per-phone cooldown and
  guess budget in `phone_otps` itself.
- Code storage: HMAC-SHA256 keyed with the service-role key, phone bound in.
  Plaintext codes never touch the DB or logs.

## One-time setup on the VPS

1. **Pick the sender number.** A real SIM/number that will become the
   "TNPSC Mentor" WhatsApp sender. Use a dedicated number, NOT anyone's
   personal WhatsApp — pairing here logs it into this gateway.

2. **Run Evolution API (Docker, localhost-only port):**

   ```bash
   docker run -d --name evolution-api --restart unless-stopped \
     -p 127.0.0.1:8080:8080 \
     -e AUTHENTICATION_API_KEY='<generate-a-long-random-key>' \
     -v evolution_instances:/evolution/instances \
     evoapicloud/evolution-api:latest
   ```

   Keep the port bound to `127.0.0.1` — the API server talks to it on
   localhost; it must never be reachable through Nginx/the internet.

3. **Create + pair the instance:**

   ```bash
   # create
   curl -X POST http://127.0.0.1:8080/instance/create \
     -H 'apikey: <your-key>' -H 'Content-Type: application/json' \
     -d '{"instanceName":"tnpsc-otp","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'

   # fetch the pairing QR (base64 PNG in the response)
   curl http://127.0.0.1:8080/instance/connect/tnpsc-otp -H 'apikey: <your-key>'
   ```

   Scan the QR from the sender phone: WhatsApp → Linked devices → Link a
   device. Confirm with
   `curl http://127.0.0.1:8080/instance/connectionState/tnpsc-otp -H 'apikey: <your-key>'`
   → `"state":"open"`.

4. **Point the API server at it** — in `server/.env`:

   ```
   EVOLUTION_API_URL=http://127.0.0.1:8080
   EVOLUTION_API_KEY=<your-key>
   EVOLUTION_INSTANCE=tnpsc-otp
   ```

   Restart PM2 (`pm2 restart tnpsc-api --update-env`).

5. **Enable the frontend step** — build with `VITE_SIGNUP_WA_OTP=true` in
   `.env.production`, then redeploy the SPA. This flag must mirror the server:
   server on + flag off breaks signup (register demands a ticket the UI never
   fetched); server off + flag on breaks it the other way (send returns 503).

6. **Smoke test:**

   ```bash
   curl -X POST http://127.0.0.1:8080/message/sendText/tnpsc-otp \
     -H 'apikey: <your-key>' -H 'Content-Type: application/json' \
     -d '{"number":"91XXXXXXXXXX","text":"TNPSC Mentor gateway test"}'
   ```

   Then register a test account end-to-end from the app.

## Telegram fallback (numbers with no WhatsApp)

When `/register/otp/send` answers `phone_no_whatsapp`, the signup page offers
**"Verify via Telegram instead"**. Telegram bots can't message a phone number,
so the direction reverses — the user comes to us:

```
RegisterPage → POST /api/telegram/start { phone }
    · same uniqueness pre-check; stores a pending row in telegram_verifications
    · returns t.me/<bot>?start=<one-time-token> (opened in a new tab)
user taps Start in the bot
    → Telegram → POST /api/telegram/webhook (/start <token>)
    · row is bound to the chat; bot shows a "📱 Share my phone number" button
user taps the button
    → webhook receives the TELEGRAM-VERIFIED contact
    · accepted only when contact.user_id === sender id (no forwarded cards)
    · matches the number on the form → row 'verified' (else 'mismatch')
RegisterPage polls POST /api/telegram/status { token } every 3 s
    · 'verified' → returns the SAME phone-verified ticket → signup continues
```

The register gate is untouched — a ticket is a ticket, whichever channel
proved ownership. Note the inherent constraint: this verifies numbers whose
Telegram account is registered ON that number. No WhatsApp *and* no Telegram
on the number → cannot verify (SMS via MSG91 would be the eventual fallback).

### Telegram one-time setup

1. In Telegram, talk to **@BotFather** → `/newbot` → pick a name and a
   username. Copy the full token (`<bot_id>:<secret>` — both halves).
2. In `server/.env` set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`,
   restart the API server.
3. Register the webhook once (after the server is live over HTTPS):
   `node -r dotenv/config setup-telegram-webhook.mjs` — it derives the same
   `secret_token` the webhook route validates, so no extra secret to manage.
4. Rebuild the frontend with `VITE_SIGNUP_TG_VERIFY=true`.

## Operational caveats

- **Unofficial channel.** Evolution API drives WhatsApp through the WhatsApp
  Web protocol (Baileys), not the official Business API. WhatsApp can ban
  numbers it flags as automated spam. OTP-on-request to users who just typed
  their own number is low-risk behaviour, but: keep the sender number
  dedicated (cheap to replace), warm it up with normal usage first, and if it
  is ever banned, pair a new number and update nothing but the QR pairing.
- **Session drops.** If the phone is off/offline for long periods the linked
  session can disconnect; sends then fail (users see "could not send the
  code"). Check `connectionState`, re-scan the QR to recover. Consider a
  monitor/alert on that endpoint.
- **DB table.** `public.phone_otps` (see `supabase/phone_otps.sql`) is
  service-role-only (RLS on, no policies). Rows are single-use and dead rows
  are swept opportunistically on each send.
