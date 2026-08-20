import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const groups = JSON.parse(readFileSync('_dedup_v2_outer_part3.json', 'utf8'))
const ids = []
for (const g of groups) for (const r of g.rows) ids.push(r.id)

const { rows } = await c.query(
  `select id, subject, topic, unit, category, question_text, question_text_ta,
      option_a, option_b, option_c, option_d,
      option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      correct_answer, explanation, explanation_ta,
      created_at
   from questions where id = any($1::uuid[])`,
  [ids]
)
console.log(`fetched ${rows.length} of ${ids.length} requested ids`)
const byId = Object.fromEntries(rows.map(r => [r.id, r]))
const missing = ids.filter(id => !byId[id])
if (missing.length) console.log('MISSING:', missing)

writeFileSync('_dedup_outer_batch3_full.json', JSON.stringify(rows, null, 1))
console.log('wrote _dedup_outer_batch3_full.json')

await c.end()
