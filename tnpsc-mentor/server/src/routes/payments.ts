import { Router } from 'express'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { config, razorpayEnabled } from '../config.js'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

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
    // Amount arrives in paise (₹1 = 100). Clamp to ₹1 … ₹1,00,000 to stop a
    // malformed/hostile value reaching Razorpay. When the model firms up, derive
    // this from a server-side plan/SKU table instead of the request body.
    const raw = Math.trunc(Number(req.body?.amount))
    const amount = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 100), 10_000_000)
    const currency = typeof req.body?.currency === 'string' ? req.body.currency : 'INR'
    const notes: Record<string, string> = {
      user_id: req.userId!,
      ...(req.body?.notes && typeof req.body.notes === 'object' ? req.body.notes : {}),
    }
    // Receipt must be ≤ 40 chars for Razorpay; a short user-scoped token is plenty.
    const receipt = `rcpt_${req.userId!.slice(0, 8)}_${Date.now().toString(36)}`

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
