import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
const CATS = ['outer', 'pyq2']
for (const category of CATS) {
  const { rows } = await c.query(`select * from questions where category=$1`, [category])
  const full = new Map()
  for (const r of rows) {
    const k = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].map(norm).join('|')
    if (!norm(r.question_text)) continue
    if (!full.has(k)) full.set(k, [])
    full.get(k).push(r)
  }
  const trueDups = [...full.values()].filter((x) => x.length > 1)
  console.log(`\n########## ${category} — ${trueDups.length} groups ##########`)
  trueDups.forEach((g, i) => {
    console.log(`\n===== group ${i+1} =====`)
    g.forEach((r) => console.log(JSON.stringify({
      id: r.id, qt: r.question_text, qt_ta: r.question_text_ta,
      a: r.option_a, b: r.option_b, c: r.option_c, d: r.option_d,
      a_ta: r.option_a_ta, b_ta: r.option_b_ta, c_ta: r.option_c_ta, d_ta: r.option_d_ta,
      ans: r.correct_answer, expl: (r.explanation||'').slice(0,150), expl_ta: (r.explanation_ta||'').slice(0,80),
      topic: r.topic, subject: r.subject, unit: r.unit, group_type: r.group_type, source_tag: r.source_tag
    })))
  })
}
await c.end()
