import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(
  `select id::text as id, aptitude_topic, question_text, option_a, option_b, option_c, option_d, correct_answer
   from questions where category='aptitude' and question_text like '%24%60%120%'`
)
console.log(JSON.stringify(rows, null, 1))
const { rows: rows2 } = await c.query(
  `select id::text as id, aptitude_topic, question_text, option_a, option_b, option_c, option_d, correct_answer
   from questions where category='aptitude' and question_text like '%336%'`
)
console.log('--- 336 matches ---')
console.log(JSON.stringify(rows2, null, 1))
await c.end()
