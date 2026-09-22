import express, { Router } from 'express'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { config, isAllowedOrigin, razorpayEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { baseAmountForPlan, KNOWN_PLANS } from '../pricing.js'
import { premiumEntitlement, bundleAccess } from '../lib/premium.js'
import { isPlanOnSale } from '../lib/settings.js'
import { evaluateCoupon, couponLimiter } from './coupons.js'
import { notifyAdmins } from '../notify.js'
import { settlePayment, type OrderRow, type SettleDeps } from '../lib/paymentSettle.js'
import {
  safeReturnOrigin,
  safeReturnPath,
  successUrl,
  failureUrl,
  type ReturnReason,
} from '../lib/paymentRedirect.js'

const router = Router()

// One shared Razorpay client (created only when keys are configured). All order
// creation and signature verification use the SECRET, which never leaves here.
const rzp = razorpayEnabled
  ? new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret })
  : null

/** Short-circuit every payment route with a clear 503 when keys aren't set. */
router.use((_req, res, next) => {
  if (!rzp) {
    return res
      .status(503)
      .json({ error: 'Payments are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.' })
  }
  next()
})

// ─── POST /api/payments/order ────────────────────────────────────────────────
// Create a Razorpay order and record a `created` payment row. Returns the order
// plus the PUBLIC key id the browser needs to open Checkout. The amount is the
// server's responsibility (never trust a client-sent price for real pricing —
// for now it's a flexible contribution, clamped to a sane range).
router.post(
  '/order',
  requireAuth,
  couponLimiter,
  asyncH(async (req: AuthedRequest, res) => {
    // Currency is FIXED server-side. Prices are computed in paise (INR); honouring
    // a client-sent currency would reprice the same integer in that currency's
    // subunit (e.g. 169900 IDR ≪ ₹1,699) and verify only asserts the amount.
    const currency = 'INR'
    // Server-owned keys go LAST so a client-sent notes.user_id can't shadow them.
    const notes: Record<string, string> = {
      ...(req.body?.notes && typeof req.body.notes === 'object' ? req.body.notes : {}),
      user_id: req.userId!,
    }

    // Resolve the plan SERVER-SIDE: only a plan pricing.ts recognizes is honoured
    // — anything else is the generic contribution path (plan stripped). We then
    // overwrite notes.plan with this validated value so entitlement (GET /premium,
    // /entitlements) can never be driven by an arbitrary client-supplied plan.
    const requestedPlan = req.body?.notes?.plan
    const plan: string | null =
      typeof requestedPlan === 'string' && KNOWN_PLANS.has(requestedPlan) ? requestedPlan : null
    if (plan) notes.plan = plan
    else delete notes.plan

    // A plan the superadmin has withdrawn from sale (Payments tab) must not be
    // purchasable, not merely invisible: the card is gone from the UI, but a
    // replayed/crafted request would otherwise still open a real Razorpay order
    // and mint an entitlement. Checked before the order is created so nothing
    // is charged. The master `payments_enabled` switch closes the generic
    // contribution path too (plan === null).
    if (!(await isPlanOnSale(plan))) {
      return res.status(403).json({ error: 'This plan is not available for purchase right now.' })
    }

    // Base price is the SERVER's responsibility: for a known plan we use the
    // server price and ignore the client amount; otherwise the clamped client
    // amount (the flexible-contribution path). This is the price a coupon
    // discounts — the browser can never send a pre-discounted number.
    const base = baseAmountForPlan(plan ?? undefined, Number(req.body?.amount))

    // Optional coupon. Validated + applied server-side so the discount can't be
    // forged; an invalid/expired/exhausted code fails the order with a clear msg.
    let couponId: string | null = null
    let couponCode: string | null = null
    let couponPromoter: string | null = null
    let discount = 0
    let amount = base
    const rawCoupon = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim() : ''
    if (rawCoupon) {
      const ev = await evaluateCoupon(rawCoupon, base)
      if (!ev.ok) return res.status(400).json({ error: ev.reason })
      couponId = ev.coupon.id
      couponCode = ev.coupon.code
      couponPromoter = ev.coupon.promoter_name
      discount = ev.discount
      amount = ev.finalAmount
      notes.coupon = ev.coupon.code // surfaced in the Razorpay dashboard too
    }

    // Receipt must be ≤ 40 chars for Razorpay; a short user-scoped token is plenty.
    const receipt = `rcpt_${req.userId!.slice(0, 8)}_${Date.now().toString(36)}`

    // Fully covered by the coupon → nothing to pay. Razorpay rejects a zero-amount
    // order, so we skip Checkout entirely: write a server-trusted `paid` row (₹0)
    // — synthetic order id (no Razorpay order exists) and no signature to verify —
    // so entitlement and coupon-redemption counting work exactly as a real
    // purchase. The client gets `{ free: true }` and unlocks without Checkout.
    if (amount === 0) {
      const freeOrderId = `free_${req.userId!.slice(0, 8)}_${Date.now().toString(36)}_${crypto
        .randomBytes(4)
        .toString('hex')}`
      const { error } = await supabaseAdmin.from('payments').insert({
        user_id: req.userId,
        razorpay_order_id: freeOrderId,
        amount: 0,
        currency,
        receipt,
        notes,
        status: 'paid',
        coupon_id: couponId,
        coupon_code: couponCode,
        original_amount: base,
        discount_amount: discount,
      })
      if (error) return sendDbError(res, error)

      // Passively alert admins: a 100%-discount coupon just unlocked a paid plan
      // for free. Best-effort (notifyAdmins never throws) so it can't fail the
      // unlock. Includes who, which coupon, the promoter, and the value waived.
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', req.userId)
        .single()
      const who = (prof?.full_name as string) || (prof?.email as string) || 'A user'
      const planLabel =
        notes.plan === 'premium_annual'
          ? 'Premium'
          : notes.plan === 'vettri_nichayam'
            ? 'Group 1 Test Series (full)'
            : notes.plan === 'vettri_month'
              ? 'Group 1 Test Series (monthly)'
              : notes.plan === 'rank_booster_g2'
                ? 'Group II/ IIA- Rank Booster'
                : notes.plan === 'group1_mock_pack'
                  ? 'Group 1 Mock Test Pack'
                  : 'a paid plan'
      const waived = `₹${Math.round(base / 100)}`
      await notifyAdmins(
        'Free unlock via coupon',
        `${who} activated ${planLabel} free using coupon ${couponCode}` +
          `${couponPromoter ? ` (${couponPromoter})` : ''} — ${waived} waived (100% off).`
      )

      return res.json({ free: true })
    }

    const order = await rzp!.orders.create({ amount, currency, receipt, notes })

    // Record the intent (service-role write — bypasses RLS, server-trusted).
    const { error } = await supabaseAdmin.from('payments').insert({
      user_id: req.userId,
      razorpay_order_id: order.id,
      amount,
      currency,
      receipt,
      notes,
      status: 'created',
      coupon_id: couponId,
      coupon_code: couponCode,
      original_amount: base,
      discount_amount: discount,
    })
    if (error) return sendDbError(res, error)

    res.json({ order, keyId: config.razorpayKeyId })
  })
)

