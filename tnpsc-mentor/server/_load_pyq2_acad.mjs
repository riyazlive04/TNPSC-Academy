/**
 * Loader for hand-authored ACADEMIC (non-aptitude) Group-2 (pyq2) explanations.
 * Same shape as _load_pyq_acad but guarded on category='pyq2'.
 *   [{ id, explanation, explanation_ta, why_wrong:{A,B,C,D}, why_wrong_ta:{A,B,C,D} }]
 *   node _load_pyq2_acad.mjs batch.json           # dry run
 *   node _load_pyq2_acad.mjs batch.json --write    # apply
 */
import 'dotenv/config'
import { Client } from 'pg'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const WRITE = process.argv.includes('--write')
if (!file) { console.error('usage: node _load_pyq2_acad.mjs <batch.(mjs|json)> [--write]'); process.exit(2) }
const rows = file.endsWith('.json')
  ? JSON.parse(readFileSync(file, 'utf8'))
  : (await import(pathToFileURL(file).href)).default

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

let ok = 0, bad = 0, skipped = 0
for (const r of rows) {
  if (r.flagged) { skipped++; continue }
  if (!r.id || !r.explanation || !r.explanation_ta) { console.error('  skip (missing field):', r.id); bad++; continue }
  if (!WRITE) { ok++; continue }
  const res = await c.query(
    `update questions set explanation=$1, explanation_ta=$2,
            why_wrong=$3::jsonb, why_wrong_ta=$4::jsonb, expl_status='generated'
      where id=$5 and category='pyq2'`,
    [r.explanation, r.explanation_ta,
     r.why_wrong ? JSON.stringify(r.why_wrong) : null,
     r.why_wrong_ta ? JSON.stringify(r.why_wrong_ta) : null, r.id])
  if (res.rowCount === 1) ok++; else { console.error('  no-match id:', r.id); bad++ }
}
console.log(`${WRITE ? 'WROTE' : 'DRY'}: ${ok} ok, ${bad} bad, ${skipped} flagged/skipped, of ${rows.length}`)
await c.end()
