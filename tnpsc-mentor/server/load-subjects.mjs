import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Loads the rewritten Subject Practice bank into the live DB.
 *
 *   rewritten/<subject>/<type>.json  (13 academic subjects × 5 type files)
 *
 * Stored under category='subject', drilled by subject -> topic -> question_type
 * (chronological / match / assertion_reason / statements / direct).
 *
 * NOTE: rewritten/current_affairs is intentionally NOT loaded — the live
 * curated Current Affairs bank is kept as-is.
 *
 * Idempotent by external_id. Safe dry-run by default; APPLY=1 to write.
 *   node load-subjects.mjs           # dry-run: counts only
 *   APPLY=1 node load-subjects.mjs   # insert
 */

const ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/rewritten'
const APPLY = process.env.APPLY === '1'

// folder -> question_type value stored in the DB
const TYPE = {
  chronological: 'chronological',
  match_the_following: 'match',
  assertion_reason: 'assertion_reason',
  statements: 'statements',
  direct: 'direct',
}
// folder -> display subject name (academic subjects only; current_affairs excluded)
const SUBJECT = {
  // Botany + Zoology are merged into a single 'Biology' subject (the TNPSC GS
  // Life-Science unit is taught as one biology paper). Their source folders stay
  // separate; both load under subject='Biology'.
  botany: 'Biology',
  chemistry: 'Chemistry',
  economy: 'Economy',
  english: 'English',
  geography: 'Geography',
  history: 'History',
  history_culture_heritage: 'History, Culture & Heritage of TN',
  indian_national_movement: 'Indian National Movement',
  physics: 'Physics',
  polity: 'Polity',
  tamil: 'Tamil',
  tamil_nadu_administration: 'Tamil Nadu Administration',
  zoology: 'Biology',
}
const DIFF = { low: 'easy', medium: 'medium', high: 'hard' }
const clean = (v) => (v == null ? null : String(v).trim() || null)
const diff = (d) => DIFF[String(d || '').toLowerCase()] ?? 'medium'

const rows = []
function pushFile(folder, typeFile) {
  const path = `${ROOT}/${folder}/${typeFile}.json`
  if (!existsSync(path)) return 0
  let arr
  try {
    arr = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`  ! parse error ${folder}/${typeFile}:`, e.message)
    return 0
  }
  const qtype = TYPE[typeFile]
  arr.forEach((q, i) => {
    rows.push({
      category: 'subject',
      subject: SUBJECT[folder],
      unit: clean(q.unit),
      topic: clean(q.topic),
      question_type: qtype,
      external_id: `sub-${folder}-${qtype}-${String(i).padStart(4, '0')}`,
      difficulty: diff(q.difficulty),
      question_text: clean(q.question_text),
      option_a: clean(q.option_a),
      option_b: clean(q.option_b),
      option_c: clean(q.option_c),
      option_d: clean(q.option_d),
      correct_answer: (clean(q.correct_answer) || 'A').toUpperCase(),
      explanation: clean(q.explanation),
      why_wrong: q.why_wrong && Object.keys(q.why_wrong).length ? q.why_wrong : null,
      question_text_ta: clean(q.question_text_ta),
      option_a_ta: clean(q.option_a_ta),
      option_b_ta: clean(q.option_b_ta),
      option_c_ta: clean(q.option_c_ta),
      option_d_ta: clean(q.option_d_ta),
      explanation_ta: clean(q.explanation_ta),
      why_wrong_ta: q.why_wrong_ta && Object.keys(q.why_wrong_ta).length ? q.why_wrong_ta : null,
    })
  })
  return arr.length
}

const summary = {}
for (const folder of Object.keys(SUBJECT)) {
  let n = 0
  for (const tf of Object.keys(TYPE)) n += pushFile(folder, tf)
  summary[folder] = n
}
console.table(summary)
console.log(`Total rows prepared: ${rows.length}  | Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to insert.')
  process.exit(0)
}

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
console.log('Connected.')

const COLS = [
  'category', 'subject', 'unit', 'topic', 'question_type', 'external_id', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'why_wrong',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'explanation_ta', 'why_wrong_ta',
]
const JSONB = new Set(['why_wrong', 'why_wrong_ta'])

try {
  await c.query('begin')
  const ids = rows.map((r) => r.external_id)
  const del = await c.query(
    `delete from questions where category='subject' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`Removed ${del.rowCount} pre-existing subject rows with same external_id.`)

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const values = []
    const params = []
    let p = 1
    for (const r of batch) {
      const ph = COLS.map((col) => {
        params.push(JSONB.has(col) ? (r[col] == null ? null : JSON.stringify(r[col])) : r[col])
        return JSONB.has(col) ? `$${p++}::jsonb` : `$${p++}`
      })
      values.push(`(${ph.join(',')})`)
    }
    const sql = `insert into questions (${COLS.join(',')}) values ${values.join(',')}`
    const res = await c.query(sql, params)
    inserted += res.rowCount
    process.stdout.write(`\r  inserted ${inserted}/${rows.length}`)
  }
  console.log('')
  await c.query('commit')
  console.log('COMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.table(
  (await c.query(`select category, count(*)::int n from questions group by category order by category`)).rows
)
console.table(
  (await c.query(`select subject, count(*)::int n from questions where category='subject' group by subject order by subject`)).rows
)
await c.end()
