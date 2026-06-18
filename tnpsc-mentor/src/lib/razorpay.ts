// ─── Razorpay Checkout ──────────────────────────────────────────────────────
// Drives the browser side of a payment: create an order on our server, open the
// Razorpay Checkout modal with the PUBLIC key id, then hand the callback back to
// our server to verify the signature. The secret never touches the browser, and
// "paid" is only ever set server-side after that verification.

import { api } from './api'
import type { Profile } from '../types'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

// Minimal shape of the Razorpay Checkout global we actually use.
interface RazorpayCheckout {
  open: () => void
  on: (event: string, handler: (resp: unknown) => void) => void
}
interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name?: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  handler: (resp: RazorpaySuccess) => void
  modal?: { ondismiss?: () => void }
}
interface RazorpaySuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout
  }
}

let scriptPromise: Promise<boolean> | null = null

/** Lazily inject checkout.js once; resolves true when the SDK is ready. */
function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement('script')
    s.src = CHECKOUT_SRC
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => {
      scriptPromise = null // allow a later retry
      resolve(false)
    }
    document.body.appendChild(s)
  })
  return scriptPromise
}

export type CheckoutResult =
  | { status: 'paid' }
  | { status: 'dismissed' }
  | { status: 'failed'; error: string }

export interface CheckoutParams {
  /** Amount in paise (₹1 = 100). For known plans the server overrides this. */
  amount: number
  /** Profile used to prefill name/email/contact in the Checkout form. */
  profile?: Profile | null
  description?: string
  notes?: Record<string, string>
  /** Optional promoter coupon; validated + applied server-side. */
  couponCode?: string
}

/**
 * Run the full checkout flow and resolve with the outcome. Never throws — every
 * failure path resolves to a `failed`/`dismissed` result so callers can toast.
 */
export async function startCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  // Create the order first: a fully-discounted (100%) coupon needs no Checkout,
  // so we must not fail on an unavailable SDK in that case.
  let res
  try {
    res = await api.payments.createOrder(params.amount, params.notes, params.couponCode)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Could not start payment.' }
  }

  // Coupon covered the whole price → the server already recorded it as paid.
  if (res.free) return { status: 'paid' }
  const { order, keyId } = res

  const ready = await loadCheckoutScript()
  if (!ready || !window.Razorpay) {
    return { status: 'failed', error: 'Could not load the payment SDK. Check your connection.' }
  }

  return new Promise<CheckoutResult>((resolve) => {
    const rzp = new window.Razorpay!({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'TNPSC Mentor',
      description: params.description ?? 'Payment',
      prefill: {
        name: params.profile?.full_name ?? undefined,
        email: params.profile?.email ?? undefined,
        contact: params.profile?.phone ?? undefined,
      },
      notes: params.notes,
      // Brand violet, matching the app accent.
      theme: { color: '#7C5CFF' },
      handler: async (resp) => {
        try {
          const { verified } = await api.payments.verify(resp)
          resolve(verified ? { status: 'paid' } : { status: 'failed', error: 'Verification failed.' })
        } catch (e) {
          resolve({ status: 'failed', error: e instanceof Error ? e.message : 'Verification failed.' })
        }
      },
      modal: { ondismiss: () => resolve({ status: 'dismissed' }) },
    })
    rzp.on('payment.failed', (resp: unknown) => {
      const err = (resp as { error?: { description?: string } })?.error?.description
      resolve({ status: 'failed', error: err ?? 'Payment failed.' })
    })
    rzp.open()
  })
}
