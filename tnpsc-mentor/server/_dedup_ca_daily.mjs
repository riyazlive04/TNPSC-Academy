import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer, date from ca_daily_questions`)
console.log('ca_daily_questions total:', rows.length)
const stem = new Map()
for (const r of rows) { const k = norm(r.question_text); if (!k) continue; if (!stem.has(k)) stem.set(k, []); stem.get(k).push(r) }
const stemDups = [...stem.values()].filter((x) => x.length > 1)
console.log('stem-level dup groups:', stemDups.length)

const full = new Map()
for (const r of rows) {
  const k = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].map(norm).join('|')
  if (!norm(r.question_text)) continue
  if (!full.has(k)) full.set(k, [])
  full.get(k).push(r)
}
const trueDups = [...full.values()].filter((x) => x.length > 1)
const conflicts = trueDups.filter((g) => new Set(g.map((r) => r.correct_answer)).size > 1)
console.log('true full-content dup groups:', trueDups.length, '| answer-conflicts:', conflicts.length)
trueDups.forEach((g, i) => {
  console.log(`\n-- group ${i+1}: "${(g[0].question_text||'').replace(/\s+/g,' ').slice(0,90)}"`)
  g.forEach((r) => console.log(`   ${r.id.slice(0,8)} ans=${r.correct_answer} date=${r.date}`))
})
await c.end()
