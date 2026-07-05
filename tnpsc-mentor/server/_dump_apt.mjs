import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
})
await c.connect()

// optional year filter via argv[1]; argv[2] = output path
const year = process.argv[2] ? Number(process.argv[2]) : null
const out = process.argv[3] || '_apt_dump.json'

const yearClause = year ? 'and year = $1' : ''
const params = year ? [year] : []

const sql = `
  select id, category, year, question_text, question_text_ta,
         option_a, option_b, option_c, option_d, option_e,
         option_a_ta, option_b_ta, option_c_ta, option_d_ta, option_e_ta,
         correct_answer, aptitude_type, topic, images, option_images
  from public.questions
  where category in ('pyq','pyq2') and subject='Aptitude' ${yearClause}
  order by category, year, aptitude_type, topic
`
const res = await c.query(sql, params)
writeFileSync(out, JSON.stringify(res.rows, null, 2))
console.log(`Wrote ${res.rows.length} rows to ${out}`)
await c.end()
