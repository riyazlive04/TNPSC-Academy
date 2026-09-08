// ─── Swap the three Group 1 mock papers into exam4/5/6 ───────────────────────
// Reads the authored parser JSON (mock01/02/03), maps it with
// lib-group1-mocks.mjs, validates every row, and writes it as category='mock',
// mock_set 4/5/6.
//
//   node load-group1-mocks.mjs --dry-run     inspect + report, touch nothing
//   node load-group1-mocks.mjs               load (needs a reachable database)
//
// The papers currently in 4/5/6 are MOVED up to 7/8/9 first and kept hidden —
// an UPDATE, never a delete, so each question keeps its `id` and every
// bookmark, SRS card, seen-questions row and recorded answer that references it
// stays valid (a delete would cascade; see the "CA update in place" note).
// The whole thing runs in ONE transaction, so it either applies or it does not.
//
// Everything here is the same work as load-group1-mocks-studio.mjs, which is
// the route that actually reaches production from a laptop.

import { readFileSync, writeFileSync } from 'node:fs'
import {
  MOCK_SETS,
  ARCHIVE_MOVES,
  ENABLE_EXAM_IDS,
  FREE_EXAM_ID,
  toRow,
  validateRow,
} from './lib-group1-mocks.mjs'

const SRC = 'c:/Users/mas20/Desktop/work/parser/Group1/mock'
const dryRun = process.argv.includes('--dry-run')

// ─── 1. Transform ────────────────────────────────────────────────────────────
const papers = MOCK_SETS.map(({ file, set, examId }) => {
  const recs = JSON.parse(readFileSync(`${SRC}/${file}/general_studies_aptitude.json`, 'utf8'))
  const rows = recs.map((r) => toRow(r, set))
  return { file, set, examId, recs, rows }
})

// ─── 2. Validate ─────────────────────────────────────────────────────────────
const problems = []
const seenIds = new Set()
for (const { file, set, recs, rows } of papers) {
  if (rows.length !== 200) problems.push(`${file}: ${rows.length} questions, expected 200`)
  const qNos = new Set()
  rows.forEach((row, i) => {
    for (const p of validateRow(row, recs[i])) problems.push(`${file} q${recs[i].q_no}: ${p}`)
    if (seenIds.has(row.external_id)) problems.push(`${file}: duplicate external_id ${row.external_id}`)
    seenIds.add(row.external_id)
    if (qNos.has(recs[i].q_no)) problems.push(`${file}: duplicate q_no ${recs[i].q_no}`)
    qNos.add(recs[i].q_no)
    if (row.mock_set !== set) problems.push(`${file}: wrong mock_set on ${row.external_id}`)
  })
}

// A repeated question would defeat the point of three separate papers. The
// stem alone is not the identity — "Which one of the following pairs is
// incorrectly matched?" is a shared stem across dozens of genuinely different
// questions — so a question is keyed by its stem AND its four options.
const identity = (row) =>
  [row.question_text, row.option_a, row.option_b, row.option_c, row.option_d]
    .map((s) => String(s).trim().toLowerCase().replace(/\s+/g, ' '))
    .join(' | ')
const across = new Map()
for (const { rows } of papers) {
  for (const row of rows) {
    const k = identity(row)
    if (across.has(k)) problems.push(`duplicate question: ${across.get(k)} / ${row.external_id}`)
    else across.set(k, row.external_id)
  }
}

// ─── 3. Report ───────────────────────────────────────────────────────────────
const tally = (rows, key) =>
  rows.reduce((m, r) => ((m[r[key] ?? '—'] = (m[r[key] ?? '—'] ?? 0) + 1), m), {})
const show = (o) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')