// ─── Ledger + Razorpay access for settlePayment() ────────────────────────────
// The three verification gates live in lib/paymentSettle.ts, shared by /verify
// (popup flow) and /callback (redirect flow); these are the calls they make.
// `fetchAttempts` > 1 retries a Razorpay outage before giving up — worth it
// only on the callback, whose buyer cannot retry (they are mid-navigation).
function settleDeps(fetchAttempts = 1): SettleDeps {
  return {
    secret: config.razorpayKeySecret,
    findOrder: async (orderId) => {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, user_id, status, amount, notes')
        .eq('razorpay_order_id', orderId)
        .single()
      return { row: (data as OrderRow | null) ?? null, error }
    },
    fetchPayment: async (paymentId) => {
      for (let attempt = 1; ; attempt++) {
        try {
          const pay = await rzp!.payments.fetch(paymentId)
          return { order_id: String(pay.order_id), amount: pay.amount, status: String(pay.status) }
        } catch (e) {
          if (attempt >= fetchAttempts) throw e
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    },
    // Guarded on `created`: a bad/late call can never overwrite a resolved row,
    // and concurrent valid calls transition it to `paid` at most once.
    resolve: async (rowId, status, paymentId, signature) => {
      const { error } = await supabaseAdmin
        .from('payments')
        .update({ status, razorpay_payment_id: paymentId, razorpay_signature: signature })
        .eq('id', rowId)
        .eq('status', 'created')
      return { error }
    },
  }
}

// ─── POST /api/payments/verify ───────────────────────────────────────────────
// Popup flow: Checkout's in-page handler posts the triple here and the card
// unlocks on `verified: true`. See settlePayment() for the three gates.
router.post(
  '/verify',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const outcome = await settlePayment(
      {
        orderId: String(req.body?.razorpay_order_id ?? ''),
        paymentId: String(req.body?.razorpay_payment_id ?? ''),
        signature: String(req.body?.razorpay_signature ?? ''),
        ownerId: req.userId!,
      },
      settleDeps()
    )
    switch (outcome.kind) {
      case 'paid':
        return res.json({ verified: true })
      case 'missing-fields':
        return res.status(400).json({ error: 'Missing payment verification fields.' })
      case 'not-found':
        return res.status(404).json({ error: 'Order not found.' })
      case 'db-error':
        return sendDbError(res, outcome.error)
      case 'bad-signature':
        return res.status(400).json({ error: 'Signature verification failed.', verified: false })
      case 'mismatch':
        return res.status(400).json({ error: 'Payment could not be verified.', verified: false })
      case 'unconfirmed':
        // Never credited on signature alone: the row stays pending and the
        // client may re-verify once Razorpay is reachable again.
        return res.status(503).json({
          error: 'Could not confirm the payment right now. Please retry in a moment.',
          verified: false,
          retryable: true,
        })
    }
  })
)

