/**
 * Loader for the topic-wise APTITUDE BANK KaTeX-upgraded worked solutions.
 * Writes explanation + explanation_ta, clears option_explanations, sets
 * expl_status='generated'. UPDATE-by-id, guarded on category='aptitude'.
 * Skips flagged items.
 *   node _load_aptbank.mjs batch.(mjs|json)           # dry run
 *   node _load_aptbank.mjs batch.(mjs|json) --write    # apply
 */
import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const file = process.argv[2]
const WRITE = process.argv.includes('--write')
if (!file) { console.error('usage: node _load_aptbank.mjs <batch.(mjs|json)> [--write]'); process.exit(2) }
const rows = file.endsWith('.mjs')
  ? (await import(pathToFileURL(file).href)).default
  : JSON.parse(readFileSync(file, 'utf8'))

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
    `update questions set explanation=$1, explanation_ta=$2, option_explanations=null,
            expl_status='generated' where id=$3 and category='aptitude'`,
    [r.explanation, r.explanation_ta, r.id])
  if (res.rowCount === 1) ok++; else { console.error('  no-match id:', r.id); bad++ }
}
console.log(`${WRITE ? 'WROTE' : 'DRY'}: ${ok} ok, ${bad} bad, ${skipped} flagged/skipped, of ${rows.length}`)
await c.end()
