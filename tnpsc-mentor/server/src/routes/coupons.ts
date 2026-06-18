import { Router } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, requireSuperadmin, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { baseAmountForPlan, MIN_CHARGE_PAISE } from '../pricing.js'

const router = Router()

// ─── Coupon record shape (DB row) ────────────────────────────────────────────
export interface CouponRow {
  id: string
  code: string
  promoter_name: string
  discount_type: 'flat' | 'percent'
  discount_value: number
  max_discount: number | null
  max_redemptions: number | null
  expires_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CouponEval =
  | { ok: true; coupon: CouponRow; discount: number; finalAmount: number }
  | { ok: false; reason: string }

/**
 * Validate a code against a trusted base amount (paise) and compute the discount.
 * Shared by POST /validate (preview) and the payments /order route (the real
 * thing) so the rules can never drift between preview and charge.
 */
export async function evaluateCoupon(rawCode: string, baseAmount: number): Promise<CouponEval> {
  const code = String(rawCode ?? '').trim()
  if (!code) return { ok: false, reason: 'Enter a coupon code.' }

  // Codes are stored UPPERCASE; match case-insensitively (no % / _ in our codes).
  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', code)
    .maybeSingle<CouponRow>()
  if (error) return { ok: false, reason: 'Could not check that coupon.' }
  if (!coupon) return { ok: false, reason: 'Invalid coupon code.' }
  if (!coupon.active) return { ok: false, reason: 'This coupon is no longer active.' }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'This coupon has expired.' }
  }

  // Redemption cap counts only SUCCESSFUL (paid) uses.
  if (coupon.max_redemptions != null) {
    const { count } = await supabaseAdmin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('status', 'paid')
    if ((count ?? 0) >= coupon.max_redemptions) {
      return { ok: false, reason: 'This coupon has reached its redemption limit.' }
    }
  }

  // Compute the discount. A coupon may cover the ENTIRE price (finalAmount 0 →
  // nothing to pay). Razorpay can't take an order between ₹0 and ₹1, so any
  // leftover below the minimum charge is rounded down to free rather than bumped
  // up to ₹1 — the /order route then skips Checkout for a zero-amount order.
  let discount =
    coupon.discount_type === 'flat'
      ? coupon.discount_value
      : Math.floor((baseAmount * coupon.discount_value) / 100)
  if (coupon.discount_type === 'percent' && coupon.max_discount != null) {
    discount = Math.min(discount, coupon.max_discount)
  }
  discount = Math.max(0, Math.min(discount, baseAmount))
  let finalAmount = baseAmount - discount
  if (finalAmount > 0 && finalAmount < MIN_CHARGE_PAISE) {
    finalAmount = 0
    discount = baseAmount
  }

  return { ok: true, coupon, discount, finalAmount }
}

// ─── Input validation helpers ────────────────────────────────────────────────
function normalizeCode(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '-')
}
function randomSuffix(): string {
  // 4 base36 chars, uppercase (no Math.random concerns server-side).
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}
function suggestCode(promoter: string): string {
  const base = promoter.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'PROMO'
  return `${base}-${randomSuffix()}`
}

/** Validate the discount type/value pair; returns an error string or null. */
function validateDiscount(type: unknown, value: unknown): string | null {
  if (type !== 'flat' && type !== 'percent') return 'discountType must be "flat" or "percent".'
  const v = Math.trunc(Number(value))
  if (!Number.isFinite(v)) return 'discountValue must be a number.'
  if (type === 'percent' && (v < 1 || v > 100)) return 'Percentage must be between 1 and 100.'
  if (type === 'flat' && v < 1) return 'Flat discount must be at least ₹1 (100 paise).'
  return null
}

function optInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ─── POST /api/coupons/validate ──────────────────────────────────────────────
// Any signed-in user: preview a code's discount before paying. The base price is
// derived server-side from the plan (client amount is only trusted for the
// generic contribution path).
router.post(
  '/validate',
  requireAuth,
  asyncH(async (req: AuthedRequest, res) => {
    const base = baseAmountForPlan(req.body?.plan, Number(req.body?.amount))
    const ev = await evaluateCoupon(String(req.body?.code ?? ''), base)
    if (!ev.ok) return res.status(200).json({ valid: false, reason: ev.reason })
    res.json({
      valid: true,
      code: ev.coupon.code,
      promoterName: ev.coupon.promoter_name,
      discountType: ev.coupon.discount_type,
      discountValue: ev.coupon.discount_value,
      baseAmount: base,
      discount: ev.discount,
      finalAmount: ev.finalAmount,
    })
  })
)

// ─── Superadmin-only management ──────────────────────────────────────────────
const admin = [requireAuth, requireSuperadmin] as const

