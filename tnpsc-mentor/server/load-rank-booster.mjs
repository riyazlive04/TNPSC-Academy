import { Client } from 'pg'
import { readFileSync } from 'node:fs'

// The 10 pre-built "Group II/IIA - Rank Booster" papers live outside the app
// repo, one folder per test with a single general_studies.json holding all 100
// questions (75 General Studies + 25 Aptitude/Reasoning per test — the real
// Group 2/2A prelim blueprint). Source field names differ from the Group 1
// Marathon loader's shape (question_en/options_en/correct_answer_letter etc),
// so this loader remaps them in JS before the SQL insert (kept close to a
// straight passthrough; see the field-mapping note in supabase/rank_booster.sql).
const DIR = 'c:/Users/mas20/Desktop/work/parser/Group2/tests'
const FILES = Array.from({ length: 10 }, (_, i) => `test${String(i + 1).padStart(2, '0')}`)

/** Best-effort aptitude_type tag (numerics/reasoning/null) — NOT load-bearing:
 *  this bank is served only by test_set through /test-series, never filtered
 *  by aptitude_type. Kept for consistency/future reuse only. */
function aptitudeType(row) {
  const section = row.section
  const subject = row.subject
  if (section === 'Reasoning' || subject === 'Reasoning') return 'reasoning'
  if (section === 'Aptitude' || subject === 'Aptitude' || subject === 'Aptitude & Mental Ability')
    return 'numerics'
  return null
}

const data = FILES.flatMap((name, i) => {
  const testNo = i + 1
  const rows = JSON.parse(readFileSync(`${DIR}/${name}/general_studies.json`, 'utf8'))
  return rows.map((r) => ({
    external_id: `g2rb-t${String(testNo).padStart(2, '0')}-q${String(r.q_no).padStart(3, '0')}`,
    test_set: testNo,
    unit: r.topic || null, // source `topic` is the broader unit label
    subject: r.subject || null,
    topic: r.subject_concept || null, // source `subject_concept` is the fine-grained topic
    aptitude_type: aptitudeType(r),
    question_type: r.question_type || null,
    difficulty: r.difficulty || null,
    question_text: r.question_en,
    option_a: r.options_en?.A ?? '',
    option_b: r.options_en?.B ?? '',
    option_c: r.options_en?.C ?? '',
    option_d: r.options_en?.D ?? '',
    correct_answer: (r.correct_answer_letter || '').toUpperCase(),
    explanation: r.explanation_en || null,
    source_url: r.source_ref || null,
    question_text_ta: r.question_ta || null,
    option_a_ta: r.options_ta?.A ?? null,
    option_b_ta: r.options_ta?.B ?? null,
    option_c_ta: r.options_ta?.C ?? null,
    option_d_ta: r.options_ta?.D ?? null,
    explanation_ta: r.explanation_ta || null,
  }))
})

const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
})

await client.connect()
console.log(`Connected. Loading ${data.length} Rank Booster questions (${FILES.length} tests)...`)

const before = (
  await client.query(`select count(*)::int n from questions where category='testseries_g2'`)
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: remove any prior load of these exact external_ids first.
  const ids = data.map((d) => d.external_id).filter(Boolean)
  const del = await client.query(
    `delete from questions where category='testseries_g2' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows with same external_id`)

  const ins = await client.query(
    `
    insert into questions (
      category, test_set, external_id, unit, subject, topic, aptitude_type,
      question_type, difficulty,
      question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta
    )
    select
      'testseries_g2',
      (e->>'test_set')::int,
      nullif(e->>'external_id',''),
      nullif(e->>'unit',''),
      nullif(e->>'subject',''),
      nullif(e->>'topic',''),
      nullif(e->>'aptitude_type',''),
      nullif(e->>'question_type',''),
      -- Source difficulty is already easy/medium/hard; clamp defensively anyway.
      case lower(coalesce(e->>'difficulty',''))
        when 'easy' then 'easy'
        when 'medium' then 'medium'
        when 'hard' then 'hard'
        else 'medium'
      end,
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      nullif(e->>'source_url',''),
      nullif(e->>'question_text_ta',''),
      nullif(e->>'option_a_ta',''), nullif(e->>'option_b_ta',''),
      nullif(e->>'option_c_ta',''), nullif(e->>'option_d_ta',''),
      nullif(e->>'explanation_ta','')
    from jsonb_array_elements($1::jsonb) as e
    `,
    [JSON.stringify(data)]
  )
  console.log(`  inserted ${ins.rowCount} rows`)

  await client.query('commit')
} catch (err) {
  await client.query('rollback')
  console.error('FAILED, rolled back:', err.message)
  process.exit(1)
}

const after = (
  await client.query(`select count(*)::int n from questions where category='testseries_g2'`)
).rows[0].n
const bySet = (
  await client.query(
    `select test_set, count(*)::int n from questions where category='testseries_g2'
     group by test_set order by test_set`
  )
).rows
console.log(`Done. category='testseries_g2' rows: ${before} -> ${after}`)
console.table(bySet)

await client.end()
