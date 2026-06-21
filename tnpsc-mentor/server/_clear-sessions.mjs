import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// One-off: inspect (and optionally clear) the device sessions for one account,
// to recover from the 2-device cap after repeated test reinstalls.
//   node _clear-sessions.mjs <email>            # list only
//   APPLY=1 node _clear-sessions.mjs <email>    # delete all sessions for it
const EMAIL = process.argv[2]
const APPLY = process.env.APPLY === '1'
if (!EMAIL) {
  console.error('usage: node _clear-sessions.mjs <email>')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// Resolve the user id from auth.users via the admin API.
let userId = null
let page = 1
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL.toLowerCase())
  if (hit) { userId = hit.id; break }
  if (data.users.length < 200) break
  page++
}
if (!userId) { console.error('No auth user for', EMAIL); process.exit(2) }
console.log('user id:', userId)

const { data: sessions, error: selErr } = await admin
  .from('user_sessions')
  .select('id, device_id, label, created_at, last_seen_at')
  .eq('user_id', userId)
if (selErr) throw selErr
console.log(`Active sessions: ${sessions.length}`)
for (const s of sessions) console.log(' -', s.label ?? '(no label)', '|', s.device_id, '|', s.last_seen_at)

if (!APPLY) { console.log('\nDRY-RUN. Re-run with APPLY=1 to delete all of the above.'); process.exit(0) }

const { error: delErr } = await admin.from('user_sessions').delete().eq('user_id', userId)
if (delErr) throw delErr
console.log('Deleted all sessions for', EMAIL)
