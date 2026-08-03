// ─── In-app purchase verification (App Store / Google Play) ─────────────────
// The native apps bill through the platform stores, because they must: Apple
// guideline 3.1.1 and Google Play's Payments policy both require it for digital
// content. This route turns a store receipt into the same `paid` row on the
// `payments` ledger that Razorpay writes on the web, so bundleAccess() and every
// entitlement gate downstream stay completely unaware of which rail was used.
//
// Deliberately NOT part of routes/payments.ts: that router 503s wholesale when
// Razorpay keys are absent, and store billing must not depend on Razorpay.
//
// Trust boundary — nothing in the request body is believed except as a hint:
//   • the PLAN is re-derived from the product id inside the verified receipt,
//     never read from the body, so a client can't buy the ₹499 SKU and claim it
//     unlocked Premium;
//   • the ACCOUNT is checked against the store's own account token, so a receipt
//     harvested from another user can't be replayed onto this one;
//   • the AMOUNT recorded is the store's figure, not the client's.

import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config, appleIapEnabled, googleIapEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { planForProduct } from '../iapCatalog.js'
import { verifyAppleTransaction, AppleVerifyError } from '../lib/iapApple.js'
import { verifyGooglePurchase, GoogleVerifyError } from '../lib/iapGoogle.js'
import { notifyAdmins } from '../notify.js'

const router = Router()

// A receipt check is cheap for us but hits Google's API; this also blunts anyone
// grinding forged tokens looking for a validation oracle.
const iapLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many purchase checks. Please wait a moment.' },
})

/** Postgres unique-violation — our idempotency signal. */
const UNIQUE_VIOLATION = '23505'

// ─── POST /api/iap/verify ────────────────────────────────────────────────────
// Body: { platform: 'ios'|'android', productId, transactionId?, jws?, purchaseToken? }
// → { verified: true, plan, alreadyRecorded }
router.post(
  '/verify',
  requireAuth,
  iapLimiter,
  asyncH(async (req: AuthedRequest, res) => {
    const userId = req.userId!
    const platform = String(req.body?.platform ?? '')
    if (platform !== 'ios' && platform !== 'android') {
      return res.status(400).json({ error: 'Unknown platform' })
    }

    // Hint only — the authoritative product id comes back from the store below.
    const claimedProductId = String(req.body?.productId ?? '')

    let externalId: string
    let verifiedProductId: string
    let storeAccountId: string | undefined
    let amountMinorUnits: number | undefined
    let currency: string | undefined
    let storeOrderId: string | undefined
    let provider: 'apple' | 'google'
    let environment = 'Production'

    if (platform === 'ios') {
      if (!appleIapEnabled) {
        return res.status(503).json({ error: 'App Store purchases are not configured.' })
      }
      try {
        const tx = await verifyAppleTransaction(String(req.body?.jws ?? ''))
        provider = 'apple'
        externalId = `ios:${tx.transactionId}`
        verifiedProductId = tx.productId
        storeAccountId = tx.appAccountToken
        amountMinorUnits = tx.priceMinorUnits
        currency = tx.currency
        storeOrderId = tx.originalTransactionId
        environment = tx.environment
      } catch (e) {
        if (e instanceof AppleVerifyError) return res.status(400).json({ error: e.message })
        throw e
      }
    } else {
      if (!googleIapEnabled) {
        return res.status(503).json({ error: 'Play purchases are not configured.' })
      }
      const purchaseToken = String(req.body?.purchaseToken ?? '')
      // Play's lookup is keyed by product id, so here the claimed id IS the
      // lookup key — but a wrong one simply 404s rather than validating.
      if (!claimedProductId) return res.status(400).json({ error: 'Missing product id' })
      try {
        const p = await verifyGooglePurchase(claimedProductId, purchaseToken)
        provider = 'google'
        externalId = `android:${purchaseToken}`
        verifiedProductId = p.productId
        storeAccountId = p.obfuscatedAccountId
        amountMinorUnits = p.priceMinorUnits
        currency = p.currency
        storeOrderId = p.orderId
      } catch (e) {
        if (e instanceof GoogleVerifyError) return res.status(400).json({ error: e.message })
        throw e
      }
    }

    // ── The plan is whatever the STORE says was bought. ──
    const entry = planForProduct(verifiedProductId)
    if (!entry) {
      return res.status(400).json({ error: 'That product is not sold by this app.' })
    }

    // ── Bind the receipt to this account. ──
    // Both stores echo back the account token the app stamped at purchase time.
    // If one is present it MUST be this user, or a receipt lifted from another
    // account (or bought on a shared device) would credit the wrong person.
    if (storeAccountId && storeAccountId.toLowerCase() !== userId.toLowerCase()) {
      await notifyAdmins(
        'IAP account mismatch',
        `A ${provider} receipt for ${verifiedProductId} carrying account ${storeAccountId} was ` +
          `submitted by user ${userId}. Rejected — possible receipt replay.`
      )
      return res.status(403).json({ error: 'That purchase belongs to a different account.' })
    }

    // ── Record it. ──
    // The unique index on razorpay_order_id is the whole idempotency story: a
    // re-submitted receipt (recovery sweep on next launch, double tap, retry
    // after a dropped response) collides and is reported as already-recorded
    // instead of granting a second window of access.
    const notes: Record<string, string> = {
      plan: entry.plan,
      provider,
      product_id: verifiedProductId,
      platform,
      environment,
    }

    const { error } = await supabaseAdmin.from('payments').insert({
      user_id: userId,
      razorpay_order_id: externalId,
      razorpay_payment_id: storeOrderId ?? null,
      amount: amountMinorUnits ?? 0,
      currency: currency ?? 'INR',
      receipt: `store_${provider}_${Date.now().toString(36)}`,
      notes,
      status: 'paid',
      provider,
    })

    if (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        return res.json({ verified: true, plan: entry.plan, alreadyRecorded: true })
      }
      return sendDbError(res, error)
    }

    // Sandbox money isn't money — flag it so it can be excluded from revenue.
    if (environment !== 'Production') {
      // eslint-disable-next-line no-console
      console.info(`[iap] sandbox purchase recorded: ${entry.plan} for ${userId}`)
    }

    res.json({ verified: true, plan: entry.plan, alreadyRecorded: false })
  })
)

// ─── GET /api/iap/config ─────────────────────────────────────────────────────
// Lets the app tell "store billing is switched off server-side" apart from "this
// device can't transact", so the paywall can say something true.
router.get('/config', (_req, res) => {
  res.json({
    ios: appleIapEnabled,
    android: googleIapEnabled,
    bundleId: config.appleBundleId,
    packageName: config.googlePlayPackageName,
  })
})

export default router
