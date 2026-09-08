// ─── Load the Group 1 mock papers through Studio's SQL endpoint ──────────────
// Same data and same result as load-group1-mocks.mjs, but over HTTPS instead of
// a Postgres socket. The self-hosted VPS exposes neither Postgres (firewalled)
// nor PostgREST (403 at nginx) to the outside, so from a laptop this Studio
// route through Kong is the only way in.
//
//   STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node load-group1-mocks-studio.mjs --verify
//   STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node load-group1-mocks-studio.mjs
//
// --verify only reads (identity + current mock counts) and writes nothing, so
// it is the safe first call to confirm the credentials reach the RIGHT database.
//
// What it does, in order:
//   1. prove this is the live database
//   2. build + validate all 600 rows before touching anything
//   3. pre-flight the swap (destination empty, no attempts on exam4/5/6)
//   4. MOVE the papers in 4/5/6 up to 7/8/9 — an update, nothing deleted
//   5. load the new papers into the vacated 4/5/6, in chunks
//   6. register catalog rows for the displaced papers, left HIDDEN
//   7. enable the three new papers only, guarded on the question count
//   8. verify the whole catalog
//
// The 600 rows are ~4.7 MB of bilingual text, well past what one request should
// carry, so step 5 goes up in chunks, each its own transaction. Steps 3-4 make
// a resumed run continue where it stopped rather than move the papers twice.

import { readFileSync } from 'node:fs'
import {
  SOURCE_URL,
  MOCK_SETS,
  ARCHIVE_MOVES,
  ENABLE_EXAM_IDS,
  FREE_EXAM_ID,
  toRow,
  validateRow,
} from './lib-group1-mocks.mjs'

const SRC = 'c:/Users/mas20/Desktop/work/parser/Group1/mock'
const ENDPOINT = 'https://db.tnpscmentors.in/api/platform/pg-meta/default/query'
const CHUNK = 25
const verifyOnly = process.argv.includes('--verify')

const user = process.env.STUDIO_USER || 'tnpscadmin'
const password = process.env.STUDIO_PASSWORD
if (!password) {
  console.error('STUDIO_PASSWORD is not set. Refusing to run.')
  process.exit(1)
}
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')

/** One SQL statement (or file) against production. Throws on any error body. */
async function sql(query, label) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 400)}`)
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${label}: non-JSON reply ${text.slice(0, 200)}`)
  }
  if (json && json.error) throw new Error(`${label}: ${JSON.stringify(json.error).slice(0, 400)}`)
  return json
}

/** A SQL string literal — the only place untrusted text meets the statement. */
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const jsonLit = (v) => (v ? `${lit(JSON.stringify(v))}::jsonb` : 'null')

// ─── 1. Identity check ───────────────────────────────────────────────────────
// The local .env still points at the retired Cloud project, and a migration
// against the wrong database reports success while production stays untouched.
// Refuse to write until the row counts prove this is the live one.
const who = await sql(
  `select current_database() as db, current_user as usr,
          (select count(*)::int from public.profiles)  as profiles,
          (select count(*)::int from public.questions) as questions,
          (select count(*)::int from public.questions where category='mock') as mock`,
  'identity'
)
const id = Array.isArray(who) ? who[0] : who
console.log('Connected:', id)
if (!id || Number(id.profiles) < 100) {
  console.error('Refusing to continue: this does not look like the live database.')
  process.exit(1)
}

const catalog = await sql(
  `select e.id, e.mock_set, e.tier, e.enabled, e.sort_order,
          (select count(*)::int from public.questions q
            where q.category='mock' and q.mock_set = e.mock_set) as questions
     from public.mock_exams e order by e.sort_order`,
  'catalog'
)
console.log('\nCurrent mock_exams:')
for (const r of catalog) {
  console.log(
    `  ${r.id.padEnd(6)} set=${r.mock_set} tier=${String(r.tier).padEnd(4)} ` +
      `enabled=${String(r.enabled).padEnd(5)} questions=${r.questions}`
  )
}

