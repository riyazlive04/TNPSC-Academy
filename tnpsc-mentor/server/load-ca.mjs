import { Client } from 'pg'
import { readFileSync } from 'node:fs'

const MERGED = 'c:/Users/mas20/Desktop/work/TNPSC/Current_affairs_10Months/merged_ca.json'
const data = JSON.parse(readFileSync(MERGED, 'utf8'))

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
console.log(`Connected. Loading ${data.length} merged CA questions...`)

const before = (
  await client.query(
    `select count(*)::int n from questions where category='current_affairs'`
  )
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: remove any prior load of these exact external_ids first.
  const ids = data.map((d) => d.external_id).filter(Boolean)
  const del = await client.query(
    `delete from questions where category='current_affairs' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows with same external_id`)

  // Bulk insert via jsonb_array_elements -> typed columns.
  const ins = await client.query(
    `
    insert into questions (
      category, ca_type, ca_month, ca_year, ca_topic, topic, question_type,
      external_id, question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, difficulty, source_url, why_wrong,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta
    )
    select
      e->>'category',
      nullif(e->>'ca_type',''),
      nullif(e->>'ca_month',''),
      nullif(e->>'ca_year','')::int,
      nullif(e->>'ca_topic',''),
      nullif(e->>'topic',''),
      nullif(e->>'question_type',''),
      nullif(e->>'external_id',''),
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      coalesce(nullif(e->>'difficulty',''),'medium'),
      coalesce(nullif(e->>'source_url',''),'tnpsc-official'),
      case when e->'why_wrong' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong' is null
           then null else e->'why_wrong' end,
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
} catch (e) {
  await client.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}

const after = (
  await client.query(
    `select count(*)::int n from questions where category='current_affairs'`
  )
).rows[0].n
const official = (
  await client.query(
    `select count(*)::int n from questions where category='current_affairs' and source_url='tnpsc-official'`
  )
).rows[0].n

console.log(`\nCA rows: ${before} -> ${after}  (tnpsc-official: ${official})`)
await client.end()
