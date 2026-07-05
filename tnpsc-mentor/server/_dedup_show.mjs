import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer, images from questions where category='aptitude'`)
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const g = new Map()
for (const r of rows) { const k = norm(r.question_text); if (!g.has(k)) g.set(k, []); g.get(k).push(r) }
const dups = [...g.values()].filter((x) => x.length > 1)
console.log('same-stem groups:', dups.length, '| total rows in them:', dups.reduce((a, x) => a + x.length, 0))
const opts = (r) => `A:${r.option_a} | B:${r.option_b} | C:${r.option_c} | D:${r.option_d} [ans ${r.correct_answer}]${r.images ? ' [IMG]' : ''}`
dups.slice(0, 10).forEach((grp, i) => {
  console.log(`\n--- group ${i + 1} (${grp.length}x): "${(grp[0].question_text || '').replace(/\s+/g, ' ').slice(0, 85)}"`)
  grp.forEach((r) => console.log(`   ${r.id.slice(0, 8)}  ${opts(r)}`))
})
await c.end()
