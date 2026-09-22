import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { settlePayment, type OrderRow, type SettleDeps } from '../lib/paymentSettle.js'
import { safeReturnOrigin, safeReturnPath, successUrl, failureUrl } from '../lib/paymentRedirect.js'

/**
 * Razorpay's redirect flow (iPhones, in-app browsers) credits a payment from an
 * UNAUTHENTICATED form POST, so the only things standing between a forged
 * request and a free plan are the gates in settlePayment(), and the only thing
 * standing between the callback and an open redirect is paymentRedirect.ts.
 */

const SECRET = 'test_secret'
const sign = (orderId: string, paymentId: string) =>
  crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex')

function fakeLedger(row: Partial<OrderRow> | null, pay?: { order_id: string; amount: number; status: string } | 'down') {
  const full: OrderRow | null = row
    ? { id: 'row1', user_id: 'u1', status: 'created', amount: 39900, notes: { plan: 'group1_mock_pack' }, ...row }
    : null
  const writes: Array<{ status: string }> = []
  const deps: SettleDeps = {
    secret: SECRET,
    findOrder: async () => ({ row: full, error: full ? null : { code: 'PGRST116' } }),
    fetchPayment: async () => {
      if (pay === 'down' || !pay) throw new Error('ECONNRESET')
      return pay
    },
    resolve: async (_id, status) => {
      if (full && full.status === 'created') {
        writes.push({ status })
        full.status = status
      }
      return { error: null }
    },
  }
  return { deps, writes }
}

const genuine = { order_id: 'order_1', amount: 39900, status: 'captured' }
const triple = { orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1') }

describe('settlePayment', () => {
  it('credits a genuine, captured, exact-amount payment', async () => {
    const { deps, writes } = fakeLedger({}, genuine)
    const out = await settlePayment(triple, deps)
    expect(out.kind).toBe('paid')
    expect(writes).toEqual([{ status: 'paid' }])
  })

  it('refuses a forged signature and marks the order failed', async () => {
    const { deps, writes } = fakeLedger({}, genuine)
    const out = await settlePayment({ ...triple, signature: sign('order_1', 'pay_other') }, deps)
    expect(out.kind).toBe('bad-signature')
    expect(writes).toEqual([{ status: 'failed' }])
  })

  it('refuses a genuine signature for an under-paid or uncaptured payment', async () => {
    for (const pay of [
      { ...genuine, amount: 100 },
      { ...genuine, status: 'failed' },
      { ...genuine, order_id: 'order_2' },
    ]) {
      const { deps, writes } = fakeLedger({}, pay)
      expect((await settlePayment(triple, deps)).kind).toBe('mismatch')
      expect(writes).toEqual([{ status: 'failed' }])
    }
  })

  it('never credits on signature alone when Razorpay is unreachable', async () => {
    const { deps, writes } = fakeLedger({}, 'down')
    expect((await settlePayment(triple, deps)).kind).toBe('unconfirmed')
    expect(writes).toEqual([]) // left pending, so a retry can still credit it
  })

  it('treats an already-paid order as paid without rewriting it', async () => {
    const { deps, writes } = fakeLedger({ status: 'paid' }, genuine)
    // Even a garbage signature cannot downgrade a paid row.
    expect((await settlePayment({ ...triple, signature: 'x' }, deps)).kind).toBe('paid')
    expect(writes).toEqual([])
  })

  it('scopes to the caller when there is one (the /verify flow)', async () => {
    const { deps } = fakeLedger({ user_id: 'someone_else' }, genuine)
    expect((await settlePayment({ ...triple, ownerId: 'u1' }, deps)).kind).toBe('not-found')
    // …and the ownerless redirect flow relies on the signature instead.
    const { deps: deps2 } = fakeLedger({ user_id: 'someone_else' }, genuine)
    expect((await settlePayment(triple, deps2)).kind).toBe('paid')
  })

  it('rejects an incomplete triple before touching the ledger', async () => {
    const { deps } = fakeLedger({}, genuine)
    expect((await settlePayment({ ...triple, signature: '' }, deps)).kind).toBe('missing-fields')
  })

  it('reports an unknown order as a lookup error, not a credit', async () => {
    const { deps } = fakeLedger(null, genuine)
    const out = await settlePayment(triple, deps)
    expect(out.kind).toBe('db-error')
  })
})

describe('callback redirect targets', () => {
  const allowed = (o: string) =>
    ['https://app.tnpscmentors.in', 'https://tnpscmentors.in', 'http://localhost:5173'].includes(o)
  const FALLBACK = 'https://app.tnpscmentors.in'

  it('returns the buyer to the allowlisted origin they paid from', () => {
    expect(safeReturnOrigin('https://tnpscmentors.in', allowed, FALLBACK)).toBe('https://tnpscmentors.in')
    expect(safeReturnOrigin('http://localhost:5173', allowed, FALLBACK)).toBe('http://localhost:5173')
  })

  it('falls back to the app for anything that is not a bare allowlisted origin', () => {
    for (const raw of [
      'https://evil.example',
      'https://tnpscmentors.in/',
      'https://tnpscmentors.in/x',
      'https://user@tnpscmentors.in',
      'http://tnpscmentors.in',
      'javascript:alert(1)',
      '',
      undefined,
      ['https://tnpscmentors.in'],
    ]) {
      expect(safeReturnOrigin(raw, allowed, FALLBACK), String(raw)).toBe(FALLBACK)
    }
    // The shape checks hold even against an allowlist that would say yes.
    for (const raw of ['https://tnpscmentors.in/x', 'http://tnpscmentors.in', 'javascript:alert(1)']) {
      expect(safeReturnOrigin(raw, () => true, FALLBACK), raw).toBe(FALLBACK)
    }
  })

  it('only accepts a same-origin path to go back to', () => {
    expect(safeReturnPath('/mock-399')).toBe('/mock-399')
    expect(safeReturnPath('/group-1-mock-test?x=1')).toBe('/group-1-mock-test?x=1')
    for (const raw of ['//evil.example', '/\\evil.example', 'https://evil.example', 'mock-399', '/a\nb', undefined]) {
      expect(safeReturnPath(raw), String(raw)).toBe('/')
    }
  })

  it('builds the success URL the success page reads', () => {
    const url = new URL(successUrl('https://tnpscmentors.in', 'group1_mock_pack', 'pay_1', 39900))
    expect(url.origin).toBe('https://tnpscmentors.in')
    expect(url.pathname).toBe('/payment-success')
    expect(url.searchParams.get('plan')).toBe('group1_mock_pack')
    expect(url.searchParams.get('pid')).toBe('pay_1')
    expect(url.searchParams.get('amt')).toBe('399')
    expect(new URL(successUrl(FALLBACK, 'vettri_nichayam', 'p', 189900)).searchParams.get('plan')).toBe('vettri_full')
  })

  it('flags the failure on the page the buyer came from', () => {
    expect(failureUrl('https://app.tnpscmentors.in', '/mock-399', 'failed')).toBe(
      'https://app.tnpscmentors.in/mock-399?payment=failed'
    )
    expect(failureUrl('https://app.tnpscmentors.in', '/group-1?ref=wa', 'pending')).toBe(
      'https://app.tnpscmentors.in/group-1?ref=wa&payment=pending'
    )
  })
})
