/**
 * Scan the entire questions table for near-duplicate question_text within each category.
 * Report-only (no deletes). Groups by normalized stem text per category.
 */
import 'dotenv/config'
import { Client } from 'pg'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows: cats } = await c.query(`select category, count(*) n from questions group by category order by n desc`)
console.log('=== CATEGORY COUNTS ===')
cats.forEach((r) => console.log(`  ${r.category}: ${r.n}`))

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:'"?!]/g, '').trim()

console.log('\n=== DUPLICATE SCAN PER CATEGORY (by normalized question_text) ===')
let grandTotalDupRows = 0
for (const { category } of cats) {
  const { rows } = await c.query(`select id, question_text from questions where category = $1`, [category])
  const g = new Map()
  for (const r of rows) {
    const k = norm(r.question_text)
    if (!k) continue
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(r)
  }
  const dups = [...g.values()].filter((x) => x.length > 1)
  const dupRows = dups.reduce((a, x) => a + x.length, 0)
  const extraRows = dups.reduce((a, x) => a + x.length - 1, 0)
  grandTotalDupRows += extraRows
  if (dups.length) {
    console.log(`  [${category}] total=${rows.length} dupGroups=${dups.length} rowsInDups=${dupRows} extra(removable)=${extraRows}`)
  } else {
    console.log(`  [${category}] total=${rows.length} dupGroups=0`)
  }
}
console.log(`\nTOTAL extra/removable duplicate rows across all categories: ${grandTotalDupRows}`)
await c.end()