// ─── POST /api/payments/callback ─────────────────────────────────────────────
// Redirect flow. Razorpay's checkout.js cannot rely on a popup on iPhones,
// Chrome for iOS, Android WebViews and the Instagram/Facebook in-app browsers,
// and in exactly those it switches to a full-page redirect — but only when it
// was given a callback_url (lib/razorpay.ts passes one). After paying, the
// buyer's browser arrives here with a form POST from Razorpay's page carrying
// the same triple /verify gets, or `error[...]` fields instead.
//
// No requireAuth: this is a cross-site navigation, so no bearer token and no
// SameSite cookie comes with it. The signature is the proof (only Razorpay and
// this server hold the secret) and the ledger row names the buyer, so nothing
// here needs to know who is asking. Mounted in index.ts AHEAD of the
// maintenance gate: a payment that already left the buyer's bank must be
// credited even if the app closed in the meantime.
//
// Every outcome is a 303 back to the origin the buyer paid from — see
// lib/paymentRedirect.ts for why those query params are allowlisted.
export const paymentCallbackRouter = Router()
paymentCallbackRouter.post(
  '/',
  express.urlencoded({ extended: true, limit: '20kb' }),
  asyncH(async (req, res) => {
    const fallbackOrigin = config.corsOrigins.find((o) => o.startsWith('https://')) ?? config.corsOrigins[0]
    const origin = safeReturnOrigin(req.query.origin, isAllowedOrigin, fallbackOrigin)
    const back = safeReturnPath(req.query.back)
    const fail = (reason: ReturnReason) => res.redirect(303, failureUrl(origin, back, reason))

    if (!rzp) return fail('pending')

    const body = (req.body ?? {}) as Record<string, unknown>
    if (body.error) {
      // Razorpay posts a failure here only once its own retry screen is done
      // with it. Nothing to mark: the row stays `created`, as it does when the
      // popup flow reports payment.failed.
      console.warn('[callback] Razorpay reported a failed payment', body.error)
      return fail('failed')
    }

    const paymentId = String(body.razorpay_payment_id ?? '')
    const outcome = await settlePayment(
      {
        orderId: String(body.razorpay_order_id ?? ''),
        paymentId,
        signature: String(body.razorpay_signature ?? ''),
      },
      settleDeps(3)
    )
    if (outcome.kind === 'paid') {
      return res.redirect(303, successUrl(origin, outcome.row.notes?.plan, paymentId, Number(outcome.row.amount)))
    }
    // 'pending' = the money may well have moved but we could not confirm it
    // yet (Razorpay unreachable, ledger write failed): the buyer is told to
    // hold on / contact support rather than to pay again. An unknown order
    // (PGRST116 from .single()) is not that — it is simply not ours.
    const unsure =
      outcome.kind === 'unconfirmed' || (outcome.kind === 'db-error' && outcome.error.code !== 'PGRST116')
    if (outcome.kind === 'db-error' && unsure) console.error('[callback] ledger error', outcome.error)
    return fail(unsure ? 'pending' : 'unverified')
  })
)

// ─── GET /api/payments/premium ───────────────────────────────────────────────
// Derive the user's premium entitlement from the ledger: a paid `premium_annual`
// payment within the plan window. Premium is a 6-MONTH plan, so the window is
// 180 days — a payment older than that has lapsed. Entitlement is computed, never
// stored as a flag, so it stays correct without a separate sync step. Returns
// the expiry too. (The `premium_annual` plan id is retained for ledger continuity
// even though the validity is now 6 months.) PREMIUM_VALIDITY_MS is shared from
// pricing.ts so this window can never drift from the premium-audience logic.
router.get(
  '/premium',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    try {
      res.json(await premiumEntitlement(req.db!))
    } catch (e) {
      return sendDbError(res, e as Parameters<typeof sendDbError>[1])
    }
  })
)

// ─── GET /api/payments/entitlements ──────────────────────────────────────────
// The full bundle picture in one call: { premium, premiumUntil, vettri,
// vettriUntil, unlimited }. `unlimited` (premium || vettri) is what the Vettri
// bank and the PYQ/CA per-topic gate check. Premium is a superset of vettri, so a
// premium buyer reads back vettri-equivalent access via `unlimited`. Used by the
// client entitlements store to drive the Vettri upsell card + lock UI.
router.get(
  '/entitlements',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    try {
      res.json(await bundleAccess(req.db!))
    } catch (e) {
      return sendDbError(res, e as Parameters<typeof sendDbError>[1])
    }
  })
)

// ─── GET /api/payments ───────────────────────────────────────────────────────
// The authenticated user's own payment history (RLS-scoped via req.db).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    // Defensive cap — the most recent 200 rows is already far more than any
    // history view needs.
    const { data, error } = await req.db!
      .from('payments')
      .select('id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return sendDbError(res, error)
    res.json({ payments: data ?? [] })
  })
)

export default router
