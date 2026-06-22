import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startCheckout } from '../lib/razorpay'
import { api } from '../lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startCheckout — free (100% coupon) branch', () => {
  it('short-circuits to status "paid" when the order is free (no SDK needed)', async () => {
    const orderSpy = vi
      .spyOn(api.payments, 'createOrder')
      .mockResolvedValue({ free: true })

    const res = await startCheckout({ amount: 49900, couponCode: 'FULLOFF' })

    expect(res).toEqual({ status: 'paid' })
    expect(orderSpy).toHaveBeenCalledWith(49900, undefined, 'FULLOFF')
  })

  it('surfaces a failed result when order creation throws', async () => {
    vi.spyOn(api.payments, 'createOrder').mockRejectedValue(new Error('boom'))
    const res = await startCheckout({ amount: 49900 })
    expect(res.status).toBe('failed')
  })
})