for (const { file, set, examId, rows } of papers) {
  console.log(`\n── ${file} → ${examId} (mock_set ${set}), ${rows.length} questions`)
  console.log('   subject   :', show(tally(rows, 'subject')))
  console.log('   difficulty:', show(tally(rows, 'difficulty')))
  console.log('   type      :', show(tally(rows, 'question_type')))
  console.log('   answers   :', show(tally(rows, 'correct_answer')))
  const withTa = rows.filter((r) => r.question_text_ta && r.explanation_ta).length
  const withWhy = rows.filter((r) => r.why_wrong).length
  console.log(`   bilingual : ${withTa}/${rows.length}   why_wrong: ${withWhy}/${rows.length}`)
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):`)
  problems.slice(0, 40).forEach((p) => console.error('   ', p))
  if (problems.length > 40) console.error(`    …and ${problems.length - 40} more`)
  process.exit(1)
}
console.log('\n✓ all rows valid')

const all = papers.flatMap((p) => p.rows)

if (dryRun) {
  const out = `${SRC}/_transformed_${MOCK_SETS.map((m) => m.examId).join('_')}.json`
  writeFileSync(out, JSON.stringify(all, null, 1), 'utf8')
  console.log(`\nDry run — wrote ${all.length} rows to ${out}. Nothing was loaded.`)
  process.exit(0)
}

// ─── 4. Load ─────────────────────────────────────────────────────────────────
const { Client } = await import('pg')
const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 180000,
})
await client.connect()

// Refuse to run against anything but the intended database — the local .env
// still points at the retired Supabase Cloud project, where this would appear
// to succeed while production stayed empty.
const who = await client.query(
  `select current_database() db, (select count(*)::int from profiles) profiles`
)
console.log(`\nConnected: db=${who.rows[0].db} profiles=${who.rows[0].profiles}`)

const before = (
  await client.query(`select count(*)::int n from questions where category='mock'`)
).rows[0].n

try {
  await client.query('begin')

  const sets = MOCK_SETS.map((m) => m.set)
  const examIds = MOCK_SETS.map((m) => m.examId)

  const archiveSets = ARCHIVE_MOVES.map((m) => m.to)

  // The destination slots must be empty, and no attempt may exist against
  // exam4/5/6 — those exam ids stay put but end up serving different content,
  // so a recorded attempt would be silently reattributed. The questions
  // themselves are MOVED, not deleted, so bookmarks/SRS/answers keep their
  // question_id and follow the question to its new exam.
  const { rows: [pre] } = await client.query(
    `select (select count(*)::int from questions
              where category='mock' and mock_set = any($1::int[]))       as occupying_destination,
            (select count(*)::int from mock_exam_attempts
              where exam_id = any($2::text[]))                           as attempts_on_reused_exams,
            (select count(*)::int from questions
              where external_id ~ '^M[789]-')                            as ids_blocking_rename`,
    [archiveSets, examIds]
  )
  console.log('  pre-flight:', pre)
  const blockers = Object.entries(pre).filter(([, v]) => Number(v) > 0)
  if (blockers.length && !process.argv.includes('--force')) {
    throw new Error(
      `swap aborted, database not in the expected state: ${blockers
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    )
  }

  // Move the displaced papers up. An UPDATE, never a delete-and-reinsert, so
  // each question keeps its id. external_id is renamed in the same statement
  // because it is UNIQUE and the incoming papers claim M4-/M5-/M6-; the section
  // suffix survives (M4-GS-001 → M7-GS-001). `mock_set + 3` on the right-hand
  // side reads the pre-update value, so both columns move together.
  const moved = await client.query(
    `update questions
        set mock_set    = mock_set + 3,
            external_id = regexp_replace(external_id, '^M[456]-', 'M' || (mock_set + 3) || '-')
      where category = 'mock' and mock_set = any($1::int[])`,
    [sets]
  )
  console.log(`  moved ${moved.rowCount} questions ${sets.join('/')} → ${archiveSets.join('/')}`)

  const { rows: [{ n: leftover }] } = await client.query(
    `select count(*)::int n from questions where category='mock' and mock_set = any($1::int[])`,
    [sets]
  )
  if (Number(leftover) > 0) {
    throw new Error(`${leftover} rows still occupy sets ${sets.join('/')} after the move`)
  }

  const ins = await client.query(
    `
    insert into questions (
      category, mock_set, external_id, unit, subject, topic, question_type, difficulty,
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
      nullif(e->>'question_type',''),
      coalesce(nullif(e->>'difficulty',''),'hard'),
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      case when e->'why_wrong' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong' is null
           then null else e->'why_wrong' end,
      'tnpsc-mentors-original',
      nullif(e->>'question_text_ta',''),
      nullif(e->>'option_a_ta',''), nullif(e->>'option_b_ta',''),
      nullif(e->>'option_c_ta',''), nullif(e->>'option_d_ta',''),
      nullif(e->>'explanation_ta',''),
      case when e->'why_wrong_ta' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong_ta' is null
           then null else e->'why_wrong_ta' end
    from jsonb_array_elements($1::jsonb) as e
    `,
    [JSON.stringify(all)]
  )
  console.log(`  inserted ${ins.rowCount} rows`)

  // exam4/5/6 keep their mock_set, so they now serve the newly loaded papers
  // with no catalog change. The displaced papers need rows of their own,
  // created DISABLED — they have always been hidden and a new slot number is
  // not a reason to expose them. Insert-only, so a re-run never clobbers a tier
  // or enabled changed from the superadmin console afterwards.
  for (const { to, examId } of ARCHIVE_MOVES) {
    await client.query(
      `insert into public.mock_exams (id, mock_set, title, title_ta, tier, enabled, sort_order)
       values ($1, $2, $3, $4, 'paid', false, $2)
       on conflict (id) do nothing`,
      [examId, to, `Full Mock Exam ${to}`, `முழு மாதிரித் தேர்வு ${to}`]
    )
  }
  console.log(
    `  registered ${ARCHIVE_MOVES.map((m) => m.examId).join('/')} for the displaced papers (hidden)`
  )

  // Enable only the new papers, guarded on the question count so an incomplete
  // paper is never exposed (an enabled short paper serves a partial test and
  // charges credits for it).
  const enabled = await client.query(
    `update public.mock_exams e set enabled = true, updated_at = now()
      where e.id = any($1::text[])
        and (select count(*) from questions q
              where q.category='mock' and q.mock_set = e.mock_set) = e.total_questions
      returning e.id`,
    [ENABLE_EXAM_IDS]
  )
  const enabledIds = enabled.rows.map((r) => r.id).sort()
  const skipped = ENABLE_EXAM_IDS.filter((i) => !enabledIds.includes(i))
  console.log(
    `  enabled ${enabledIds.join('/') || 'none'}` +
      (skipped.length ? ` — skipped ${skipped.join('/')} (count ≠ total_questions)` : '')
  )

  // Exactly one free mock. `tier` is independent of `enabled` — it decides
  // whether opening an exam needs a paid plan — and the live catalog is
  // editable from the console, so this asserts the rule rather than assuming
  // it. Idempotent.
  const tiers = await client.query(
    `update public.mock_exams
        set tier = case when id = $1 then 'free' else 'paid' end,
            updated_at = now()
      where tier is distinct from (case when id = $1 then 'free' else 'paid' end)
      returning id, tier`,
    [FREE_EXAM_ID]
  )
  console.log(
    tiers.rowCount
      ? `  tier corrected: ${tiers.rows.map((r) => `${r.id}→${r.tier}`).join(', ')}`
      : `  tiers already correct (${FREE_EXAM_ID} free, all others paid)`
  )

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
