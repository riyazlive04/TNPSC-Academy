import { Router } from 'express'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { config, razorpayEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { baseAmountForPlan } from '../pricing.js'
import { evaluateCoupon } from './coupons.js'
import { notifyAdmins } from '../notify.js'

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
  asyncH(async (req: AuthedRequest, res) => {
    const currency = typeof req.body?.currency === 'string' ? req.body.currency : 'INR'
    const notes: Record<string, string> = {
      user_id: req.userId!,
      ...(req.body?.notes && typeof req.body.notes === 'object' ? req.body.notes : {}),
    }

    // Base price is the SERVER's responsibility: for a known plan we use the
    // server price and ignore the client amount; otherwise the clamped client
    // amount (the flexible-contribution path). This is the price a coupon
    // discounts — the browser can never send a pre-discounted number.
    const base = baseAmountForPlan(notes.plan, Number(req.body?.amount))

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
      const planLabel = notes.plan === 'premium_annual' ? 'Premium' : 'a paid plan'
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

// ─── POST /api/payments/verify ───────────────────────────────────────────────
// Verify the Checkout callback signature and mark the payment `paid`. The
// signature is HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET) — only a
// genuine Razorpay success yields a match, so the client can't forge a `paid`.
router.post(
  '/verify',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const orderId = String(req.body?.razorpay_order_id ?? '')
    const paymentId = String(req.body?.razorpay_payment_id ?? '')
    const signature = String(req.body?.razorpay_signature ?? '')
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification fields.' })
    }

    // The order must belong to THIS user — stops one user verifying against
    // another user's order id.
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, status')
      .eq('razorpay_order_id', orderId)
      .single()
    if (lookupErr) return sendDbError(res, lookupErr)
    if (!row || row.user_id !== req.userId) {
      return res.status(404).json({ error: 'Order not found.' })
    }

    const expected = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    // Constant-time compare to avoid leaking the signature via timing.
    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))

    const { error: updErr } = await supabaseAdmin
      .from('payments')
      .update({
        status: ok ? 'paid' : 'failed',
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      })
      .eq('id', row.id)
    if (updErr) return sendDbError(res, updErr)

    if (!ok) return res.status(400).json({ error: 'Signature verification failed.', verified: false })
    res.json({ verified: true })
  })
)

// ─── GET /api/payments/premium ───────────────────────────────────────────────
// Derive the user's premium entitlement from the ledger: a paid `premium_annual`
// payment within the plan window. Premium is a 3-MONTH plan, so the window is
// 90 days — a payment older than that has lapsed. Entitlement is computed, never
// stored as a flag, so it stays correct without a separate sync step. Returns
// the expiry too. (The `premium_annual` plan id is retained for ledger continuity
// even though the validity is now 3 months.)
const PREMIUM_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000 // 3 months
router.get(
  '/premium',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const since = new Date(Date.now() - PREMIUM_VALIDITY_MS).toISOString()
    const { data, error } = await req.db!
      .from('payments')
      .select('created_at, notes')
      .eq('status', 'paid')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (error) return sendDbError(res, error)

    const latest = (data ?? []).find(
      (r) => (r.notes as { plan?: string } | null)?.plan === 'premium_annual'
    )
    if (!latest) return res.json({ premium: false, until: null })
    const until = new Date(new Date(latest.created_at).getTime() + PREMIUM_VALIDITY_MS).toISOString()
    res.json({ premium: true, until })
  })
)

// ─── GET /api/payments ───────────────────────────────────────────────────────
// The authenticated user's own payment history (RLS-scoped via req.db).
router.get(
  '/',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!
      .from('payments')
      .select('id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at')
      .order('created_at', { ascending: false })
    if (error) return sendDbError(res, error)
    res.json({ payments: data ?? [] })
  })
)

export default router