// ─── 2. Build + validate (identical to the direct loader) ────────────────────
const papers = MOCK_SETS.map(({ file, set, examId }) => {
  const recs = JSON.parse(readFileSync(`${SRC}/${file}/general_studies_aptitude.json`, 'utf8'))
  return { file, set, examId, recs, rows: recs.map((r) => toRow(r, set)) }
})
const problems = []
for (const { file, recs, rows } of papers) {
  if (rows.length !== 200) problems.push(`${file}: ${rows.length} questions, expected 200`)
  rows.forEach((row, i) => {
    for (const p of validateRow(row, recs[i])) problems.push(`${file} q${recs[i].q_no}: ${p}`)
  })
}
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s); nothing was written:`)
  problems.slice(0, 20).forEach((p) => console.error('   ', p))
  process.exit(1)
}
const all = papers.flatMap((p) => p.rows)
console.log(`\n✓ ${all.length} rows validated`)

if (verifyOnly) {
  console.log('\n--verify: read-only. Nothing was written.')
  process.exit(0)
}

const SETS = MOCK_SETS.map((m) => m.set)
const EXAM_IDS = MOCK_SETS.map((m) => m.examId)

const ARCHIVE_SETS = ARCHIVE_MOVES.map((m) => m.to)

// ─── 3. Check the swap is safe ───────────────────────────────────────────────
// The destination slots 7/8/9 must be empty, and no attempt may exist against
// exam4/5/6: those exam ids stay put but come to serve different content, so a
// recorded attempt would be silently reattributed to a paper nobody sat.
//
// Note what is NOT at risk: the questions themselves are MOVED, not deleted, so
// every bookmark, SRS card and recorded answer keeps its question_id and simply
// follows the question to its new exam.
//
// `source_url` tells the two generations apart — the original six papers were
// loaded as 'tnpsc-official', these carry SOURCE_URL. That makes "which rows
// still need moving" an exact question rather than a guess, so a run that died
// part way through the chunked load resumes correctly instead of shifting the
// papers a second time.
const NOT_NEW = `source_url is distinct from ${lit(SOURCE_URL)}`
const pre = await sql(
  `select (select count(*)::int from public.questions
            where category='mock' and mock_set in (${ARCHIVE_SETS.join(',')})) as occupying_destination,
          (select count(*)::int from public.questions
            where category='mock' and mock_set in (${SETS.join(',')}) and ${NOT_NEW}) as still_to_move,
          (select count(*)::int from public.questions
            where category='mock' and mock_set in (${SETS.join(',')})
              and source_url = ${lit(SOURCE_URL)})                             as already_loaded,
          (select count(*)::int from public.mock_exam_attempts
            where exam_id in (${EXAM_IDS.map(lit).join(',')}))                 as attempts_on_reused_exams`,
  'pre-flight'
)
const p0 = Array.isArray(pre) ? pre[0] : pre
console.log('\nPre-flight:', p0)

const stillToMove = Number(p0.still_to_move)
const alreadyLoaded = Number(p0.already_loaded)

const blockers = []
// The destination must hold either nothing (fresh run) or exactly the papers
// this script put there (resumed run). Anything else is unexplained.
if (Number(p0.occupying_destination) > 0 && stillToMove > 0)
  blockers.push(
    `sets ${ARCHIVE_SETS.join('/')} already hold ${p0.occupying_destination} questions ` +
      `while ${stillToMove} still wait to move into them`
  )
// exam4/5/6 keep their ids but come to serve different content, so an existing
// attempt would be silently reattributed to a paper nobody sat.
if (Number(p0.attempts_on_reused_exams) > 0)
  blockers.push(`${p0.attempts_on_reused_exams} attempt(s) recorded against ${EXAM_IDS.join('/')}`)
if (blockers.length && !process.argv.includes('--force')) {
  console.error('\n✗ Swap aborted — the database is not in the expected state:')
  blockers.forEach((b) => console.error('   ', b))
  console.error('    Nothing was written. Re-run with --force only after checking.')
  process.exit(1)
}
if (alreadyLoaded > 0) {
  console.log(`resuming: ${alreadyLoaded} of ${all.length} new rows are already loaded`)
}

// ─── 4. Move the displaced papers up to 7/8/9 ────────────────────────────────
// An UPDATE, never a delete-and-reinsert: each question keeps its `id`, so all
// referencing rows follow it. external_id is renamed in the same statement
// because it is UNIQUE and the incoming papers claim M4-/M5-/M6- — the section
// suffix is preserved (M4-GS-001 → M7-GS-001, M6-REA-010 → M9-REA-010).
// `mock_set + 3` on the right-hand side reads the pre-update value, which is
// what makes both columns move together consistently.
if (stillToMove === 0) {
  console.log(`nothing left to move — sets ${SETS.join('/')} were vacated by an earlier run`)
} else {
  const moved = await sql(
    `with shifted as (
       update public.questions
          set mock_set    = mock_set + 3,
              external_id = regexp_replace(external_id, '^M[456]-', 'M' || (mock_set + 3) || '-')
        where category = 'mock' and mock_set in (${SETS.join(',')}) and ${NOT_NEW}
        returning 1
     ) select count(*)::int as n from shifted`,
    'move displaced papers'
  )
  console.log(
    `moved ${(Array.isArray(moved) ? moved[0] : moved).n} questions ` +
      `${SETS.join('/')} → ${ARCHIVE_SETS.join('/')} (ids renamed with them)`
  )
}

// Nothing of the OLD generation may remain in the target slots before the new
// papers land — rows this script loaded on a previous run are fine and are
// overwritten by their own external_id in step 5.
const vacated = await sql(
  `select count(*)::int as n from public.questions
    where category='mock' and mock_set in (${SETS.join(',')}) and ${NOT_NEW}`,
  'confirm vacated'
)
const leftover = Number((Array.isArray(vacated) ? vacated[0] : vacated).n)
if (leftover > 0) {
  console.error(`\n✗ ${leftover} old row(s) still occupy sets ${SETS.join('/')}. Stopping.`)
  process.exit(1)
}

// ─── 5. Load the new papers into the vacated slots, in chunks ────────────────
const COLS = [
  'category', 'mock_set', 'external_id', 'unit', 'subject', 'topic', 'question_type',
  'difficulty', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'why_wrong', 'source_url',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'explanation_ta', 'why_wrong_ta',
]

const values = (r) =>
  '(' +
  [
    lit('mock'), String(r.mock_set), lit(r.external_id), lit(r.unit), lit(r.subject),
    lit(r.topic), lit(r.question_type), lit(r.difficulty), lit(r.question_text),
    lit(r.option_a), lit(r.option_b), lit(r.option_c), lit(r.option_d),
    lit(r.correct_answer), lit(r.explanation), jsonLit(r.why_wrong),
    lit(SOURCE_URL),
    lit(r.question_text_ta), lit(r.option_a_ta), lit(r.option_b_ta), lit(r.option_c_ta),
    lit(r.option_d_ta), lit(r.explanation_ta), jsonLit(r.why_wrong_ta),
  ].join(', ') +
  ')'

let written = 0
for (let i = 0; i < all.length; i += CHUNK) {
  const batch = all.slice(i, i + CHUNK)
  const ids = batch.map((r) => lit(r.external_id)).join(', ')
  // The delete here is belt-and-braces for a re-run that stopped part way: the
  // whole set was already cleared in step 4, so on a first pass it matches
  // nothing. Scoped to this batch's own ids, so it cannot reach another set.
  await sql(
    `begin;
     delete from public.questions where category='mock' and external_id in (${ids});
     insert into public.questions (${COLS.join(', ')}) values
     ${batch.map(values).join(',\n')};
     commit;`,
    `rows ${i + 1}-${i + batch.length}`
  )
  written += batch.length
  process.stdout.write(`\r  loaded ${written}/${all.length}`)
}
console.log('')

// ─── 6. Register catalog rows for the displaced papers ──────────────────────
// exam4/5/6 already exist and keep their mock_set, so they now serve the newly
// loaded papers with no catalog change at all. The papers that moved up need
// rows of their own — created DISABLED. They have always been hidden and
// changing their slot number is not a reason to expose them; a superadmin can
// switch them on from the Mock Exams tab when they are worth showing.
// `on conflict do nothing` guards a re-run so a tier or enabled changed from
// the console afterwards is never clobbered.
await sql(
  `insert into public.mock_exams (id, mock_set, title, title_ta, tier, enabled, sort_order) values
     ('exam7', 7, 'Full Mock Exam 7', 'முழு மாதிரித் தேர்வு 7', 'paid', false, 7),
     ('exam8', 8, 'Full Mock Exam 8', 'முழு மாதிரித் தேர்வு 8', 'paid', false, 8),
     ('exam9', 9, 'Full Mock Exam 9', 'முழு மாதிரித் தேர்வு 9', 'paid', false, 9)
   on conflict (id) do nothing`,
  'register displaced papers'
)
console.log(
  `registered ${ARCHIVE_MOVES.map((m) => m.examId).join('/')} for the displaced papers (hidden)`
)

// ─── 7. Enable the new papers ───────────────────────────────────────────────
// Only exam4/5/6 — the displaced papers stay hidden (see ENABLE_EXAM_IDS).
// Guarded on the question count so an incomplete paper is not exposed.
const enabled = await sql(
  `with ready as (
     select e.id from public.mock_exams e
      where e.id in (${ENABLE_EXAM_IDS.map(lit).join(', ')})
        and (select count(*) from public.questions q
              where q.category='mock' and q.mock_set = e.mock_set) = e.total_questions
   )
   update public.mock_exams set enabled = true, updated_at = now()
    where id in (select id from ready)
   returning id`,
  'enable exams'
)
const enabledIds = (Array.isArray(enabled) ? enabled : []).map((r) => r.id)
const skipped = ENABLE_EXAM_IDS.filter((i) => !enabledIds.includes(i))
console.log(
  `enabled ${enabledIds.length ? enabledIds.sort().join('/') : 'none'}` +
    (skipped.length ? ` — skipped ${skipped.join('/')} (question count ≠ total_questions)` : '')
)

// ─── 7b. Exactly one free mock ───────────────────────────────────────────────
// `tier` is independent of `enabled`: it decides whether opening an exam needs
// a paid plan. Only FREE_EXAM_ID may be free — the live catalog is editable
// from the superadmin console and had drifted, leaving a second exam open to
// everyone. Asserted here rather than assumed, and idempotent.
const tiers = await sql(
  `with fixed as (
     update public.mock_exams
        set tier = case when id = ${lit(FREE_EXAM_ID)} then 'free' else 'paid' end,
            updated_at = now()
      where tier is distinct from (case when id = ${lit(FREE_EXAM_ID)} then 'free' else 'paid' end)
      returning id, tier
   ) select id, tier from fixed order by id`,
  'normalise tiers'
)
const retiered = Array.isArray(tiers) ? tiers : []
console.log(
  retiered.length
    ? `tier corrected: ${retiered.map((r) => `${r.id}→${r.tier}`).join(', ')}`
    : `tiers already correct (${FREE_EXAM_ID} free, all others paid)`
)

// ─── 8. Verify, and refuse to leave a short paper enabled ───────────────────
// The whole catalog, so the parked rows are visible in the report too. Only
// ENABLED rows are checked for completeness — a hidden paper nobody can open
// is not a problem whatever its count.
const after = await sql(
  `select e.id, e.mock_set, e.tier, e.enabled, e.total_questions,
          (select count(*)::int from public.questions q
            where q.category='mock' and q.mock_set = e.mock_set) as questions
     from public.mock_exams e order by e.sort_order`,
  'verify'
)
console.log('\nFinal catalog:')
for (const r of after) {
  const flag = r.enabled && Number(r.questions) !== Number(r.total_questions) ? '  ← SHORT' : ''
  console.log(
    `  ${r.id.padEnd(6)} set=${r.mock_set} tier=${String(r.tier).padEnd(4)} ` +
      `enabled=${String(r.enabled).padEnd(5)} questions=${r.questions}/${r.total_questions}${flag}`
  )
}

// An enabled exam whose paper is short would serve a partial test and charge
// credits for it, so pull any such exam back rather than leave it exposed.
const short = after.filter((r) => r.enabled && Number(r.questions) !== Number(r.total_questions))
if (short.length) {
  await sql(
    `update public.mock_exams set enabled=false, updated_at=now()
      where id in (${short.map((r) => lit(r.id)).join(', ')})`,
    'disable short papers'
  )
  console.error(`\n✗ Disabled ${short.map((r) => r.id).join(', ')} — incomplete paper.`)
  process.exit(1)
}
const live = after.filter((r) => r.enabled)
const parked = after.filter((r) => !r.enabled)
console.log(`\n✓ ${live.length} exams live: ${live.map((r) => r.id).join(', ')}`)
if (parked.length) {
  console.log(`  parked (hidden, switch on from the Mock Exams tab): ${parked.map((r) => r.id).join(', ')}`)
}
