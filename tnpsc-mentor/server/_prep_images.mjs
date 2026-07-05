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
const { rows } = await c.query(
  `select id, aptitude_type, question_text, question_text_ta, option_a, option_b, option_c, option_d,
          correct_answer, explanation, explanation_ta
     from questions
    where category='aptitude' and images is not null and expl_status is distinct from 'generated'
    order by aptitude_type, id`)
const byType = {}
for (const r of rows) { (byType[r.aptitude_type] ||= []).push(r) }
const summary = {}
for (const [type, list] of Object.entries(byType)) {
  const chunks = []
  for (let i = 0; i * 12 < list.length; i++) {
    const slice = list.slice(i * 12, i * 12 + 12)
    const name = `q_img_${type}_${i}`
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(slice, null, 1))
    chunks.push({ name, subject: `img_${type}`, count: slice.length })
  }
  writeFileSync(`${OUT}/_chunks_img_${type}.json`, JSON.stringify(chunks, null, 1))
  summary[type] = { questions: list.length, chunks: chunks.length }
}
console.log('figure questions to upgrade (via existing solutions):', JSON.stringify(summary))
await c.end()
