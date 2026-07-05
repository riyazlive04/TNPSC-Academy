import { Client } from 'pg'
import { existsSync, readFileSync } from 'node:fs'

// ─── Vettri Nichayam bank loader ─────────────────────────────────────────────
// Loads the 13 "Vettri Nichayam" mock exams (category='vettri', vettri_set 1..13)
// from one JSON file per exam. Content lives outside the app repo. Files that
// don't exist yet are skipped, so you can load exams as they're written.
//
//   Run:  node --env-file=.env load-vettri-exams.mjs [dir]
//   dir defaults to the path below; each file is <dir>/vettri<N>.json (N=1..13).
//
// After inserting, each exam's `total_questions` in vettri_exams is set to the
// actual loaded count. Enabling an exam is left to the superadmin console (it
// refuses to enable an exam with 0 questions loaded). See VETTRI_EXAM_FORMAT.md
// for the per-question JSON shape (identical to the mock-exam format).

const DIR = process.argv[2] ?? 'c:/Users/mas20/Desktop/work/TNPSC/vettri_tests'
const SETS = Array.from({ length: 13 }, (_, i) => i + 1) // 1..13

// Flatten every present file into one array, stamping vettri_set from the index.
const present = []
const data = SETS.flatMap((n) => {
  const path = `${DIR}/vettri${n}.json`
  if (!existsSync(path)) return []
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(rows) || rows.length === 0) return []
  present.push(n)
  return rows.map((r) => ({ ...r, vettri_set: n }))
})

if (data.length === 0) {
  console.error(
    `No exam files found in ${DIR} (expected vettri1.json .. vettri13.json). Nothing to load.`
  )
  process.exit(1)
}

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
console.log(
  `Connected. Loading ${data.length} vettri questions (sets ${present.join(', ')})...`
)

const before = (
  await client.query(`select count(*)::int n from questions where category='vettri'`)
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: only reload the sets present in this run (delete their prior rows
  // by vettri_set), so re-running one file doesn't touch the others.
  const del = await client.query(
    `delete from questions where category='vettri' and vettri_set = any($1::int[])`,
    [present]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows for these sets`)

  const ins = await client.query(
    `
    insert into questions (
      category, vettri_set, external_id, unit, subject, topic, difficulty,
      question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, why_wrong, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta, why_wrong_ta
    )
    select
      'vettri',
      (e->>'vettri_set')::int,
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

  // Sync each loaded exam's total_questions to the actual count so the console +
  // student header show the right number.
  await client.query(
    `
    update vettri_exams v
    set total_questions = c.n, updated_at = now()
    from (
      select vettri_set, count(*)::int n from questions
      where category='vettri' and vettri_set = any($1::int[])
      group by vettri_set
    ) c
    where v.vettri_set = c.vettri_set
    `,
    [present]
  )

  await client.query('commit')
} catch (e) {
  await client.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}

const after = (
  await client.query(`select count(*)::int n from questions where category='vettri'`)
).rows[0].n
const perSet = (
  await client.query(
    `select vettri_set, count(*)::int n from questions where category='vettri'
     group by vettri_set order by vettri_set`
  )
).rows

console.log(`\nvettri rows: ${before} -> ${after}`)
console.log('per set:', perSet.map((r) => `set${r.vettri_set}=${r.n}`).join('  '))
console.log('\nNext: enable each loaded exam from Superadmin → Vettri.')
await client.end()
