import crypto from 'node:crypto'

// ─── Settling a Razorpay payment against our ledger ─────────────────────────
// One decision, reached two ways:
//
//   POST /api/payments/verify    the popup flow — Checkout's in-page handler
//                                hands us the triple over an authed fetch.
//   POST /api/payments/callback  the redirect flow — Razorpay's own page POSTs
//                                the triple to our callback_url after the buyer
//                                left our page (iPhones, in-app browsers).
//
// Both must credit under exactly the same three gates, so the gates live here
// and each route only translates the outcome into its own response (JSON for
// the fetch, a 303 for the navigation). The DB and Razorpay calls are passed in
// so the gates can be exercised without either.

export interface DbError {
  message?: string
  code?: string
}

/** The `payments` row an order id resolves to. */
export interface OrderRow {
  id: string
  user_id: string
  status: string
  amount: number
  notes: Record<string, unknown> | null
}

/** The fields of a fetched Razorpay payment that gate 3 checks. */
export interface FetchedPayment {
  order_id: string
  amount: number | string
  status: string
}

export interface SettleDeps {
  secret: string
  findOrder: (orderId: string) => Promise<{ row: OrderRow | null; error: DbError | null }>
  /** Throws when Razorpay cannot be reached — which is NOT a verdict. */
  fetchPayment: (paymentId: string) => Promise<FetchedPayment>
  /** Move a still-`created` row to a terminal status. Must be guarded on
   *  status='created' so a resolved row is never rewritten. */
  resolve: (
    rowId: string,
    status: 'paid' | 'failed',
    paymentId: string,
    signature: string
  ) => Promise<{ error: DbError | null }>
}

export interface SettleInput {
  orderId: string
  paymentId: string
  signature: string
  /** The signed-in caller, when there is one. The redirect flow has none — the
   *  signature is its proof, and the row itself names whose order it is. */
  ownerId?: string
}

export type SettleOutcome =
  | { kind: 'paid'; row: OrderRow }
  | { kind: 'missing-fields' }
  | { kind: 'not-found' }
  | { kind: 'db-error'; error: DbError }
  | { kind: 'bad-signature' }
  | { kind: 'mismatch' }
  /** Razorpay unreachable: the row is left pending, retrying may succeed. */
  | { kind: 'unconfirmed' }

/** HMAC_SHA256(order_id|payment_id, KEY_SECRET), compared in constant time. */
export function signatureValid(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
}

/**
 * Verify a Checkout result and mark the payment `paid`. Three independent
 * gates, each of which alone blocks a forged/replayed/tampered credit:
 *   1. Idempotency — a `paid` order is TERMINAL: re-posting any triple against
 *      it is a no-op success, so the credit can't be replayed and the row can
 *      never be flipped back to `failed` (state-downgrade attack).
 *   2. Signature — only a genuine Razorpay success matches, so a pay can't be
 *      forged.
 *   3. Server-side confirmation — the payment fetched from Razorpay must be
 *      captured/authorised, belong to THIS order and pay the EXACT recorded
 *      amount, so a valid signature for a mismatched/under-paid payment can't
 *      slip through.
 * The final UPDATE is guarded on `status='created'` so concurrent/duplicate
 * valid calls — including the popup and redirect flows racing — credit at most
 * once.
 */
export async function settlePayment(input: SettleInput, deps: SettleDeps): Promise<SettleOutcome> {
  const { orderId, paymentId, signature } = input
  if (!orderId || !paymentId || !signature) return { kind: 'missing-fields' }

  const { row, error } = await deps.findOrder(orderId)
  if (error) return { kind: 'db-error', error }
  // With an owner, the order must be theirs — stops one user verifying against
  // another user's order id.
  if (!row || (input.ownerId !== undefined && row.user_id !== input.ownerId)) {
    return { kind: 'not-found' }
  }

  // Gate 1 — idempotent & replay/downgrade-safe: a paid order never changes.
  if (row.status === 'paid') return { kind: 'paid', row }

  // Gate 2 — cryptographic signature (primary forgery control).
  if (!signatureValid(orderId, paymentId, signature, deps.secret)) {
    await deps.resolve(row.id, 'failed', paymentId, signature)
    return { kind: 'bad-signature' }
  }

  // Gate 3 — confirm the real payment with Razorpay. A definitive MISMATCH is
  // fatal (mark failed). A FETCH failure (Razorpay outage) is NON-final: we
  // must not credit on signature alone, so the row stays `created` and the
  // caller is told it may retry.
  let pay: FetchedPayment
  try {
    pay = await deps.fetchPayment(paymentId)
  } catch (e) {
    console.error('[settle] Razorpay fetch failed; cannot confirm payment', (e as Error).message)
    return { kind: 'unconfirmed' }
  }
  const settled = pay.status === 'captured' || pay.status === 'authorized'
  if (pay.order_id !== orderId || Number(pay.amount) !== Number(row.amount) || !settled) {
    console.error('[settle] payment/order mismatch', {
      orderId,
      paymentId,
      expectedAmount: row.amount,
      got: { order: pay.order_id, amount: pay.amount, status: pay.status },
    })
    await deps.resolve(row.id, 'failed', paymentId, signature)
    return { kind: 'mismatch' }
  }

  const { error: updErr } = await deps.resolve(row.id, 'paid', paymentId, signature)
  if (updErr) return { kind: 'db-error', error: updErr }
  return { kind: 'paid', row }
}
