import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'

/**
 * Backfills the `year` column for the PYQ Aptitude rows (category='pyq',
 * subject='Aptitude') which were imported without a year. Source of truth:
 *   AllYears/TNPSC_AllYears_Aptitude copy.json  (carries qid/year per question)
 *
 * Rows are matched by question_text (exact whitespace-normalised first, then a
 * loose alphanumeric-only fallback for minor punctuation differences). The
 * mapping has no conflicting years, so each text maps to exactly one year.
 *
 * Safe dry-run by default; APPLY=1 to write.
 *   node backfill-aptitude-years.mjs           # dry-run: report only
 *   APPLY=1 node backfill-aptitude-years.mjs   # write
 */

const SRC = 'c:/Users/mas20/Desktop/work/TNPSC/AllYears/TNPSC_AllYears_Aptitude copy.json'
const APPLY = process.env.APPLY === '1'

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const loose = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const arr = JSON.parse(readFileSync(SRC, 'utf8'))
const exact = new Map()
const looseMap = new Map()
for (const q of arr) {
  const y = Number.isFinite(q.year) ? q.year : null
  if (y == null) continue
  exact.set(norm(q.question_text), y)
  const lk = loose(q.question_text)
  if (!looseMap.has(lk)) looseMap.set(lk, y)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const r = await c.query(
  "select id, year, question_text from questions where category='pyq' and subject='Aptitude'"
)

const updates = []
const unmatched = []
const dist = {}
for (const row of r.rows) {
  const y = exact.get(norm(row.question_text)) ?? looseMap.get(loose(row.question_text)) ?? null
  if (y == null) { unmatched.push(row.question_text.slice(0, 60)); continue }
  dist[y] = (dist[y] || 0) + 1
  if (row.year !== y) updates.push({ id: row.id, year: y })
}

console.log(`DB pyq aptitude rows: ${r.rows.length} | matched: ${r.rows.length - unmatched.length} | unmatched: ${unmatched.length}`)
console.log('year distribution (matched):', dist)
console.log(`rows needing update: ${updates.length} | mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (unmatched.length) console.log('UNMATCHED samples:', unmatched.slice(0, 10))

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to write.')
  await c.end()
  process.exit(0)
}

try {
  await c.query('begin')
  for (const u of updates) {
    await c.query('update questions set year=$1 where id=$2', [u.year, u.id])
  }
  await c.query('commit')
  console.log(`COMMIT ok. Updated ${updates.length} rows.`)
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.table(
  (await c.query(
    "select year, count(*)::int n from questions where category='pyq' and subject='Aptitude' group by year order by year"
  )).rows
)
await c.end()
