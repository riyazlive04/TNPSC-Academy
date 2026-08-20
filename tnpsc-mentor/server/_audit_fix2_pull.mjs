import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

const input = JSON.parse(readFileSync('_audit_fix_input_2.json', 'utf8'))
const ids = input.map(x => x.id)

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows } = await c.query(
  `select id::text as id, aptitude_topic, question_text, question_text_ta,
     option_a, option_b, option_c, option_d, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
     correct_answer, explanation, explanation_ta, active
   from questions where id = any($1::uuid[])`,
  [ids]
)
console.log('found rows:', rows.length, 'of', ids.length)
const foundIds = new Set(rows.map(r => r.id))
for (const id of ids) if (!foundIds.has(id)) console.log('MISSING:', id)

writeFileSync('_audit_fix2_current.json', JSON.stringify(rows, null, 1))
await c.end()
