import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
for (const category of ['pyq2', 'outer']) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer,
      (select count(*) from bookmarks b where b.question_id=q.id) n_book,
      (select count(*) from seen_questions s where s.question_id=q.id) n_seen,
      (select count(*) from test_answers t where t.question_id=q.id) n_ans
    from questions q where category=$1`, [category])
  const full = new Map()
  for (const r of rows) {
    const k = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].map(norm).join('|')
    if (!norm(r.question_text)) continue
    if (!full.has(k)) full.set(k, [])
    full.get(k).push(r)
  }
  const trueDups = [...full.values()].filter((x) => x.length > 1)
  console.log(`\n########## ${category} — ${trueDups.length} true duplicate groups ##########`)
  trueDups.forEach((g, i) => {
    console.log(`\n-- group ${i+1}: "${(g[0].question_text||'').replace(/\s+/g,' ').slice(0,90)}"`)
    g.forEach((r) => console.log(`   ${r.id.slice(0,8)} ans=${r.correct_answer} book=${r.n_book} seen=${r.n_seen} ans_taken=${r.n_ans}`))
  })
}
await c.end()
