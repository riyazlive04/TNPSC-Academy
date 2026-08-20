import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const extractNums = (s) => (s || '').match(/\d+(\.\d+)?/g) || []

for (const topic of ['Simple and Compound Interest', 'Ratio And Proportion']) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer from questions where category='aptitude' and aptitude_topic=$1`, [topic])
  const byNums = new Map()
  for (const r of rows) {
    const nums = extractNums(r.question_text).sort().join(',')
    if (!nums) continue
    if (!byNums.has(nums)) byNums.set(nums, [])
    byNums.get(nums).push(r)
  }
  const groups = [...byNums.entries()].filter(([, g]) => g.length > 1)
  console.log(`\n### ${topic} — ${groups.length} groups`)
  groups.forEach(([nums, g]) => {
    console.log(`\n[${nums}]`)
    g.forEach((r) => console.log(`  ${r.id} ans=${r.correct_answer} "${(r.question_text||'').replace(/\s+/g,' ').slice(0,110)}"`))
  })
}
await c.end()
