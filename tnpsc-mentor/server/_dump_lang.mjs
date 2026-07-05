import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
const OUT = 'C:/Users/mas20/AppData/Local/Temp/claude/c--Users-mas20-Desktop-work-TNPSC/e9be7729-7398-40fa-9d3f-08406580cb09/scratchpad'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
for (const [subj, file] of [['English', 'g2_eng.json'], ['Tamil', 'g2_tam.json']]) {
  const r = await c.query(
    `select id, topic, year, question_text, option_a, option_b, option_c, option_d, correct_answer
       from questions where category='pyq2' and subject=$1 order by id`, [subj])
  writeFileSync(OUT + '/' + file, JSON.stringify(r.rows, null, 1))
  console.log(subj, r.rows.length)
}
await c.end()
