import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const extractNums = (s) => (s || '').match(/\d+(\.\d+)?/g) || []

const TOPICS = ['Ratio And Proportion','Number Series','3D - Volume & Surface Area','2D - Area',
  'Direction Based','Probability','Simple and Compound Interest','Dice Problems','Simplification',
  'Time, Work , Speed And Distance','Time and Work','Perimeter, Circumference & Diameter',
  'Clock Problems','Conversion of Information to Data','Parametric Representation','Seating Arrangement']

const out = {}
for (const topic of TOPICS) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer,
      (select count(*) from bookmarks b where b.question_id=q.id)::int n_book,
      (select count(*) from seen_questions s where s.question_id=q.id)::int n_seen,
      (select count(*) from test_answers t where t.question_id=q.id)::int n_ans
    from questions q where category='aptitude' and aptitude_topic=$1 order by id`, [topic])
  const byNums = new Map()
  for (const r of rows) {
    const nums = extractNums(r.question_text).sort().join(',')
    if (!nums) continue
    if (!byNums.has(nums)) byNums.set(nums, [])
    byNums.get(nums).push(r)
  }
  const groups = [...byNums.entries()].filter(([, g]) => g.length > 1)
  if (groups.length) out[topic] = groups.map(([nums, g]) => ({ nums, rows: g }))
}
writeFileSync('_dedup_all_topics_full.json', JSON.stringify(out, null, 1))
console.log('topics with groups:', Object.keys(out).length)
console.log('total groups:', Object.values(out).flat().length)
await c.end()
