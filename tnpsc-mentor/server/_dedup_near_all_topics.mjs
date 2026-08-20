import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const extractNums = (s) => (s || '').match(/\d+(\.\d+)?/g) || []

const { rows: topics } = await c.query(`select distinct aptitude_topic, count(*) n from questions where category='aptitude' group by aptitude_topic order by n desc`)

let grandTotal = 0
for (const t of topics) {
  const { rows } = await c.query(`select id, question_text from questions where category='aptitude' and aptitude_topic=$1`, [t.aptitude_topic])
  const byNums = new Map()
  for (const r of rows) {
    const nums = extractNums(r.question_text).sort().join(',')
    if (!nums) continue
    if (!byNums.has(nums)) byNums.set(nums, [])
    byNums.get(nums).push(r)
  }
  const groups = [...byNums.entries()].filter(([, g]) => g.length > 1)
  const rowsInGroups = groups.reduce((a, [, g]) => a + g.length, 0)
  grandTotal += groups.length
  console.log(`${t.aptitude_topic} (${t.n} rows): ${groups.length} same-number groups, ${rowsInGroups} rows involved`)
}
console.log(`\nTOTAL same-number groups across all aptitude topics: ${grandTotal}`)
await c.end()
