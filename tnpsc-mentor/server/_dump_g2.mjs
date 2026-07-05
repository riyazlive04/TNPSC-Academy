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

const gs = await c.query(
  `select id, topic, year, question_text, option_a, option_b, option_c, option_d, correct_answer
     from questions where category='pyq2' and subject='General Studies' order by id`)
writeFileSync(OUT + '/g2_gs.json', JSON.stringify(gs.rows, null, 1))

const apt = await c.query(
  `select id, topic, year, aptitude_type, question_text, option_a, option_b, option_c, option_d,
          correct_answer, images
     from questions where category='pyq2' and subject='Aptitude' order by id`)
writeFileSync(OUT + '/g2_apt.json', JSON.stringify(apt.rows, null, 1))

console.log('GS:', gs.rows.length, '| Aptitude:', apt.rows.length,
            '| apt with images:', apt.rows.filter(r => r.images).length)
await c.end()
