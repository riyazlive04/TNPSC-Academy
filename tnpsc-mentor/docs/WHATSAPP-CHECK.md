# WhatsApp number check at signup (Evolution GO)

Signup refuses mobile numbers that have **no WhatsApp account**, so every number
in `profiles.phone` is one we can actually message. There is no code to send and
nothing for the user to type: the server asks its Evolution gateway "does
WhatsApp know this number?" inside the same submit that creates the account.

> **This is a reachability check, not ownership proof.** Any number that happens
> to be on WhatsApp passes, whoever typed it — it stops typos, landlines and
> WhatsApp-less numbers, not impersonation. If you need to prove the person
> *owns* the number, use the OTP gate in [WHATSAPP-OTP.md](WHATSAPP-OTP.md)
> instead; it sends a code and makes them type it back. **When both are
> configured the OTP wins** and this check is ignored (`/api/auth/config`
> advertises `whatsappCheck` only while `whatsappOtp` is off), so the two can
> never both run.

## How the flow works

```
RegisterPage (form valid)
  → POST /api/auth/register/whatsapp/check   { phone }
      · rejects numbers already on an account (409 phone_already_registered)
      · asks the gateway: POST <base>/user/check  {"number":["91…"]}
        → 200 {data:{Users:[{IsInWhatsapp:true|false, …}]}, message:"success"}
      · no WhatsApp  → 404 phone_no_whatsapp         ← the hard block
      · on WhatsApp  → 200 { ticket, checked: true } ← signed 15-min ticket
  → POST /api/auth/register                  { ...form, phoneTicket }
      · server accepts ONLY with a valid ticket matching the phone
```

Both calls happen inside one submit — the user sees the button say "Checking…"
and then lands on the dashboard. The only visible interruption is the block.

**Google signups are gated too.** They never call `/register`; their number is
collected on `/complete-profile` and saved via `PATCH /api/profile`, which
demands the identical ticket whenever a non-empty phone is being set. Clearing a
phone needs no ticket — only attaching one makes a claim.

Everything is server-enforced: with `EVOLUTION_*` configured, `/register`
returns `403 phone_not_verified` without a valid ticket, so the check cannot be
skipped with curl. With the vars blank, signup behaves exactly as before.

## When the number has no WhatsApp

The user is blocked and told so, and the signup form offers the **Telegram
fallback** ([WHATSAPP-OTP.md § Telegram fallback](WHATSAPP-OTP.md)) as the way
through: they share their Telegram-verified contact with the bot, which issues
the same ticket by proving the number a different way. Without the Telegram bot
configured, changing the number is the only way forward — so a user whose only
mobile has no WhatsApp cannot sign up at all. Keep the bot armed.

## One-time setup

