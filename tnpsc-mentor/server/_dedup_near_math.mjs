import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const extractNums = (s) => (s || '').match(/\d+(\.\d+)?/g) || []
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

for (const topic of ['LCM and HCF', 'Percentage']) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer from questions where category='aptitude' and aptitude_topic=$1 order by id`, [topic])
  console.log(`\n########## ${topic} — ${rows.length} rows ##########`)
  // group by sorted numeric signature extracted from the question text
  const byNums = new Map()
  for (const r of rows) {
    const nums = extractNums(r.question_text).sort().join(',')
    if (!nums) continue
    if (!byNums.has(nums)) byNums.set(nums, [])
    byNums.get(nums).push(r)
  }
  const sameNumGroups = [...byNums.entries()].filter(([, g]) => g.length > 1)
  console.log(`groups sharing identical numeric parameters: ${sameNumGroups.length}`)
  sameNumGroups.forEach(([nums, g], i) => {
    console.log(`\n-- group ${i+1} [nums: ${nums}] (${g.length}x)`)
    g.forEach((r) => console.log(`   ${r.id.slice(0,8)} ans=${r.correct_answer} "${norm(r.question_text).slice(0,100)}"`))
  })
}
await c.end()
