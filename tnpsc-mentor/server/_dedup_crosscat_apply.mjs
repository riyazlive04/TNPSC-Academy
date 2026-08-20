/**
 * Consolidate all cross-category batch verification files (outer x3, subject/pyq/pyq2/pyq4,
 * mock/testseries/testseries_g2) into one DB update. Only true_duplicate groups' rewrites
 * are applied here. Conflicts are handled separately after manual/human review.
 * Backs up full original rows to JSON before any mutation. Report-only unless --write passed.
 */
import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

const WRITE = process.argv.includes('--write')
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const FILES = ['_dedup_outer_batch1.json', '_dedup_outer_batch2.json', '_dedup_outer_batch3.json', '_dedup_batch_subj_pyq.json', '_dedup_batch_mock_ts.json']
const EXCLUDE_CATEGORIES = new Set(['pyq', 'pyq2', 'pyq4']) // user directive: do not modify pyq content, detection-only
let REWRITES = []
let skippedPyq = 0
for (const f of FILES) {
  const data = JSON.parse(readFileSync(f, 'utf8'))
  for (const g of data) {
    if (g.classification === 'true_duplicate' && Array.isArray(g.rewrites)) {
      if (g.category && EXCLUDE_CATEGORIES.has(g.category)) { skippedPyq += g.rewrites.length; continue }
      REWRITES.push(...g.rewrites.map((r) => ({ ...r, _srcFile: f })))
    }
  }
}
console.log(`skipped ${skippedPyq} rewrite(s) belonging to pyq/pyq2/pyq4 per user directive (not modified).`)
console.log(`=== CROSS-CATEGORY DEDUP APPLY ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
console.log(`total rewrites collected: ${REWRITES.length}`)

let errs = 0
const seenIds = new Set()
for (const r of REWRITES) {
  if (seenIds.has(r.id)) { console.error(`DUPLICATE id in rewrite list: ${r.id} (${r._srcFile})`); errs++ }
  seenIds.add(r.id)
  const opts = [r.option_a, r.option_b, r.option_c, r.option_d]
  if (opts.some((o) => o == null || o === '')) { console.error(`missing option for ${r.id} (${r._srcFile})`); errs++ }
  if (new Set(opts.map((o) => (o || '').trim().toLowerCase())).size !== 4) { console.error(`non-distinct options for ${r.id} (${r._srcFile})`); errs++ }
  if (!['A', 'B', 'C', 'D'].includes(r.correct_answer)) { console.error(`bad correct_answer for ${r.id}: ${r.correct_answer} (${r._srcFile})`); errs++ }
  if (!r.question_text || !r.explanation || !r.explanation_ta) { console.error(`missing required field for ${r.id} (${r._srcFile})`); errs++ }
}
if (errs) {
  console.error(`\n${errs} structural errors found. Aborting without writing.`)
  await c.end()
  process.exit(1)
}
console.log('structural validation passed.')

const ids = REWRITES.map((r) => r.id)
const { rows: existing } = await c.query('select id from questions where id = any($1::uuid[])', [ids])
const existingSet = new Set(existing.map((r) => r.id))
const missing = ids.filter((id) => !existingSet.has(id))
if (missing.length) {
  console.error(`WARNING: ${missing.length} ids not found in DB:`, missing.slice(0, 15))
  console.error('Aborting.')
  await c.end()
  process.exit(1)
}
console.log(`all ${ids.length} target ids verified present in DB.`)

const { rows: backupRows } = await c.query('select * from questions where id = any($1::uuid[])', [ids])
writeFileSync('_dedup_crosscat_backup.json', JSON.stringify(backupRows, null, 1))
console.log(`backed up ${backupRows.length} original rows to server/_dedup_crosscat_backup.json`)

if (!WRITE) {
  console.log('DRY RUN — no changes made. Re-run with --write to apply.')
  await c.end()
  process.exit(0)
}

let updated = 0
for (const r of REWRITES) {
  const res = await c.query(
    `update questions set question_text=$1, question_text_ta=$2,
       option_a=$3, option_b=$4, option_c=$5, option_d=$6,
       option_a_ta=$7, option_b_ta=$8, option_c_ta=$9, option_d_ta=$10,
       correct_answer=$11, explanation=$12, explanation_ta=$13
     where id=$14`,
    [r.question_text, r.question_text_ta, r.option_a, r.option_b, r.option_c, r.option_d,
      r.option_a_ta || null, r.option_b_ta || null, r.option_c_ta || null, r.option_d_ta || null,
      r.correct_answer, r.explanation, r.explanation_ta, r.id]
  )
  updated += res.rowCount
}
console.log(`rewritten rows: ${updated}`)
await c.end()
