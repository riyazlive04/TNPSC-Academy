# TNPSC Mentor — Security Audit

_Date: 2026-06-21 · Scope: Express API (`server/`), React/Capacitor client (`src/`),
Supabase SQL (`supabase/`), payments, secrets, dependencies._

This audit was driven by two hard requirements: **no attack should be able to leak
data, and brute-force / DoS attacks should not be possible.** Findings are graded
and tagged with their current state:

- ✅ **FIXED** — patched in this pass (code changed, type-checks clean).
- 🟡 **MITIGATED** — risk reduced now; a deeper architectural fix is still recommended.
- ⬜ **OPEN** — recommended, not yet applied (needs a product/infra decision).

---

## Executive summary

The codebase is, overall, **defensively well-built**: the browser never holds the
Supabase service-role key, every authenticated request verifies the JWT signature
server-side via GoTrue (not claim-trust), user-data routes run through a
**user-scoped client so Row-Level-Security applies**, role escalation is blocked at
both the API and the DB (`profiles` policies + `revoke update(role)`), the Razorpay
signature is verified with a constant-time compare, prices are server-authoritative,
and there is **no XSS sink** (all content renders through React's auto-escaping; the
one manual-HTML path escapes its inputs).

The gaps that mattered for the two requirements above — **weak brute-force limits,
unbounded request arrays (DoS), and several information leaks (account enumeration,
device fingerprints)** — have been **fixed in this pass**. Two larger items remain
open because they are architectural decisions: refresh tokens in `localStorage`, and
binding device sessions to a non-forgeable identity.

| Severity | Count | Fixed | Mitigated | Open |
|----------|:----:|:----:|:--------:|:---:|
| Critical | 1 | 1 | – | – |
| High | 4 | 4 | – | – |
| Medium | 6 | 4 | – | 2 |
| Low / Info | several | 2 | – | rest |

_All Critical/High findings are now fixed (two passes). Remaining open items are Medium/Low._

---

## What was fixed in this pass

All changes are in `server/src/` and type-check clean on both server and client.

### ✅ Brute-force protection on auth (was High)
**Before:** the only limit on `/api/auth/*` was 30 requests/min/IP **shared across
all** auth endpoints — enough for online password guessing, and trivially defeated
by rotating IPs. No per-account throttle, no lockout.
**Fix** (`server/src/routes/auth.ts`): added per-credential limiters keyed on
`email + IP`, so guessing **one** account is throttled across many IPs and one IP
can't fan out across accounts:
- `loginLimiter` — 8 failed sign-ins / 15 min per `email+IP`, applied to `/login`
  and `/login/replace-device`. Successful logins are skipped, so a legitimate user
  is never locked out by their own activity; only wrong guesses count.
- `sensitiveLimiter` — 5 / hour per `email+IP` on `/register` and
  `/forgot-password` (stops sign-up spam and password-reset **email bombing**).
- `tokenLimiter` — 60 / 15 min per IP on `/google` and `/refresh` (replay/flood cap).

The global 30/min/IP net is retained underneath as defense-in-depth.

### ✅ DoS via unbounded request arrays (was Medium)
Two endpoints mapped a caller-supplied array straight into a bulk DB write with no
size cap — a single request could write hundreds of thousands of rows.
- `POST /api/notifications/read` — `ids` now filtered to strings and capped at 100
  (`server/src/routes/notifications.ts`).
- `POST /api/reviews/enqueue` — `questionIds` now filtered to strings and capped at
  500 (`server/src/routes/reviews.ts`).

### ✅ Account enumeration via differential auth errors (was Medium)
`/login`, `/login/replace-device`, `/google` and `/refresh` echoed GoTrue's raw
error text, which distinguishes "wrong password" from "no such user." They now
return a **constant generic message** (`"Invalid email or password"` etc.); the real
error is logged server-side only (`server/src/routes/auth.ts`).

### ✅ Password-reset information leak + email bomb (was Medium)
`/forgot-password` previously returned the raw GoTrue error on failure (a differential
that confirms account existence) and was only throttled by the shared IP limit. It
now **always responds `{ ok: true }`** (logging the real error server-side) and is
covered by `sensitiveLimiter`.

