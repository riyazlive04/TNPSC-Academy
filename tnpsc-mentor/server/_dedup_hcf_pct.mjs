import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows: topics } = await c.query(`select distinct aptitude_topic, count(*) n from questions where category='aptitude' group by aptitude_topic order by n desc`)
console.log('=== ALL APTITUDE TOPICS ===')
topics.forEach((t) => console.log(`  ${t.aptitude_topic}: ${t.n}`))

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()
const targets = topics.filter((t) => /hcf|lcm|percent/i.test(t.aptitude_topic || ''))
console.log('\n=== MATCHING TOPICS ===', targets.map(t=>t.aptitude_topic))

for (const t of targets) {
  const { rows } = await c.query(`select id, question_text, option_a,option_b,option_c,option_d, correct_answer from questions where category='aptitude' and aptitude_topic=$1`, [t.aptitude_topic])
  const full = new Map()
  for (const r of rows) {
    const k = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].map(norm).join('|')
    if (!norm(r.question_text)) continue
    if (!full.has(k)) full.set(k, [])
    full.get(k).push(r)
  }
  const trueDups = [...full.values()].filter((x) => x.length > 1)
  console.log(`\n[${t.aptitude_topic}] total=${rows.length} true-dup-groups=${trueDups.length}`)
  trueDups.forEach((g, i) => {
    console.log(`  -- group ${i+1}: "${(g[0].question_text||'').replace(/\s+/g,' ').slice(0,80)}"`)
    g.forEach((r) => console.log(`     ${r.id.slice(0,8)} ans=${r.correct_answer}`))
  })
}
await c.end()
