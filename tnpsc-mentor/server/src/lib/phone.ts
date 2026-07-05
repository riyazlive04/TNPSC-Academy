import { supabaseAdmin } from '../supabase.js'
import { normalizeMobile } from './msg91.js'

// ─── Phone-number uniqueness ─────────────────────────────────────────────────
// One mobile number = one account. Phones are stored in mixed shapes (bare
// 10-digit / +91 / 91 / 0-prefixed), so a clash check must compare every variant.

/** The shapes a stored phone might take for a given 10-digit number. */
export function phoneVariants(tenDigit: string): string[] {
  return [tenDigit, `+91${tenDigit}`, `91${tenDigit}`, `0${tenDigit}`]
}

/**
 * True when `rawPhone` already belongs to another account. `exceptId` excludes
 * the caller's own row (so a profile edit that keeps the same number passes).
 * An invalid/empty number can't clash, so returns false. Service-role read.
 */
export async function phoneTakenByOther(rawPhone: string, exceptId?: string): Promise<boolean> {
  const ten = normalizeMobile(rawPhone)
  if (!ten) return false
  let q = supabaseAdmin.from('profiles').select('id').in('phone', phoneVariants(ten))
  if (exceptId) q = q.neq('id', exceptId)
  const { data, error } = await q.limit(1)
  if (error) {
    // Fail CLOSED for a uniqueness guard: a read error must not let a duplicate
    // slip through. (A rare false "taken" is safer than two accounts on a number.)
    console.error('[phone-unique] check failed', error.code, error.message)
    return true
  }
  return (data?.length ?? 0) > 0
}
