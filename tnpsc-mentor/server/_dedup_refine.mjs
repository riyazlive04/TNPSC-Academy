import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
const CATS = ['outer', 'pyq2', 'pyq4', 'aptitude', 'mock', 'testseries_g2']
for (const category of CATS) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer from questions where category=$1`, [category])
  const full = new Map()
  for (const r of rows) {
    const k = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].map(norm).join('|')
    if (!norm(r.question_text)) continue
    if (!full.has(k)) full.set(k, [])
    full.get(k).push(r)
  }
  const trueDups = [...full.values()].filter((x) => x.length > 1)
  const conflicts = trueDups.filter((g) => new Set(g.map((r) => r.correct_answer)).size > 1)
  const clean = trueDups.filter((g) => new Set(g.map((r) => r.correct_answer)).size === 1)
  console.log(`\n########## ${category} ##########`)
  console.log(`  true full-content duplicate groups: ${trueDups.length}  (clean=${clean.length}, ANSWER-CONFLICTS=${conflicts.length})`)
  if (conflicts.length) {
    console.log(`  --- ANSWER CONFLICTS (same question+options, different correct_answer) ---`)
    conflicts.forEach((g) => {
      console.log(`   "${(g[0].question_text||'').replace(/\s+/g,' ').slice(0,90)}"`)
      g.forEach((r) => console.log(`      ${r.id.slice(0,8)} ans=${r.correct_answer}`))
    })
  }
}
await c.end()
