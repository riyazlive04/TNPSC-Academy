/**
 * Apply the 79 verified aptitude-bank audit fixes (73 field updates + 6 deactivations)
 * found during the full 1086-question independent-recalculation audit. Backs up every
 * touched row's full original state to JSON before any mutation. Validates each update
 * against live current data (final option for the marked correct_answer must be non-empty)
 * before writing. Report-only unless --write is passed.
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

const ALL = JSON.parse(readFileSync('_audit_fix_all.json', 'utf8'))
console.log(`=== AUDIT FIX APPLY ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
console.log(`total entries: ${ALL.length} (${ALL.filter((x) => x.action === 'update').length} update, ${ALL.filter((x) => x.action === 'deactivate').length} deactivate)`)

const ids = ALL.map((x) => x.id)
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupIds.length) { console.error('DUPLICATE ids in fix set:', dupIds); await c.end(); process.exit(1) }

const { rows: current } = await c.query('select * from questions where id::text = any($1)', [ids])
const byId = new Map(current.map((r) => [r.id, r]))
const missing = ids.filter((id) => !byId.has(id))
if (missing.length) { console.error('MISSING from DB:', missing); await c.end(); process.exit(1) }
console.log(`all ${ids.length} target ids verified present.`)

const FIELDS = ['question_text', 'question_text_ta', 'option_a', 'option_b', 'option_c', 'option_d',
  'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta', 'correct_answer', 'explanation', 'explanation_ta']

let errs = 0
for (const x of ALL) {
  const cur = byId.get(x.id)
  if (x.action === 'deactivate') continue
  const merged = { ...cur }
  for (const f of FIELDS) if (x[f] !== undefined) merged[f] = x[f]
  const letter = (merged.correct_answer || '').toUpperCase()
  const optKey = 'option_' + letter.toLowerCase()
  if (!['A', 'B', 'C', 'D'].includes(letter)) { console.error(`bad correct_answer for ${x.id}: ${merged.correct_answer}`); errs++; continue }
  if (!merged[optKey] || !String(merged[optKey]).trim()) { console.error(`FINAL option_${letter} is empty for ${x.id} after merge`); errs++ }
  const opts = ['option_a', 'option_b', 'option_c', 'option_d'].map((k) => (merged[k] || '').trim().toLowerCase())
  if (new Set(opts).size !== 4) { console.error(`non-distinct final options for ${x.id}:`, opts); errs++ }
}
if (errs) { console.error(`\n${errs} validation errors — aborting without writing.`); await c.end(); process.exit(1) }
console.log('all update entries validated against merged live data — correct_answer option non-empty & 4 distinct options.')

writeFileSync('_audit_apply_backup.json', JSON.stringify(current, null, 1))
console.log(`backed up ${current.length} original rows to server/_audit_apply_backup.json`)

if (!WRITE) { console.log('DRY RUN — no changes made. Re-run with --write to apply.'); await c.end(); process.exit(0) }

let updated = 0, deactivated = 0
for (const x of ALL) {
  if (x.action === 'deactivate') {
    const res = await c.query('update questions set active=false where id::text=$1', [x.id])
    deactivated += res.rowCount
    continue
  }
  const cur = byId.get(x.id)
  const merged = { ...cur }
  for (const f of FIELDS) if (x[f] !== undefined) merged[f] = x[f]
  const res = await c.query(
    `update questions set question_text=$1, question_text_ta=$2,
       option_a=$3, option_b=$4, option_c=$5, option_d=$6,
       option_a_ta=$7, option_b_ta=$8, option_c_ta=$9, option_d_ta=$10,
       correct_answer=$11, explanation=$12, explanation_ta=$13
     where id::text=$14`,
    [merged.question_text, merged.question_text_ta, merged.option_a, merged.option_b, merged.option_c, merged.option_d,
      merged.option_a_ta, merged.option_b_ta, merged.option_c_ta, merged.option_d_ta,
      merged.correct_answer, merged.explanation, merged.explanation_ta, x.id]
  )
  updated += res.rowCount
}
console.log(`updated rows: ${updated} | deactivated rows: ${deactivated}`)
await c.end()
