/**
 * Loader for hand-authored aptitude explanations.
 * Accepts either a JSON file or an .mjs module that default-exports the array
 * [{ id, explanation, explanation_ta }, ...]. (.mjs lets us author LaTeX with
 * String.raw`...` so backslashes/newlines stay literal — no escaping.)
 * Writes explanation + explanation_ta, clears option_explanations (book style),
 * sets expl_status='generated'. UPDATE-by-id (preserves user history).
 *
 *   node _load_apt_expl.mjs path/to/batch.mjs           # dry run (counts only)
 *   node _load_apt_expl.mjs path/to/batch.mjs --write    # apply
 */
import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const file = process.argv[2]
const WRITE = process.argv.includes('--write')
if (!file) { console.error('usage: node _load_apt_expl.mjs <batch.(mjs|json)> [--write]'); process.exit(2) }
const rows = file.endsWith('.mjs')
  ? (await import(pathToFileURL(file).href)).default
  : JSON.parse(readFileSync(file, 'utf8'))

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

let ok = 0, bad = 0
for (const r of rows) {
  if (!r.id || !r.explanation || !r.explanation_ta) { console.error('  skip (missing field):', r.id); bad++; continue }
  if (!WRITE) { ok++; continue }
  const res = await c.query(
    `update questions set explanation=$1, explanation_ta=$2, option_explanations=null,
            expl_status='generated' where id=$3 and category='pyq' and subject='Aptitude'`,
    [r.explanation, r.explanation_ta, r.id])
  if (res.rowCount === 1) ok++; else { console.error('  no-match id:', r.id); bad++ }
}
console.log(`${WRITE ? 'WROTE' : 'DRY'}: ${ok} ok, ${bad} bad, of ${rows.length}`)
await c.end()
