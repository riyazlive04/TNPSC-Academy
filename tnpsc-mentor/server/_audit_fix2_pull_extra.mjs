import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
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
   from questions where id = 'ba036f12-e077-48d2-80f4-ed988dbb47ce'`
)
writeFileSync('_audit_fix2_extra.json', JSON.stringify(rows, null, 1))
console.log(JSON.stringify(rows, null, 1))
await c.end()
