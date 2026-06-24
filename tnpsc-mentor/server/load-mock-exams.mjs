import { Client } from 'pg'
import { readFileSync } from 'node:fs'

// The 6 pre-built full mock exams (200 Q each) live outside the app repo.
const DIR = 'c:/Users/mas20/Desktop/work/TNPSC/mock_tests'
const FILES = ['exam1', 'exam2', 'exam3', 'exam4', 'exam5', 'exam6']

// Flatten all six files into one array, stamping mock_set from the file index so
// each question is linked to its exam regardless of what the source JSON carries.
const data = FILES.flatMap((name, i) => {
  const rows = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'))
  return rows.map((r) => ({ ...r, mock_set: i + 1 }))
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
console.log(`Connected. Loading ${data.length} mock-exam questions (${FILES.length} sets)...`)

const before = (
  await client.query(`select count(*)::int n from questions where category='mock'`)
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: remove any prior load of these exact external_ids first.
  const ids = data.map((d) => d.external_id).filter(Boolean)
  const del = await client.query(
    `delete from questions where category='mock' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows with same external_id`)

  // Bulk insert via jsonb_array_elements -> typed columns. `part` is dropped (no
  // column); `unit` is kept. why_wrong / why_wrong_ta: treat null/{} as NULL.
  const ins = await client.query(
    `
    insert into questions (
      category, mock_set, external_id, unit, subject, topic, difficulty,
      question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, why_wrong, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta, why_wrong_ta
    )
    select
      'mock',
      (e->>'mock_set')::int,
      nullif(e->>'external_id',''),
      nullif(e->>'unit',''),
      nullif(e->>'subject',''),
      nullif(e->>'topic',''),
      coalesce(nullif(e->>'difficulty',''),'hard'),
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
} catch (e) {
  await client.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}

const after = (
  await client.query(`select count(*)::int n from questions where category='mock'`)
).rows[0].n
const perSet = (
  await client.query(
    `select mock_set, count(*)::int n from questions where category='mock'
     group by mock_set order by mock_set`
  )
).rows

console.log(`\nmock rows: ${before} -> ${after}`)
console.log('per set:', perSet.map((r) => `set${r.mock_set}=${r.n}`).join('  '))
await client.end()