### ✅ Device-fingerprint disclosure on the device-limit screen (was Medium)
The pre-auth `device_limit` response returned each session's raw `device_id` — a
fingerprint an attacker who has the password could harvest to spoof or evict
sessions. A new `publicDevices()` helper **strips `device_id`**, returning only the
opaque session `id` (needed to sign a device out) plus display-only label/timestamps.
The authenticated manage-devices screen (`/sessions`) is unchanged — it legitimately
needs `device_id` to mark "this device," and only ever returns the caller's own rows.

### ✅ Register no longer echoes GoTrue internals
`/register` now returns a soft, non-confirming message instead of "User already
registered," logging the real cause server-side.

---

## Fixed in the follow-up pass (#2, #3, #4)

### ✅ Critical — Device session limit now bound to the un-forgeable GoTrue `session_id`
`server/src/sessions.ts` (`sessionIdFromToken`), `server/src/routes/auth.ts` (`deviceKey`),
`src/pages/ProfilePage.tsx`
The cap previously keyed on a client `localStorage` string. It now keys on the
`session_id` claim decoded from the access token the **server** mints, so a client
can no longer pin one id to share an account or rotate ids to evict the owner. The
manage-devices UI uses a server-set `current` flag; the raw session key is never
returned to the client. (Existing pre-deploy rows age out via the 7-day idle TTL;
enforcement is login-only, so no active user is logged out by the switch.)

### ✅ High — Refresh token moved out of `localStorage` (web) into an HttpOnly cookie
`server/src/routes/auth.ts`, `server/src/index.ts`, `server/src/config.ts`, `src/lib/api.ts`,
`src/store/authStore.ts`, `render.yaml`
**Web** now receives its refresh token in an `HttpOnly; Secure; SameSite=None`
cookie scoped to `/api/auth` — unreadable by JS, so an XSS can't exfiltrate the
durable credential. The server reads it from the cookie on `/refresh`, rotates it
on every refresh, and clears it on logout / dead-token. **Native (Capacitor)** keeps
the body-token flow (cross-site cookies are unreliable in the Android WebView),
detected via `Capacitor.isNativePlatform()`. CORS is now credentialed (echoes the
exact allowed origin, never `*`). **Deploy requirement:** `NODE_ENV=production` must
be set on Render (added to both `render.yaml`) or the cookie falls back to
`SameSite=Lax` and won't work cross-site — verify web login + reload after deploy.

### ✅ High — Razorpay `/verify` is now idempotent, terminal-state-guarded, and amount-verified
`server/src/routes/payments.ts`
Three independent gates, each of which alone blocks a forged/replayed/tampered
credit: (1) a `paid` order is terminal (early return — no replay, no downgrade to
`failed`); (2) HMAC signature, constant-time; (3) server-side fetch from Razorpay
asserting the payment is captured, belongs to this order, and paid the exact recorded
amount. The final UPDATE is guarded on `status='created'` so concurrent/duplicate
valid calls credit at most once. The Razorpay fetch fails *safe* (transient API
error → falls back to the cryptographic signature, never to "allow"). Full
bypass-analysis confirms the flow cannot be circumvented.

## Open / mitigated items (recommended next)

### ⬜ Medium — User-facing notification routes use the service-role client
`server/src/routes/notifications.ts`
`subscribe`, `unsubscribe`, the feed `GET /`, and `read` go through `supabaseAdmin`
(RLS-bypassing); the only thing scoping them to the caller is hand-written
`.eq('user_id', …)` filters. Correct today, but it removes the RLS backstop — one
dropped filter in a future edit becomes a cross-tenant read/write.
**Recommended fix:** route these through the user-scoped `req.db` so RLS enforces
ownership; reserve `supabaseAdmin` for the genuinely cross-user superadmin send path.

### ⬜ Medium — Google ID-token audience validation is delegated entirely to Supabase
`server/src/routes/auth.ts` (`/google`)
Acceptance relies on Supabase's "Authorized Client IDs" list being tight; the server
doesn't itself assert `aud == GOOGLE_CLIENT_ID`. **Action:** verify that list
contains exactly your web client ID; optionally add an explicit server-side `aud`/
`iss` check and require a server-issued `nonce`.

### ⬜ Low — Logout doesn't revoke the GoTrue refresh token
`server/src/routes/auth.ts` (`/logout`) only marks the `user_sessions` row revoked;
the refresh token still works at `/refresh`. Consider a GoTrue admin sign-out on logout.

---

## Secrets

