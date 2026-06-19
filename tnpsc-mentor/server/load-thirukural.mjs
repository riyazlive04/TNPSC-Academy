import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Loads the 1330 Thirukkural couplets into a dedicated `public.thirukural` table.
 *
 * Source: the original Thirukural/thirukkural_bilingual.json at the repo root.
 * The `public.thirukural` table is now the live source the app reads from (via
 * GET /api/thirukural) — read-only reference content, one row per kural, keyed
 * on kural_no. Re-run this only to (re)seed or refresh the table.
 *
 * Creates the table + a public-read RLS policy if missing, then upserts every
 * row. Fully idempotent (insert ... on conflict (kural_no) do update). DDL +
 * data go through the direct pg pooler (service-role REST can't run DDL).
 *
 *   node load-thirukural.mjs           # dry-run: report only, no writes
 *   APPLY=1 node load-thirukural.mjs   # create table + upsert all rows
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.env.APPLY === '1'

const JSON_PATH = join(__dirname, '..', '..', '..', 'Thirukural', 'thirukkural_bilingual.json')
const rows = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
console.log(`Loaded ${rows.length} kurals from ${JSON_PATH}`)
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

// Column order used for both DDL and the parameterised INSERT.
const COLS = [
  'kural_no', 'paal_no', 'paal_ta', 'paal_en',
  'iyal_no', 'iyal_ta', 'iyal_en',
  'adhigaram_no', 'adhigaram_ta', 'adhigaram_en', 'adhigaram_translit',
  'line1_ta', 'line2_ta',
  'transliteration', 'couplet_en', 'translation_en', 'explanation_en',
  'urai_mu_varadarajan', 'urai_solomon_pappaiya', 'urai_mu_karunanidhi',
]

const DDL = `
  create table if not exists public.thirukural (
    kural_no            int primary key,
    paal_no             int  not null,
    paal_ta             text,
    paal_en             text,
    iyal_no             int,
    iyal_ta             text,
    iyal_en             text,
    adhigaram_no        int  not null,
    adhigaram_ta        text,
    adhigaram_en        text,
    adhigaram_translit  text,
    line1_ta            text,
    line2_ta            text,
    transliteration     text,
    couplet_en          text,
    translation_en      text,
    explanation_en      text,
    urai_mu_varadarajan text,
    urai_solomon_pappaiya text,
    urai_mu_karunanidhi text
  );
  create index if not exists thirukural_adhigaram_idx on public.thirukural (adhigaram_no);
  create index if not exists thirukural_paal_idx on public.thirukural (paal_no);

  -- Read-only reference content: anyone (incl. anon) may select; no writes.
  alter table public.thirukural enable row level security;
  drop policy if exists thirukural_read on public.thirukural;
  create policy thirukural_read on public.thirukural for select using (true);
`

if (!APPLY) {
  console.log('\nDRY-RUN only — no DB connection made. Re-run with APPLY=1 to write.')
  console.log('Sample row:', JSON.stringify(rows[0], null, 2).slice(0, 400))
  process.exit(0)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  statement_timeout: 120000,
})
await c.connect()
console.log('Connected.')

try {
  await c.query(DDL)
  console.log('Table + policy ready.')

  await c.query('begin')

  // Batched multi-row upsert. 20 cols × 200 rows = 4000 params, well under the
  // 65535 bind-parameter ceiling.
  const BATCH = 200
  const updateSet = COLS.filter((c) => c !== 'kural_no')
    .map((col) => `${col}=excluded.${col}`)
    .join(', ')
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const values = []
    const tuples = slice.map((r, j) => {
      const base = j * COLS.length
      COLS.forEach((col) => values.push(r[col] ?? null))
      return `(${COLS.map((_, k) => `$${base + k + 1}`).join(',')})`
    })
    const sql =
      `insert into public.thirukural (${COLS.join(',')}) values ${tuples.join(',')} ` +
      `on conflict (kural_no) do update set ${updateSet}`
    const res = await c.query(sql, values)
    inserted += res.rowCount
    process.stdout.write(`  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`)
  }
  await c.query('commit')
  console.log(`\nCOMMIT ok. ${inserted} rows upserted.`)
} catch (e) {
  await c.query('rollback').catch(() => {})
  console.error('\nROLLBACK —', e.message)
  await c.end()
  process.exit(1)
}

const { rows: summary } = await c.query(
  `select paal_no, paal_en, count(*)::int n from public.thirukural group by paal_no, paal_en order by paal_no`
)
console.table(summary)
const { rows: total } = await c.query(`select count(*)::int total from public.thirukural`)
console.log('Total rows in table:', total[0].total)
await c.end()