> **This is Evolution GO** ([github.com/EvolutionAPI/evolution-go](https://github.com/EvolutionAPI/evolution-go)),
> not the Evolution API v2 this project used for message delivery in July 2026.
> Different routes, different response shape — v2's docs do not apply here. The
> live spec is at `<base>/swagger/doc.json`.

1. **Have a QR-paired instance.** The project's gateway is
   `https://chat.sirahagents.com` (manager UI at `/manager`). List what is
   paired and which pairings are actually live:
   ```bash
   curl -H "apikey: <GLOBAL admin key>" https://chat.sirahagents.com/instance/all
   ```
   Each entry carries `name`, `jid`, `connected` and its own `token`. The
   instance in use for this app is **SirahDigital** (`jid 919789961631`).
2. **Take that instance's `token`** — *not* the global admin key. See the
   warning below.
3. **Set the vars** in `server/.env` (see `server/.env.example`):
   ```
   EVOLUTION_BASE_URL=https://chat.sirahagents.com
   EVOLUTION_INSTANCE=SirahDigital          # optional, log label only
   EVOLUTION_API_KEY=<that instance's token>
   ```
4. **Reload** so PM2 picks up the new env: `pm2 reload tnpsc-api --update-env`.
5. **Confirm the gate is live:**
   ```bash
   curl https://app.tnpscmentors.in/api/auth/config
   # → "whatsappCheck":true
   ```
6. **Confirm end to end** with a number you know is on WhatsApp and one you know
   is not. This endpoint creates nothing — it only returns a ticket — so it is
   safe to call against production:
   ```bash
   curl -X POST https://app.tnpscmentors.in/api/auth/register/whatsapp/check         -H 'Content-Type: application/json' -d '{"phone":"<a spare number>"}'
   # on WhatsApp → {"ticket":"pv.…","checked":true}
   # no WhatsApp → {"error":"phone_no_whatsapp"}
   ```
   `"checked": false` on a 200 means the gateway did **not** answer and the
   number was passed through unverified — see below.

> ### Use the instance token, never the global key
> The host's global/admin apikey does two things that make it wrong here: it is
> **rejected** by `/user/check` (401 — the route authenticates per instance),
> and it can **read and control every instance on the host**, including other
> clients' (that one gateway carries 14 pairings for unrelated businesses, and
> `GET /instance/all` hands out all of their tokens). Only ever put the single
> instance's own token in this server's env.

## It fails OPEN, on purpose

If the gateway cannot be reached — wrong key, wrong instance name, or (most
often) the paired phone logged out and the QR needs re-scanning — the lookup
returns no verdict and the route **lets the signup through** with
`checked: false`, logging:

```
[wa-check] UNVERIFIED PASS — gateway gave no answer for 98765…
```

That is deliberate. Failing closed would stop *every* signup in the product the
moment a WhatsApp Web session drops, and this project has already lost a day of
signups to a verification dependency that failed closed (the HIBP password check
in August 2026). A few unreachable numbers are the cheaper mistake.

The cost is that **a dead gateway means a silently-off gate**. Nothing pages you
about it, so check it deliberately:

```bash
pm2 logs tnpsc-api --nostream | grep wa-check
```

- `gateway error … 401` → wrong `EVOLUTION_API_KEY`; most likely the global
  admin key was used instead of the instance's own token
- `gateway error … 404` → wrong `EVOLUTION_BASE_URL` (Evolution GO answers a
  bare `404 page not found`, which is not JSON)
- `gateway error … 500` / `Connection Closed` → instance logged out; check
  `GET <base>/instance/all` for `connected:false` and re-pair the QR
- `gateway unreachable` → DNS/network, or the gateway host is down
- `unexpected response` → the gateway changed its response shape (or the base
  URL now points at an Evolution **v2** host, which answers a different shape
  entirely); see `readVerdict()` in `server/src/lib/whatsappCheck.ts`

## Operational caveats

- **Ban risk.** Evolution is an *unofficial* WhatsApp Web (Baileys) gateway: the
  paired number is acting as a normal client, and WhatsApp can ban it for
  automated behaviour. This is why the project moved off Evolution for message
  *delivery* in July 2026. Lookups are far quieter than bulk sends, but the risk
  is not zero — pair a number you can afford to lose, not the business line.
  The instance currently in use (SirahDigital, `919789961631`) is a shared Sirah
  house pairing, so a ban would take out whatever else rides on it too.
- **Lookups are cached for an hour** per number (in-process, 5 000 entries max),
  so a resubmitted form costs one gateway call, not several. Only real verdicts
  are cached; an `unknown` is always retried.
- **Rate limit: 15 checks / 15 min per IP.** Keyed on IP *alone*, not phone+IP
  like the OTP limiters — the abuse being bounded is someone sweeping a range of
  numbers to learn which are on WhatsApp, which a phone+IP key would not stop.
- **It is an enumeration oracle, by nature.** The endpoint is unauthenticated
  (it has to be — the account does not exist yet) and tells the caller whether a
  number is on WhatsApp. The rate limit is what keeps that cheap-to-abuse fact
  from being bulk-harvested; do not raise it casually.
- **Restarting the server clears the cache**, so the first lookups after a
  deploy all hit the gateway.

## Key files

| What | Where |
| --- | --- |
| The lookup + cache + fail-open verdicts | `server/src/lib/whatsappCheck.ts` |
| Its tests (every failure shape → `unknown`) | `server/src/lib/whatsappCheck.test.ts` |
| Endpoint, rate limit, ticket issuing | `server/src/routes/auth.ts` |
| The `pv` ticket both gates issue | `server/src/lib/otpTicket.ts` |
| Config vars + `whatsappCheckEnabled` / `phoneVerifyRequired` | `server/src/config.ts` |
| Live API spec (the authority on the gateway's contract) | `<base>/swagger/doc.json` |
| Google-path gate | `server/src/routes/profile.ts` |
| Signup UI | `src/pages/RegisterPage.tsx`, `src/pages/CompleteProfilePage.tsx` |