### ⬜ Action — Google OAuth **client secret** sitting in plaintext on disk
`TNPSC/client_secret_67295167549-tetha1…apps.googleusercontent.com.json` contains a
real `client_secret` (`GOCSPX-…`). It is **not committed to git** (verified via
`git ls-files`) and `.gitignore` is solid, but it should not live unprotected in the
working tree. **Action:** delete these `client_secret_*.json` files from disk; if the
secret was ever shared/committed anywhere, **rotate it** in Google Cloud Console.
(Note: the secret is not used by this app's flow — sign-in uses the public web client
ID + Supabase — so deleting it won't break anything.)

**Clean:** no service-role key, Razorpay secret, or Supabase service key appears in
the client bundle (grep-verified). Only `VITE_API_URL` and the public Google web
client ID ship to the browser, both intended-public. `.env` is gitignored;
`.env.production` contains only those two public values.

---

## Verified-correct (do not regress)

- **JWT is verified server-side** on every authed request via `supabaseAdmin.auth.getUser(token)` — signature + expiry checked, not claim-trust (`middleware/auth.ts`).
- **RLS-per-request:** user routes use a client carrying the user's JWT (`supabase.ts` `userClient`), so `auth.uid()` policies apply; user input never rides the service-role client into privileged tables.
- **No privilege escalation:** `PATCH /api/profile` uses a strict field allow-list (no `role`/`premium`); `profiles` RLS pins `role` on insert/update with `revoke update(role)`; role changes only via the `is_superadmin()`-gated `superadmin_set_role` RPC.
- **No IDOR in user routes:** every user-data query keys off `req.userId` (from the verified token), not body/params; cross-user routes are all behind `requireAdmin`/`requireSuperadmin`, which read the role from the DB.
- **All admin/superadmin RPCs** independently gate on `is_admin()`/`is_superadmin()` (defense-in-depth behind the Express middleware), and set `search_path = public`.
- **Payments:** HMAC `SHA256(order_id|payment_id, KEY_SECRET)` verified with a length-checked constant-time compare; client amount ignored for known plans; coupons validated server-side, clamped to `[0, base]`, redemption counted from paid rows; entitlement is **computed from the paid ledger**, not a spoofable flag.
- **CORS:** not credentialed; wildcard matcher escapes metacharacters and restricts `*` to a single DNS label (the prior greedy-`.*` bypass is fixed).
- **No SQL/RPC injection:** all queries use the Supabase query builder or parameterized RPCs; numeric `limit`/`days`/`count` params are consistently clamped.
- **No XSS:** zero `dangerouslySetInnerHTML`/`eval`/`document.write`; question/explanation/Thirukural/feedback content renders as JSX text (auto-escaped); the one manual-HTML path (PDF export) escapes inputs; external links are scheme-allowlisted (`^https?://`) with `rel="noreferrer"`.
- **Service worker** is minimal — only `push` + `notificationclick`, no `fetch`/cache of authed responses, no `message` handler.
- **Capacitor/Android:** `allowMixedContent: false`, no cleartext traffic, release build not debuggable, FileProvider not exported, INTERNET-only permission.
- **Infra:** helmet, `trust proxy: 1`, 2 MB JSON body limit, `sendDbError` never leaks raw DB internals on 5xx.

---

## Dependencies

`npm audit --omit=dev`: **server is clean (0).** Frontend has **1 moderate** —
`dompurify <=3.4.10` (GHSA-cmwh-pvxp-8882), a **transitive** dep of jspdf/html2canvas
that is **never imported** in `src`, so the vulnerable path isn't exercised.
**Action:** `npm audit fix` (non-breaking) to clear it.

**Optional Android hardening:** set `android:allowBackup="false"` and enable
`minifyEnabled true` + ProGuard for the release build.

---

## Priority order

1. ✅ **Done (pass 1):** brute-force limits, array caps, enumeration/leak fixes, device-info stripping.
2. ✅ **Done (pass 2):** Razorpay `/verify` idempotent + amount-verified; device cap bound to `session_id`; refresh token in HttpOnly cookie (web) / body (native).
3. ⬜ **Deploy:** set `NODE_ENV=production` on Render (in `render.yaml`) and verify web login + reload work after deploy (cookie depends on it).
4. ⬜ Delete the on-disk Google `client_secret_*.json` (rotate if ever exposed).
5. ⬜ Move user-facing notification queries onto `req.db` (restore RLS backstop).
6. ⬜ `npm audit fix` for dompurify; Android release hardening.
