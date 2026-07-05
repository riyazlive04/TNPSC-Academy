import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Resolve correct answers for a set of question ids (used by the demo recorder so
// the walkthrough scores realistically instead of clicking at random).
//   node _answers.mjs '["<id>","<id>", ...]'   → prints {"<id>":"A", ...}
const ids = JSON.parse(process.argv[2] ?? '[]')
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data, error } = await admin.from('questions').select('id, correct_answer').in('id', ids)
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log(JSON.stringify(Object.fromEntries((data ?? []).map((r) => [r.id, r.correct_answer]))))
