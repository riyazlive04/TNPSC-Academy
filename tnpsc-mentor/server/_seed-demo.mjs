import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ─── Throwaway demo account for the marketing screen-recording ────────────────
// Creates (or refreshes) ONE student account with a known password, a complete
// profile (so it skips /complete-profile), and a paid `premium_annual` ledger row
// (so the PYQ/CA per-topic free-gate never interrupts repeated recording runs).
// Everything it writes is scoped to this user and removed by `_seed-demo.mjs del`.
//
//   node _seed-demo.mjs            # create / refresh the demo user
//   node _seed-demo.mjs del        # delete the demo user + its rows (teardown)

const EMAIL = 'demo.aspirant@tnpscmentor.app'
const PASSWORD = 'DemoAspirant#2026'
const DEL = process.argv[2] === 'del'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in server/.env')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

/** Find the demo auth user by email (paged listUsers, like _clear-sessions.mjs). */
async function findUserId() {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL.toLowerCase())
    if (hit) return hit.id
    if (data.users.length < 200) return null
    page++
  }
}

if (DEL) {
  const id = await findUserId()
  if (!id) {
    console.log('Nothing to delete — no demo user for', EMAIL)
    process.exit(0)
  }
  // payments / user_sessions / profiles cascade off auth.users in most setups, but
  // delete the child rows explicitly so teardown is clean regardless of FK config.
  await admin.from('payments').delete().eq('user_id', id)
  await admin.from('user_sessions').delete().eq('user_id', id)
  await admin.auth.admin.deleteUser(id) // removes auth.users row (profile cascades)
  console.log('Deleted demo user + rows for', EMAIL, `(${id})`)
  process.exit(0)
}

// ─── Create or refresh the auth user ──────────────────────────────────────────
let userId = await findUserId()
if (userId) {
  await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
  console.log('Refreshed existing demo user:', userId)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true, // no confirmation email — login works immediately
    user_metadata: { full_name: 'Demo Aspirant' },
  })
  if (error) throw error
  userId = data.user.id
  console.log('Created demo user:', userId)
}

// ─── Complete the profile (phone present ⇒ skips /complete-profile) ────────────
const { error: profErr } = await admin.from('profiles').upsert({
  id: userId,
  full_name: 'Demo Aspirant',
  email: EMAIL,
  phone: '9000000000',
  gender: 'male',
  target_group: 'Group1',
})
if (profErr) throw profErr
console.log('Profile upserted (complete → no onboarding redirect)')

// ─── Grant premium via the ledger (unlimited PYQ/CA — no paywall mid-demo) ─────
await admin.from('payments').delete().eq('user_id', userId) // idempotent
const { error: payErr } = await admin.from('payments').insert({
  user_id: userId,
  razorpay_order_id: `demo_premium_${Date.now().toString(36)}`,
  amount: 0,
  currency: 'INR',
  receipt: `rcpt_demo_${userId.slice(0, 8)}`,
  notes: { plan: 'premium_annual', source: 'demo-seed' },
  status: 'paid',
})
if (payErr) throw payErr
console.log('Premium granted (premium_annual, paid)')

// ─── Clear device sessions so the 2-device cap starts fresh each run ───────────
await admin.from('user_sessions').delete().eq('user_id', userId)
console.log('Cleared device sessions')

console.log(`\n✅ Demo account ready:\n   email:    ${EMAIL}\n   password: ${PASSWORD}\n   user id:  ${userId}`)
