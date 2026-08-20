/**
 * v2: signature built from question_text + all 4 options combined, so generic shared
 * instructions ("Find the odd one out") no longer false-match when the actual options differ.
 */
import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const STOP = new Set(['the','a','an','is','are','was','were','of','in','and','to','which','what','how','who','when','where','following','given','find','correct','select','determine','many','this','that','with','from','for','their','its','has','have','had','not','one','two','three','four','among','below','above','also','been','being','will','would','can','could','should','into','than','then','they','them','these','those','answer','question','options','code','list','statement','statements','india','indian','tamil','nadu','true','false','incorrect','wrong','choose','pick','out','sentence','sentences'])
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9஀-௿\s]/g, ' ').replace(/\s+/g, ' ').trim()
const sigWords = (s, n) => {
  const words = norm(s).split(' ').filter((w) => w.length >= 5 && !STOP.has(w) && !/^\d+$/.test(w))
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, n).sort()
}

const CATS = ['outer', 'subject', 'pyq', 'pyq2', 'pyq4', 'mock', 'testseries', 'testseries_g2']
const summary = {}
for (const category of CATS) {
  const { rows } = await c.query(`select id, question_text, option_a, option_b, option_c, option_d from questions where category=$1`, [category])
  const buckets = new Map()
  for (const r of rows) {
    const combined = [r.question_text, r.option_a, r.option_b, r.option_c, r.option_d].filter(Boolean).join(' ')
    const sig = sigWords(combined, 6).join('|')
    const qSigLen = sigWords(r.question_text, 4).length
    if (!sig || sigWords(combined, 6).length < 5) continue
    if (!buckets.has(sig)) buckets.set(sig, [])
    buckets.get(sig).push(r)
  }
  const groups = [...buckets.entries()].filter(([, g]) => g.length > 1)
  summary[category] = { total: rows.length, groups: groups.length, rowsInGroups: groups.reduce((a, [, g]) => a + g.length, 0) }
  console.log(`[${category}] total=${rows.length} candidate-groups=${groups.length} rowsInGroups=${groups.reduce((a, [, g]) => a + g.length, 0)}`)
  if (groups.length) {
    writeFileSync(`_dedup_v2_${category}.json`, JSON.stringify(groups.map(([sig, g]) => ({ sig, rows: g })), null, 1))
  }
}
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(summary, null, 1))
await c.end()
