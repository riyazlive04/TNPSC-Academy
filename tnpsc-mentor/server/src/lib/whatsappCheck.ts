// ─── "Is this number on WhatsApp?" check (Evolution GO) ──────────────────────
// A REACHABILITY gate, not an ownership proof. It answers one question — does a
// WhatsApp account exist for this mobile number — so signup can refuse numbers
// we could never message, which is the whole point of collecting the number.
//
// Read that limit plainly: passing this check proves nothing about who is
// typing. Anyone can enter any number that happens to be on WhatsApp. What it
// buys is a clean contact list (no typos, no landlines, no WhatsApp-less
// numbers silently swallowing every notification we ever send) — NOT the
// ownership proof the OTP flow in whatsappOtp.ts provides. Both issue the same
// `pv` ticket, so if ownership proof is ever wanted back, arm the Wasi OTP vars
// instead and that path takes precedence again (see routes/auth.ts).
//
// Why a gateway and not the official API: Meta's Business API has no
// exists-on-WhatsApp lookup at all, which is why this check was impossible
// under AiSensy/Wasi. Evolution is an unofficial WhatsApp Web (Baileys)
// gateway — a QR-paired number acting as a normal client. It can do the lookup,
// at the cost that the paired number can in principle be banned by WhatsApp for
// automated behaviour. Lookups are far quieter than bulk sends, and the result
// cache below keeps the volume down, but that risk is real and the reason the
// project moved OFF Evolution for message DELIVERY in July 2026.
//
// This talks to **Evolution GO** (github.com/EvolutionAPI/evolution-go), which
// is a different product from the Evolution API v2 the project used in 2026-07
// — different routes and a different response shape, so v2's docs do not apply:
//   POST <base>/user/check    header `apikey: <INSTANCE token>`
//   body  { "number": ["919876543210"] }
//   200   { data: { Users: [ { IsInWhatsapp: true, JID, LID, … } ] }, message }
// The instance is NOT named in the URL — it is implied by WHICH token is sent.
// That token is per-instance; the host's global/admin apikey is rejected here
// (401), which is just as well: the global key can read and control every
// instance on the host, including other clients'. Never put it in this server's
// env — EVOLUTION_API_KEY is the single instance's own token.

import { config } from '../config.js'

/** 'yes'/'no' are answers from the gateway; 'unknown' means we could not ask
 * (misconfigured, offline, timed out, unparseable) and the caller must decide
 * what to do with an absent answer. */
export type WhatsappCheck = 'yes' | 'no' | 'unknown'

// India-only app — every entry point validates a 6-9 leading 10-digit mobile.
const COUNTRY_CODE = '91'

// The gateway talks to WhatsApp's servers for an uncached number, so give it
// room; but a signup form is waiting on this, so not unlimited.
const TIMEOUT_MS = 10_000

// Remember answers for a while. A user who fixes a duplicate-email error and
// resubmits, or double-taps the button, must not cost a second gateway round
// trip: repeated lookups are exactly the traffic pattern that gets a Baileys
// number flagged. A number's WhatsApp presence effectively never changes within
// an hour, so this is free accuracy-wise.
const CACHE_TTL_MS = 60 * 60_000
const CACHE_MAX = 5_000
const cache = new Map<string, { answer: 'yes' | 'no'; at: number }>()

function cacheGet(ten: string): 'yes' | 'no' | null {
  const hit = cache.get(ten)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(ten)
    return null
  }
  return hit.answer
}

function cacheSet(ten: string, answer: 'yes' | 'no'): void {
  // Cheap bound: on overflow drop the oldest insertions (Map keeps insertion
  // order) rather than growing without limit in a long-lived process.
  if (cache.size >= CACHE_MAX) {
    for (const k of cache.keys()) {
      cache.delete(k)
      if (cache.size < CACHE_MAX * 0.9) break
    }
  }
  cache.set(ten, { answer, at: Date.now() })
}

/** Which pairing a log line is about. Purely a label — the request itself is
 * routed by the token, so a wrong/blank name costs nothing but clarity. */
function instanceLabel(): string {
  return config.evolutionInstance || 'unnamed-instance'
}

/**
 * Pull the verdict out of Evolution GO's response. Returns null for anything
 * that is not an unambiguous boolean, so a shape change after a gateway upgrade
 * reads as "no answer" instead of being guessed at.
 */
function readVerdict(body: unknown): boolean | null {
  if (!body || typeof body !== 'object') return null
  const data = (body as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  // Capitalised keys: these come straight from the Go struct's JSON tags.
  const users = (data as { Users?: unknown }).Users
  if (!Array.isArray(users) || users.length === 0) return null
  const first = users[0]
  if (!first || typeof first !== 'object') return null
  const inWa = (first as { IsInWhatsapp?: unknown }).IsInWhatsapp
  return typeof inWa === 'boolean' ? inWa : null
}

/**
 * Ask the gateway whether a 10-digit Indian mobile has a WhatsApp account.
 * Never throws — every failure mode collapses to 'unknown' so a caller can
 * choose its own fallback instead of handling a stack trace mid-signup.
 */
export async function isOnWhatsApp(tenDigit: string): Promise<WhatsappCheck> {
  if (!config.evolutionApiKey) return 'unknown'

  const cached = cacheGet(tenDigit)
  if (cached) return cached

  const url = `${config.evolutionBaseUrl.replace(/\/+$/, '')}/user/check`
  let status = 0
  let body: unknown
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.evolutionApiKey },
      body: JSON.stringify({ number: [`${COUNTRY_CODE}${tenDigit}`] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    status = res.status
    body = await res.json().catch(() => null)
  } catch (e) {
    console.error(
      '[wa-check] gateway unreachable',
      instanceLabel(),
      tenDigit,
      e instanceof Error ? e.message : e
    )
    return 'unknown'
  }

  if (status < 200 || status >= 300) {
    // 401 = wrong token (or the host's global key, which this route rejects);
    // 404 = wrong base URL; 400/500 = instance not connected (logged out, or
    // the QR needs re-scanning). All operator problems, all loud.
    console.error(
      '[wa-check] gateway error',
      instanceLabel(),
      tenDigit,
      status,
      JSON.stringify(body).slice(0, 300)
    )
    return 'unknown'
  }

  const exists = readVerdict(body)
  if (exists === null) {
    console.error(
      '[wa-check] unexpected response',
      instanceLabel(),
      tenDigit,
      JSON.stringify(body).slice(0, 300)
    )
    return 'unknown'
  }

  const answer = exists ? 'yes' : 'no'
  cacheSet(tenDigit, answer)
  return answer
}
