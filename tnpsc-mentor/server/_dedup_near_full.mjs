import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const extractNums = (s) => (s || '').match(/\d+(\.\d+)?/g) || []

for (const topic of ['LCM and HCF', 'Percentage']) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer,
      (select count(*) from bookmarks b where b.question_id=q.id) n_book,
      (select count(*) from seen_questions s where s.question_id=q.id) n_seen,
      (select count(*) from test_answers t where t.question_id=q.id) n_ans
    from questions q where category='aptitude' and aptitude_topic=$1 order by id`, [topic])
  const byNums = new Map()
  for (const r of rows) {
    const nums = extractNums(r.question_text).sort().join(',')
    if (!nums) continue
    if (!byNums.has(nums)) byNums.set(nums, [])
    byNums.get(nums).push(r)
  }
  const groups = [...byNums.entries()].filter(([, g]) => g.length > 1)
  console.log(`\n\n########## ${topic} — ${groups.length} groups ##########`)
  groups.forEach(([nums, g], i) => {
    console.log(`\n===== group ${i+1} [${nums}] =====`)
    g.forEach((r) => console.log(JSON.stringify({
      id: r.id, qt: r.question_text,
      a: r.option_a, b: r.option_b, c: r.option_c, d: r.option_d,
      ans: r.correct_answer, refs: r.n_book+r.n_seen+r.n_ans
    })))
  })
}
await c.end()
