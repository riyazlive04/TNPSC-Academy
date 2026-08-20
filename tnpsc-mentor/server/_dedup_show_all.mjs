import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
const CATS = ['pyq2', 'pyq4', 'aptitude', 'mock', 'testseries_g2']
for (const category of CATS) {
  const { rows } = await c.query(`select id, question_text, correct_answer from questions where category=$1`, [category])
  const g = new Map()
  for (const r of rows) { const k = norm(r.question_text); if (!k) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(r) }
  const dups = [...g.values()].filter((x) => x.length > 1)
  console.log(`\n\n########## ${category} — ${dups.length} groups ##########`)
  dups.forEach((grp, i) => {
    console.log(`\n--- group ${i + 1} (${grp.length}x): "${(grp[0].question_text || '').replace(/\s+/g, ' ').slice(0, 100)}"`)
    grp.forEach((r) => console.log(`   ${r.id.slice(0, 8)}  ans=${r.correct_answer}`))
  })
}
await c.end()
