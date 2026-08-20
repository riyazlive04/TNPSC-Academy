import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer, explanation, source_tag, images
  from questions where category='outer' and question_text ilike '%largest producer of groundnut%'`)
console.log(JSON.stringify(rows, null, 2))
await c.end()
