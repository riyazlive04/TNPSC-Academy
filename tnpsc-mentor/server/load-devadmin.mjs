import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'

/**
 * Development Administration (TN) refresh.
 *
 * Source: c:/Users/mas20/Desktop/work/TNPSC/Development_Administration_TN/topicNN_questions.json
 *         (15 topics, bilingual MCQ).
 *
 * Stored under category='subject', subject='Tamil Nadu Administration' (the
 * existing student Subject Practice slot), so it replaces the old bank in place.
 *
 * Steps (one transaction):
 *   1. Soft-disable the OLD bank: active=false on category='subject' /
 *      subject='Tamil Nadu Administration' rows that are NOT ours
 *      (external_id NOT LIKE 'sub-devadmin-%') — keeps them recoverable and
 *      makes this script idempotent (a re-run never disables the new rows).
 *   2. Delete any prior 'sub-devadmin-%' rows (idempotency).
 *   3. Insert the 448 new rows (active defaults true).
 *
 *   node load-devadmin.mjs           # dry-run: counts only
 *   APPLY=1 node load-devadmin.mjs   # write
 */

const SRC = 'c:/Users/mas20/Desktop/work/TNPSC/Development_Administration_TN'
const SUBJECT = 'Development Administration in Tamil Nadu' // new rows are stored under this subject
const OLD_SUBJECT = 'Tamil Nadu Administration'            // the prior bank to soft-disable
const APPLY = process.env.APPLY === '1'

// Clean, syllabus-aligned topic label per source file. Topics 1,3,7,8,9,11
// reuse the EXACT labels already in the DB / SUBJECT_TOPIC_ORDER for continuity.
const TOPIC = {
  1: 'Human Development Indicators',
  2: 'Impact of Social Reform Movements',
  3: 'Political Parties & Welfare Schemes',
  4: 'Reservation Policy & Access to Social Resources',
  5: 'Economic Trends in Tamil Nadu',
  6: 'Role & Impact of Social Welfare Schemes',
  7: 'Social Justice & Harmony',
  8: 'Education & Health Systems',
  9: 'Geography of TN & its Impact on Economic Growth',
  10: 'Achievements of Tamil Nadu',
  11: 'e-Governance in TN',
  12: 'Public Awareness & General Administration',
  13: 'Welfare-oriented Government Schemes',
  14: 'Problems in Public Delivery Systems',
  15: 'Current Socio-Economic Issues',
}

// source `type` -> DB question_type enum
const QTYPE = { direct: 'direct', statement: 'statements', statements: 'statements', match: 'match', assertion_reason: 'assertion_reason', chronological: 'chronological' }

const clean = (v) => (v == null ? null : String(v).trim() || null)

const rows = []
const perTopic = {}
const perType = {}
for (let i = 1; i <= 15; i++) {
  const nn = String(i).padStart(2, '0')
  const data = JSON.parse(readFileSync(`${SRC}/topic${nn}_questions.json`, 'utf8'))
  const qs = data.questions || []
  perTopic[TOPIC[i]] = qs.length
  qs.forEach((q, idx) => {
    const qtype = QTYPE[String(q.type || 'direct').toLowerCase()] || 'direct'
    perType[qtype] = (perType[qtype] || 0) + 1
    rows.push({
      category: 'subject',
      subject: SUBJECT,
      unit: SUBJECT,
      topic: TOPIC[i],
      question_type: qtype,
      external_id: `sub-devadmin-t${nn}-${String(idx).padStart(4, '0')}`,
      difficulty: 'medium',
      question_text: clean(q.question_text),
      option_a: clean(q.option_a),
      option_b: clean(q.option_b),
      option_c: clean(q.option_c),
      option_d: clean(q.option_d),
      correct_answer: (clean(q.correct_answer) || 'A').toUpperCase(),
      explanation: clean(q.explanation),
      question_text_ta: clean(q.question_text_ta),
      option_a_ta: clean(q.option_a_ta),
      option_b_ta: clean(q.option_b_ta),
      option_c_ta: clean(q.option_c_ta),
      option_d_ta: clean(q.option_d_ta),
      explanation_ta: clean(q.explanation_ta),
    })
  })
}

console.log('Prepared rows:', rows.length)
console.table(Object.entries(perTopic).map(([topic, n]) => ({ topic, n })))
console.log('By question_type:', JSON.stringify(perType))
// sanity: any missing required fields?
const bad = rows.filter((r) => !r.question_text || !r.option_a || !r.option_b || !r.correct_answer || !'ABCD'.includes(r.correct_answer))
console.log('Rows with missing/odd required fields:', bad.length)
const noTa = rows.filter((r) => !r.question_text_ta).length
console.log('Rows missing Tamil question text:', noTa)

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to write.')
  process.exit(0)
}

const c = new Client({ host: process.env.SUPABASE_DB_HOST, port: +process.env.SUPABASE_DB_PORT, user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD, database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false }, statement_timeout: 300000 })
await c.connect()
console.log('Connected.')

const COLS = [
  'category', 'subject', 'unit', 'topic', 'question_type', 'external_id', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta', 'explanation_ta',
]

try {
  await c.query('begin')

  const dis = await c.query(
    `update questions set active=false
       where category='subject' and subject=$1
         and active=true and external_id not like 'sub-devadmin-%'`,
    [OLD_SUBJECT]
  )
  console.log(`Disabled ${dis.rowCount} pre-existing rows.`)

  const ids = rows.map((r) => r.external_id)
  const del = await c.query(`delete from questions where external_id = any($1::text[])`, [ids])
  console.log(`Removed ${del.rowCount} prior sub-devadmin rows (idempotency).`)

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const values = []
    const params = []
    let p = 1
    for (const r of batch) {
      const ph = COLS.map((col) => { params.push(r[col]); return `$${p++}` })
      values.push(`(${ph.join(',')})`)
    }
    const res = await c.query(`insert into questions (${COLS.join(',')}) values ${values.join(',')}`, params)
    inserted += res.rowCount
  }
  console.log(`Inserted ${inserted} new rows.`)

  await c.query('commit')
  console.log('COMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.log('\n--- post-state: Tamil Nadu Administration ---')
console.table((await c.query(
  `select topic, count(*)::int n, sum((active)::int)::int active_n
     from questions where category='subject' and subject=$1 group by topic order by topic`,
  [SUBJECT]
)).rows)
await c.end()