// GET /api/coupons — list every coupon with paid-redemption stats.
router.get(
  '/',
  ...admin,
  asyncH(async (_req: AuthedRequest, res) => {
    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return sendDbError(res, error)

    // Aggregate paid redemptions + total discount per coupon from the ledger.
    const { data: paid } = await supabaseAdmin
      .from('payments')
      .select('coupon_id, discount_amount')
      .eq('status', 'paid')
      .not('coupon_id', 'is', null)

    const stats = new Map<string, { redemptions: number; totalDiscount: number }>()
    for (const p of paid ?? []) {
      const id = (p as { coupon_id: string }).coupon_id
      const s = stats.get(id) ?? { redemptions: 0, totalDiscount: 0 }
      s.redemptions += 1
      s.totalDiscount += (p as { discount_amount: number | null }).discount_amount ?? 0
      stats.set(id, s)
    }

    const withStats = (coupons ?? []).map((c) => ({
      ...c,
      redemptions: stats.get(c.id)?.redemptions ?? 0,
      total_discount: stats.get(c.id)?.totalDiscount ?? 0,
    }))
    res.json({ coupons: withStats })
  })
)

// POST /api/coupons — create a coupon (code auto-generated if omitted).
router.post(
  '/',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const promoterName = String(req.body?.promoterName ?? '').trim()
    if (!promoterName) return res.status(400).json({ error: 'promoterName is required.' })

    const discountType = req.body?.discountType
    const discountValue = Math.trunc(Number(req.body?.discountValue))
    const vErr = validateDiscount(discountType, discountValue)
    if (vErr) return res.status(400).json({ error: vErr })

    const maxDiscount = discountType === 'percent' ? optInt(req.body?.maxDiscount) : null
    const maxRedemptions = optInt(req.body?.maxRedemptions)
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt).toISOString() : null
    const active = req.body?.active === undefined ? true : Boolean(req.body.active)

    const wantedCode = req.body?.code ? normalizeCode(String(req.body.code)) : null
    if (wantedCode && !/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(wantedCode)) {
      return res.status(400).json({ error: 'Code must be 2–32 chars: letters, numbers, dashes.' })
    }

    // Insert; if no code was supplied, retry a few times on the (rare) collision.
    let lastErr: { message?: string; code?: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = wantedCode ?? suggestCode(promoterName)
      const { data, error } = await supabaseAdmin
        .from('coupons')
        .insert({
          code,
          promoter_name: promoterName,
          discount_type: discountType,
          discount_value: discountValue,
          max_discount: maxDiscount,
          max_redemptions: maxRedemptions,
          expires_at: expiresAt,
          active,
          created_by: req.userId,
        })
        .select('*')
        .single()
      if (!error) return res.status(201).json({ coupon: data })
      lastErr = error as { message?: string; code?: string }
      // 23505 = unique violation. If the user picked the code, it's a real clash.
      if ((error as { code?: string }).code === '23505') {
        if (wantedCode) return res.status(409).json({ error: `Code "${wantedCode}" already exists.` })
        continue // auto-generated clash → try another
      }
      return sendDbError(res, error)
    }
    return sendDbError(res, lastErr)
  })
)

// PATCH /api/coupons/:id — edit fields / toggle active.
router.patch(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const patch: Record<string, unknown> = {}
    const b = req.body ?? {}

    if (b.promoterName !== undefined) {
      const name = String(b.promoterName).trim()
      if (!name) return res.status(400).json({ error: 'promoterName cannot be empty.' })
      patch.promoter_name = name
    }
    if (b.discountType !== undefined || b.discountValue !== undefined) {
      // When changing either, both must be present and valid together.
      const vErr = validateDiscount(b.discountType, b.discountValue)
      if (vErr) return res.status(400).json({ error: vErr })
      patch.discount_type = b.discountType
      patch.discount_value = Math.trunc(Number(b.discountValue))
      patch.max_discount = b.discountType === 'percent' ? optInt(b.maxDiscount) : null
    } else if (b.maxDiscount !== undefined) {
      patch.max_discount = optInt(b.maxDiscount)
    }
    if (b.maxRedemptions !== undefined) patch.max_redemptions = optInt(b.maxRedemptions)
    if (b.expiresAt !== undefined) {
      patch.expires_at = b.expiresAt ? new Date(b.expiresAt).toISOString() : null
    }
    if (b.active !== undefined) patch.active = Boolean(b.active)
    if (b.code !== undefined) {
      const code = normalizeCode(String(b.code))
      if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(code)) {
        return res.status(400).json({ error: 'Code must be 2–32 chars: letters, numbers, dashes.' })
      }
      patch.code = code
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' })
    }

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single()
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return res.status(409).json({ error: 'That code is already in use.' })
      }
      return sendDbError(res, error)
    }
    res.json({ coupon: data })
  })
)

// DELETE /api/coupons/:id — remove a coupon. Past payments keep coupon_code (the
// FK is ON DELETE SET NULL) so historical reporting survives.
router.delete(
  '/:id',
  ...admin,
  asyncH(async (req: AuthedRequest, res) => {
    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', req.params.id)
    if (error) return sendDbError(res, error)
    res.json({ deleted: true })
  })
)

export default router
