import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Tags the existing PYQ History bank (category='pyq', subject='History and INM',
 * 214 rows) with a historical PERIOD — ancient / medieval / modern — stored in
 * the otherwise-unused `questions.unit` column.
 *
 * The period classification comes from the user's `history/<period>/*.docx`
 * files, distilled into `server/history_periods.json` as a flat
 *   { external_id: 'ancient' | 'medieval' | 'modern' }
 * map (external_id = `pyq-history-<year>_Q<no>`). Every docx question maps 1:1
 * to an existing DB row — this script re-classifies, it does NOT import content.
 *
 * Powers the History → {Ancient, Medieval, Modern} test selector. The quiz then
 * filters on `unit` via get_quiz_questions (see supabase/history_periods.sql).
 *
 * Idempotent (plain UPDATEs by external_id). Safe dry-run by default.
 *   node load-history-periods.mjs           # dry-run: report only
 *   APPLY=1 node load-history-periods.mjs   # write
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.env.APPLY === '1'
const SUBJECT = 'History and INM'

const map = JSON.parse(readFileSync(join(__dirname, 'history_periods.json'), 'utf8'))
const entries = Object.entries(map) // [external_id, period]

const byPeriod = {}
for (const [, p] of entries) byPeriod[p] = (byPeriod[p] ?? 0) + 1
console.table(byPeriod)
console.log(`Total mappings: ${entries.length}  | Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
})
await c.connect()
console.log('Connected.')

// Pre-flight: every external_id in the map must exist as a PYQ History row.
const ids = entries.map(([id]) => id)
const { rows: present } = await c.query(
  `select external_id from questions where category='pyq' and subject=$1 and external_id = any($2::text[])`,
  [SUBJECT, ids]
)
const found = new Set(present.map((r) => r.external_id))
const missing = ids.filter((id) => !found.has(id))
console.log(`Matched ${found.size}/${ids.length} rows in DB.` + (missing.length ? ` MISSING ${missing.length}:` : ''))
if (missing.length) console.log(missing.slice(0, 20))

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to write the period tags.')
  await c.end()
  process.exit(0)
}

if (missing.length) {
  console.error('\nRefusing to APPLY with unmatched external_ids — fix history_periods.json first.')
  await c.end()
  process.exit(1)
}

try {
  await c.query('begin')
  let updated = 0
  for (const period of ['ancient', 'medieval', 'modern']) {
    const periodIds = entries.filter(([, p]) => p === period).map(([id]) => id)
    const res = await c.query(
      `update questions set unit=$1 where category='pyq' and subject=$2 and external_id = any($3::text[])`,
      [period, SUBJECT, periodIds]
    )
    updated += res.rowCount
    console.log(`  ${period}: ${res.rowCount} rows tagged`)
  }
  await c.query('commit')
  console.log(`COMMIT ok. ${updated} rows updated.`)
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  await c.end()
  process.exit(1)
}

console.table(
  (await c.query(
    `select unit, count(*)::int n from questions where category='pyq' and subject=$1 group by unit order by unit`,
    [SUBJECT]
  )).rows
)
await c.end()
