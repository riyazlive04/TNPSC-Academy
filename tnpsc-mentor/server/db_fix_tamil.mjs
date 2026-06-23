import 'dotenv/config'
import { Client } from 'pg'

/**
 * Applies the SAME mechanical Tamil spelling normalizations that were made to
 * the rewritten/*.json source files, directly to the live DB (questions table,
 * category='subject'). Mirrors tamil_fix_mechanical.py.
 *
 * Postgres regex has no lookbehind, so the இ-prefix rules use an idempotent
 * `இ?` optional-consume (regexp_replace 'இ?X' -> 'இX'): already-correct forms
 * map to themselves, bare forms get the இ. All rules are idempotent.
 *
 *   node db_fix_tamil.mjs           # DRY-RUN: rows that WOULD change, per rule
 *   APPLY=1 node db_fix_tamil.mjs   # apply UPDATEs
 */
const APPLY = process.env.APPLY === '1'

const BLOB = `(coalesce(question_text_ta,'')||coalesce(option_a_ta,'')||coalesce(option_b_ta,'')||`
  + `coalesce(option_c_ta,'')||coalesce(option_d_ta,'')||coalesce(explanation_ta,'')||`
  + `coalesce(why_wrong_ta::text,''))`
const TXT = ['question_text_ta','option_a_ta','option_b_ta','option_c_ta','option_d_ta','explanation_ta']

// regex rules: [label, search(for replace), replacement, whereRegex(rows needing change)]
const REGEX = [
  ['Rajasthan இ-prefix',      'இ?ராஜஸ்தான', 'இராஜஸ்தான', '(^|[^இ])ராஜஸ்தான'],
  ['Ramanathapuram இ-prefix', 'இ?ராமநாதபுர', 'இராமநாதபுர', '(^|[^இ])ராமநாதபுர'],
]
// literal rules: [label, avoid, use]
const LIT = [
  ['Uttarakhand காண்ட',  'உத்தராகண்ட', 'உத்தராகாண்ட'],
  ['Himachal இமாச்சல',    'இமாசல',      'இமாச்சல'],
  ['Naoroji நெள',         'நௌரோஜி',     'நெளரோஜி'],
  ['Gandhi Sagar 1word',  'காந்தி சாகர','காந்திசாகர'],
  ['Olive Ridley ரெட்லி', 'ஆலிவ் ரிட்லி','ஆலிவ் ரெட்லி'],
  ['Assam அசாம',          'அஸ்ஸாம',     'அசாம'],
  ['Bihar பீகார',         'பிஹார',      'பீகார'],
  ['Kotagiri',            'கோத்தகிரி',  'கோத்திகிரி'],
  ['Gingee செஞ்சி',       'ஜிஞ்சி',     'செஞ்சி'],
]

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})
await c.connect()
console.log(`Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

const tot = (await c.query(`select count(*)::int n from questions where category='subject'`)).rows[0].n
console.log(`category='subject' rows: ${tot}\n`)

const Q = (s) => `'${s.replace(/'/g, "''")}'`  // safe literal (no quotes in our strings)
let grand = 0
async function run(label, whereExpr, setSql) {
  if (!APPLY) {
    const n = (await c.query(`select count(*)::int n from questions where category='subject' and ${whereExpr}`)).rows[0].n
    console.log(`  [DRY] ${label.padEnd(24)} ${n} rows match`)
    grand += n
    return
  }
  const r = await c.query(`update questions set ${setSql} where category='subject' and ${whereExpr}`)
  console.log(`  [UPD] ${label.padEnd(24)} ${r.rowCount} rows updated`)
  grand += r.rowCount
}

try {
  for (const [label, search, repl, whereRe] of REGEX) {
    const set = TXT.map(col => `${col}=regexp_replace(${col}, ${Q(search)}, ${Q(repl)}, 'g')`).join(', ')
      + `, why_wrong_ta=case when why_wrong_ta is null then null else regexp_replace(why_wrong_ta::text,${Q(search)},${Q(repl)},'g')::jsonb end`
    await run(label, `${BLOB} ~ ${Q(whereRe)}`, set)
  }
  for (const [label, avoid, use] of LIT) {
    const set = TXT.map(col => `${col}=replace(${col}, ${Q(avoid)}, ${Q(use)})`).join(', ')
      + `, why_wrong_ta=case when why_wrong_ta is null then null else replace(why_wrong_ta::text,${Q(avoid)},${Q(use)})::jsonb end`
    await run(label, `position(${Q(avoid)} in ${BLOB}) > 0`, set)
  }
} finally {
  await c.end()
}
console.log(`\n${APPLY ? 'Updated' : 'Would update'} ~${grand} row-rule matches (rows may overlap across rules).`)
