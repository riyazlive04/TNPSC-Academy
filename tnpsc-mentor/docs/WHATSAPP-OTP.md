# WhatsApp signup OTP (AiSensy)

Signup verifies that the aspirant **owns** the mobile number they register:
a 6-digit code is sent to that number **on WhatsApp**, and the account is only
created after the code checks out. Delivery goes through
[AiSensy](https://aisensy.com) — a WhatsApp Business API platform riding the
**official** Meta Cloud API: a Meta-approved *Authentication* template is wired
to an AiSensy "API campaign", and the server triggers that campaign per send.

> Historical note: this feature originally shipped against a self-hosted
> Evolution API gateway (unofficial WhatsApp Web protocol, QR-paired number).
> It was swapped to AiSensy in July 2026 before ever going live — official
> API, no ban risk, no gateway to babysit. Only the delivery call changed;
> code generation/storage/verification were always server-owned.

## How the flow works

```
RegisterPage (form valid)
  → POST /api/auth/register/otp/send    { phone }
      · rejects numbers already on an account (phone_already_registered)
      · generates a 6-digit code, stores ONLY its HMAC in public.phone_otps
        (10-min expiry, 5 wrong guesses, 45 s resend cooldown)
      · triggers the AiSensy API campaign → the user's WhatsApp
  → user types the code
  → POST /api/auth/register/otp/verify  { phone, otp }
      · success returns a signed 15-min "phone-verified ticket"
  → POST /api/auth/register             { ...form, phoneTicket }
      · server accepts ONLY with a valid ticket matching the phone
```

Everything is server-enforced: with `AISENSY_*` configured, `/register`
returns `403 phone_not_verified` without a valid ticket — the OTP step cannot
be skipped with curl. With the vars blank, signup behaves exactly as before.

**Google signups are gated too.** They never call `/register` — their number is
collected post-signup on `/complete-profile` and saved via `PATCH /api/profile`.
That endpoint demands the identical `phoneTicket` whenever a (non-empty) phone
is being set, and the complete-profile page runs the same send → verify steps
as the signup form. Clearing a phone needs no ticket — only attaching one
claims ownership.

- Rate limits: 5 sends / 30 min and 10 verify attempts / 15 min per phone+IP
  (same limiters as the MSG91 login OTP), plus the per-phone cooldown and
  guess budget in `phone_otps` itself.
- Code storage: HMAC-SHA256 keyed with the service-role key, phone bound in.
  Plaintext codes never touch the DB or logs.
- **No pre-send WhatsApp lookup.** The official API (unlike the old Evolution
  gateway) cannot ask "is this number on WhatsApp?". A WhatsApp-less number is
  accepted by `/register/otp/send` and simply never receives the message —
  the old `phone_no_whatsapp` (404) error is no longer emitted (the client
  still handles it as a harmless dead path).

## One-time setup in AiSensy

1. **Account + WABA.** Sign up at aisensy.com and complete the WhatsApp
   Business API onboarding (Meta business verification + a phone number
   dedicated to the WABA — it can't simultaneously run the normal WhatsApp
   app).

2. **Create the Authentication template** — Templates → Create Template:
   - Name `signup_otp`, **Category: AUTHENTICATION**, Language: English.
   - The body is fixed by Meta (custom OTP wording in any other category is
     auto-rejected). Tick **security recommendation** and **code expiry =
     10 minutes** (matches the server's `OTP_TTL_MIN`), button **Copy Code**.
   - Delivered message: “*123456* is your verification code. For your
     security, do not share this code. This code expires in 10 minutes.”
   - Optional: an identical template with Language = Tamil (Meta supplies the
     fixed Tamil text) if a per-language send is ever wanted.

3. **Create the API campaign** — Campaigns → Create Campaign → **API
   Campaign** → select the approved template → name it (e.g. `signup_otp`)
   → set Live. The campaign name is what the server sends to.

4. **Point the API server at it** — in `server/.env`:

   ```
   AISENSY_API_KEY=<dashboard → Manage → API Key (long JWT)>
   AISENSY_CAMPAIGN_NAME=signup_otp
   ```

   Restart PM2 (`pm2 restart tnpsc-api --update-env`).

5. **Enable the frontend step** — build with `VITE_SIGNUP_WA_OTP=true` in
   `.env.production`, then redeploy the SPA. This flag must mirror the server:
   server on + flag off breaks signup AND Google profile completion (both
   demand a ticket the UI never fetched); server off + flag on breaks it the
   other way (send returns 503).

6. **Smoke test:**

   ```bash
   curl -X POST https://backend.aisensy.com/campaign/t1/api/v2 \
     -H 'Content-Type: application/json' \
     -d '{"apiKey":"<key>","campaignName":"signup_otp","destination":"91XXXXXXXXXX",
          "userName":"smoke-test","templateParams":["123456"],
          "buttons":[{"type":"button","sub_type":"url","index":0,
                      "parameters":[{"type":"text","text":"123456"}]}]}'
   ```

   Then register a test account end-to-end from the app.

## Telegram fallback (numbers with no WhatsApp)

The signup page can offer **"Verify via Telegram instead"**. Telegram bots
can't message a phone number, so the direction reverses — the user comes to us:

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
proved ownership. **Caveat since the AiSensy swap:** the UI used to offer
Telegram when the send answered `phone_no_whatsapp`; that signal no longer
exists (no lookup on the official API), so the fallback currently has no
automatic trigger — if it's ever enabled, surface it as an always-visible
"can't get the code?" option instead.

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

- **Per-message cost.** Authentication-category messages are billed by Meta
  (~₹0.12 each for India as of 2026, plus the AiSensy plan). Cheap per send,
  but the phone+IP rate limits and the 45 s cooldown are also the cost guard —
  keep them.
- **"Accepted" ≠ delivered.** A 2xx from AiSensy means the message was queued
  with Meta. Numbers without WhatsApp fail silently downstream; check the
  AiSensy dashboard/webhooks when investigating "code never arrived" reports.
- **Campaign must stay Live.** Pausing/renaming the API campaign in the
  AiSensy dashboard breaks sends with no code change — the campaign name in
  `server/.env` must always match a live campaign.
- **Template edits re-enter review.** Editing the authentication template
  sends it back through Meta approval; don't touch it casually in production.
- **DB table.** `public.phone_otps` (see `supabase/phone_otps.sql`) is
  service-role-only (RLS on, no policies). Rows are single-use and dead rows
  are swept opportunistically on each send.
