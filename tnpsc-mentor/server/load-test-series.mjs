import { Client } from 'pg'
import { readFileSync } from 'node:fs'

// The 13 pre-built scheduled Test Series papers (Group 1 "Test Marathon 2026")
// live outside the app repo. Tests 1-10 are 100-Q sectional papers, Tests 11-13
// are 200-Q full mocks. Each Test_NN.json is an array of question objects.
const DIR = 'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/mock_tests/group1_papers/test series'
const FILES = Array.from({ length: 13 }, (_, i) => `Test_${String(i + 1).padStart(2, '0')}`)

// Flatten all files into one array, stamping test_set from the file index so each
// question is linked to its test regardless of what the source JSON carries.
const data = FILES.flatMap((name, i) => {
  const rows = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'))
  return rows.map((r) => ({ ...r, test_set: i + 1 }))
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
console.log(`Connected. Loading ${data.length} test-series questions (${FILES.length} tests)...`)

const before = (
  await client.query(`select count(*)::int n from questions where category='testseries'`)
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: remove any prior load of these exact external_ids first.
  const ids = data.map((d) => d.external_id).filter(Boolean)
  const del = await client.query(
    `delete from questions where category='testseries' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows with same external_id`)

  // Bulk insert via jsonb_array_elements -> typed columns. `part`/`paper_no` are
  // dropped (no column); `unit` is kept. why_wrong/why_wrong_ta: null/{} -> NULL.
  const ins = await client.query(
    `
    insert into questions (
      category, test_set, external_id, unit, subject, topic, difficulty,
      question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, why_wrong, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta, why_wrong_ta
    )
    select
      'testseries',
      (e->>'test_set')::int,
      nullif(e->>'external_id',''),
      nullif(e->>'unit',''),
      nullif(e->>'subject',''),
      nullif(e->>'topic',''),
      -- Clamp to the DB's difficulty scale (easy/medium/hard). Source papers use
      -- a stray 'high' for a few rows → map to 'hard'; anything unknown → medium.
      case lower(coalesce(e->>'difficulty',''))
        when 'easy' then 'easy'
        when 'medium' then 'medium'
        when 'hard' then 'hard'
        when 'high' then 'hard'
        when 'very tough' then 'hard'
        when 'tough' then 'hard'
        else 'medium'
      end,
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      case when e->'why_wrong' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong' is null
           then null else e->'why_wrong' end,
      'tnpsc-official',
      nullif(e->>'question_text_ta',''),
      nullif(e->>'option_a_ta',''), nullif(e->>'option_b_ta',''),
      nullif(e->>'option_c_ta',''), nullif(e->>'option_d_ta',''),
      nullif(e->>'explanation_ta',''),
      case when e->'why_wrong_ta' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong_ta' is null
           then null else e->'why_wrong_ta' end
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
  await client.query(`select count(*)::int n from questions where category='testseries'`)
).rows[0].n
const bySet = (
  await client.query(
    `select test_set, count(*)::int n from questions where category='testseries'
     group by test_set order by test_set`
  )
).rows
console.log(`Done. category='testseries' rows: ${before} -> ${after}`)
console.table(bySet)

await client.end()
