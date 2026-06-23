import 'dotenv/config'
import { Client } from 'pg'

/**
 * Applies the 15 'debatable term-choice' fixes to the live DB (questions,
 * category='subject'), mirroring tamil_fix_debatable.py. Only _ta columns are
 * touched (English columns keep English 'UNICEF').
 *
 * Guards (Postgres has no lookbehind, so use captured-group backrefs):
 *   - செஸ்  -> சதுரங்க  only when space-preceded   '(\s)செஸ்' -> '\1சதுரங்க'
 *   - UNICEF -> யுனிசெஃப் only when NOT after '('   '([^(])UNICEF' -> '\1யுனிசெஃப்'
 * CA-only terms naturally match 0 subject rows.
 *
 *   node db_fix_tamil_debatable.mjs           # DRY-RUN
 *   APPLY=1 node db_fix_tamil_debatable.mjs   # apply
 */
const APPLY = process.env.APPLY === '1'
const BLOB = `(coalesce(question_text_ta,'')||coalesce(option_a_ta,'')||coalesce(option_b_ta,'')||`
  + `coalesce(option_c_ta,'')||coalesce(option_d_ta,'')||coalesce(explanation_ta,'')||`
  + `coalesce(why_wrong_ta::text,''))`
const TXT = ['question_text_ta','option_a_ta','option_b_ta','option_c_ta','option_d_ta','explanation_ta']

// [label, searchRegex, replacement(with backref), whereRegex]
// NOTE: UNICEF rule deliberately omitted — the only subject-row match was a
// UN-organisations-by-founding-year list (UNICEF/WHO/WTO/UNDP as acronyms),
// where converting only UNICEF would be inconsistent. False positive.
const REGEX = [
  ['Chess செஸ்(space)',  '(\\s)செஸ்',     '\\1சதுரங்க',   '\\sசெஸ்'],
]
// [label, avoid, use]
const LIT = [
  ['Operation Vijay',    'ஆபரேஷன் விஜய்',          'விஜய் நடவடிக்கை'],
  ['Aravalli',           'அரவல்லி',                 'ஆரவல்லி'],
  ['World Statistics',   'உலக புள்ளியியல் தினம்',    'உலகப் புள்ளி விவரங்கள் தினம்'],
  ['Aqua Tech Park',     'அக்வா டெக் பார்க்',        'நீர்சார் தொழில்நுட்பப் பூங்கா'],
  ['Chagas Day',         'உலக சாகஸ் நோய் தினம்',     'உலக இரத்த ஒட்டுண்ணி நோய் தினம்'],
  ['Civil Services Day', 'சிவில் சேவைகள் தினம்',     'குடிமைப் பணிகள் தினம்'],
  ['UAE',                'ஐக்கிய அரபு எமிரேட்ஸ்',    'ஐக்கிய அரபு அமீரகம்'],
  ['Green TN Mission',   'பசுமைத் தமிழ்நாடு இயக்கம்', 'பசுமைத் தமிழ்நாடு திட்டம்'],
  ['IRENA',              'ஆற்றல் முகமை (IRENA)',     'எரிசக்தி முகமை (IRENA)'],
  ['Palk Strait',        'பாக் நீரிணை',              'பாக் ஜலசந்தி'],
  ['Bangladesh',         'பங்களாதேஷ்',               'வங்காளதேச'],
  ['IUCN Red List',      'IUCN சிவப்புப் பட்டியலில்', 'IUCN அமைப்பின் செந்நிறப் பட்டியலில்'],
  ['Blackbuck',          'வெளிமான்',                 'கலைமான்'],
]

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false }, statement_timeout: 300000,
})
await c.connect()
console.log(`Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

const Q = (s) => `'${s.replace(/'/g, "''")}'`
let grand = 0
async function run(label, whereExpr, setSql) {
  if (!APPLY) {
    const n = (await c.query(`select count(*)::int n from questions where category='subject' and ${whereExpr}`)).rows[0].n
    console.log(`  [DRY] ${label.padEnd(20)} ${n} rows match`)
    grand += n; return
  }
  const r = await c.query(`update questions set ${setSql} where category='subject' and ${whereExpr}`)
  console.log(`  [UPD] ${label.padEnd(20)} ${r.rowCount} rows updated`); grand += r.rowCount
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
} finally { await c.end() }
console.log(`\n${APPLY ? 'Updated' : 'Would update'} ~${grand} row-rule matches (rows may overlap).`)
