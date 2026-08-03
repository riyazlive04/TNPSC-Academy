// ─── Google Play purchase verification ──────────────────────────────────────
// Unlike Apple's, a Play purchase token carries no signature we can check
// offline — it is an opaque handle. The only way to know a purchase is real is to
// ask Google about it, so this calls the Play Developer API
// (androidpublisher.purchases.products.get) with a service-account JWT.
//
// Consequence worth knowing: if the service account is misconfigured this route
// fails CLOSED (503 / "could not verify"), never open. A user who paid still has
// the unconsumed purchase on-device, and finishPendingPurchases() re-submits it
// once the server is healthy again — Play also auto-refunds anything left
// unacknowledged for 3 days, so no one can be charged for nothing.

import { JWT } from 'google-auth-library'
import { config } from '../config.js'

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

export class GoogleVerifyError extends Error {}

export interface GooglePurchase {
  orderId?: string
  productId: string
  purchaseTimeMs: number
  /** 0 = purchased, 1 = cancelled, 2 = pending. */
  purchaseState: number
  /** 0 = yet to be consumed, 1 = consumed. */
  consumptionState: number
  acknowledgementState: number
  /** Our account id, if the app stamped one (obfuscatedAccountId). */
  obfuscatedAccountId?: string
  priceMinorUnits?: number
  currency?: string
}

/** Accepts the JSON key verbatim or base64-wrapped (easier to put in an env var). */
function serviceAccount(): { client_email: string; private_key: string } {
  const raw = config.googlePlayServiceAccountJson.trim()
  if (!raw) throw new GoogleVerifyError('Play service account is not configured')
  let text = raw
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(raw, 'base64').toString('utf8')
    } catch {
      throw new GoogleVerifyError('Play service account key is not valid JSON or base64')
    }
  }
  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GoogleVerifyError('Play service account key is not valid JSON')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new GoogleVerifyError('Play service account key is missing client_email/private_key')
  }
  // Env vars flatten newlines; the PEM needs them back or signing fails.
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  }
}

let client: JWT | null = null

function jwtClient(): JWT {
  if (client) return client
  const sa = serviceAccount()
  client = new JWT({ email: sa.client_email, key: sa.private_key, scopes: [SCOPE] })
  return client
}

/**
 * Look up a one-time product purchase. Throws GoogleVerifyError when Play does
 * not recognise the token, or recognises it as cancelled/pending.
 */
export async function verifyGooglePurchase(
  productId: string,
  purchaseToken: string
): Promise<GooglePurchase> {
  if (!purchaseToken) throw new GoogleVerifyError('Missing Play purchase token')

  const pkg = encodeURIComponent(config.googlePlayPackageName)
  const sku = encodeURIComponent(productId)
  const token = encodeURIComponent(purchaseToken)
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${pkg}/purchases/products/${sku}/tokens/${token}`

  let data: Record<string, unknown>
  try {
    const res = await jwtClient().request<Record<string, unknown>>({ url })
    data = res.data
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    // 404/410 = Play has never seen this token for this product: a forged or
    // stale receipt, not a transient fault.
    if (status === 404 || status === 410) {
      throw new GoogleVerifyError('Play does not recognise that purchase')
    }
    throw new GoogleVerifyError(
      `Play verification failed${e instanceof Error ? `: ${e.message}` : ''}`
    )
  }

  const purchaseState = Number(data.purchaseState ?? 1)
  if (purchaseState === 1) throw new GoogleVerifyError('That purchase was cancelled')
  if (purchaseState === 2) throw new GoogleVerifyError('That purchase is still pending')

  const micros = Number(data.priceAmountMicros ?? 0)

  return {
    orderId: data.orderId ? String(data.orderId) : undefined,
    productId,
    purchaseTimeMs: Number(data.purchaseTimeMillis ?? Date.now()),
    purchaseState,
    consumptionState: Number(data.consumptionState ?? 0),
    acknowledgementState: Number(data.acknowledgementState ?? 0),
    obfuscatedAccountId: data.obfuscatedExternalAccountId
      ? String(data.obfuscatedExternalAccountId)
      : undefined,
    // Play reports micros (1 unit = 1_000_000); the ledger stores minor units.
    priceMinorUnits: micros ? Math.round(micros / 10_000) : undefined,
    currency: data.priceCurrencyCode ? String(data.priceCurrencyCode) : undefined,
  }
}
