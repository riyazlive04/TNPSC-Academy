/**
 * Near-duplicate scan for non-aptitude categories using a content-word blocking signature
 * (since these are prose GK/history questions, not parameterized math problems where shared
 * numbers are a strong signal). Blocking key = the 4 longest non-stopword tokens, sorted.
 * O(n) via hashmap grouping, safe even for the 28k-row 'outer' category.
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

const STOP = new Set(['the','a','an','is','are','was','were','of','in','and','to','which','what','how','who','when','where','following','given','find','correct','select','determine','many','this','that','with','from','for','their','its','has','have','had','not','one','two','three','four','among','below','above','also','been','being','will','would','can','could','should','into','than','then','they','them','these','those','answer','question','options','code','list','statement','statements','india','indian','tamil','nadu','following:','true','false','incorrect','wrong'])
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9஀-௿\s]/g, ' ').replace(/\s+/g, ' ').trim()
const sigWords = (s) => {
  const words = norm(s).split(' ').filter((w) => w.length >= 5 && !STOP.has(w) && !/^\d+$/.test(w))
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 4).sort()
}

const CATS = ['outer', 'subject', 'pyq', 'pyq2', 'pyq4', 'mock', 'testseries', 'testseries_g2', 'current_affairs']
const summary = {}
for (const category of CATS) {
  const { rows } = await c.query(`select id, question_text from questions where category=$1`, [category])
  const buckets = new Map()
  for (const r of rows) {
    const sig = sigWords(r.question_text).join('|')
    if (!sig || sigWords(r.question_text).length < 3) continue // need at least 3 distinctive words to be meaningful
    if (!buckets.has(sig)) buckets.set(sig, [])
    buckets.get(sig).push(r)
  }
  const groups = [...buckets.entries()].filter(([, g]) => g.length > 1)
  summary[category] = { total: rows.length, groups: groups.length, rowsInGroups: groups.reduce((a, [, g]) => a + g.length, 0) }
  console.log(`[${category}] total=${rows.length} candidate-groups=${groups.length} rowsInGroups=${groups.reduce((a, [, g]) => a + g.length, 0)}`)
  if (groups.length) {
    writeFileSync(`_dedup_wordsig_${category}.json`, JSON.stringify(groups.map(([sig, g]) => ({ sig, rows: g })), null, 1))
  }
}
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(summary, null, 1))
await c.end()
