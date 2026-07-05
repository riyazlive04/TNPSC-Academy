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
// Non-image aptitude-bank questions with their existing plain-text worked solutions.
const r = await c.query(
  `select id, aptitude_type, question_text, question_text_ta,
          option_a, option_b, option_c, option_d, correct_answer,
          explanation, explanation_ta
     from questions where category='aptitude' and images is null order by aptitude_type, id`)
writeFileSync(OUT + '/aptbank_all.json', JSON.stringify(r.rows, null, 1))
// image ones held separately
const img = await c.query(
  `select id, aptitude_type, images from questions where category='aptitude' and images is not null order by id`)
writeFileSync(OUT + '/aptbank_images.json', JSON.stringify(img.rows, null, 1))
const byType = {}
r.rows.forEach((q) => { byType[q.aptitude_type] = (byType[q.aptitude_type] || 0) + 1 })
console.log('non-image:', r.rows.length, JSON.stringify(byType), '| image:', img.rows.length)
await c.end()
