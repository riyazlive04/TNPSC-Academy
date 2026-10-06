import { Client } from 'pg'
import { readFileSync } from 'node:fs'

// ─── "Target Group 2 2026" bank loader (category='testseries_g2t') ───────────
// Loads all 29 question sets behind the two tracks of the ₹849 Target Group 2
// 2026 language series. See supabase/target_g2_2026.sql for the catalog rows
// that point at these set numbers via test_series.question_sets.
//
//    test_set  1..10  English unit papers 1..10        (100 Q each)
//    test_set 11..20  Tamil unit papers 1..10          (100 Q each)
//    test_set 41..43  Grand Mock 1..3 — General Studies half  (bilingual)
//    test_set 44..46  Grand Mock 1..3 — General English half
//    test_set 47..49  Grand Mock 1..3 — General Tamil half
//
// The GS half is loaded ONCE and sat by both tracks (the English mock is
// {41,44}, the Tamil mock is {41,47}) — it is deliberately not duplicated per
// track, so a correction to a GS mock question is a correction for everyone.
//
// The source folders live outside the app repo, under the parser workspace.
//
// Idempotent: re-running deletes exactly the external_ids it is about to write
// and inserts them again, so it never touches another bank and never
// accumulates duplicates. It also never blanket-deletes the category — see the
// "CA update in place" rule: questions.id is referenced by user history with
// ON DELETE CASCADE / SET NULL.
//
// The database is reachable only from the VPS (local .env points at the retired
// Supabase Cloud instance), so run this ON the box:
//   node --env-file=.env load-target-g2.mjs

// Defaults to the authoring machine's parser workspace; set TARGET_G2_SRC to
// wherever the Group2 folder was copied when running this on the VPS (the DB is
// not reachable from the laptop, so that is the normal case).
const ROOT = process.env.TARGET_G2_SRC || 'c:/Users/mas20/Desktop/work/parser/Group2'
const LANG_DIR = `${ROOT}/language_tests_v2`
const MOCK_DIR = `${ROOT}/mock`

const CATEGORY = 'testseries_g2t'

/** Clamp to the schema's easy/medium/hard check, defaulting to medium. */
function clampDifficulty(d) {
  const v = String(d ?? '').toLowerCase()
  return v === 'easy' || v === 'medium' || v === 'hard' ? v : 'medium'
}

/**
 * Route whichever side actually has text into the PRIMARY column.
 *
 * These are monolingual papers: an English item carries no Tamil translation
 * and a Tamil item no English one (Tamil grammar/literature items rarely
 * translate meaningfully). `question_text` / `option_*` / `explanation` are NOT
 * NULL in the schema and are what renders whenever the UI language is not
 * specifically 'ta' — displayQuestion() in src/types/index.ts only ever falls
 * back TO Tamil, never the other way — so a Tamil-only item with a blank
 * primary field would render an empty stem to anyone on the English UI.
 * Same rule as server/load-rank-booster-language.mjs.
 */
function bilingual(en, ta) {
  const enT = (en ?? '').toString().trim()
  const taT = (ta ?? '').toString().trim()
  if (enT) return [enT, taT || null]
  return [taT, null]
}

/** Aptitude tag for the mock's General Studies half (Part B is 15 aptitude +
 *  10 reasoning). Not load-bearing — this bank is only ever served whole, by
 *  test_set — but it keeps the rows consistent with the other Group 2 banks. */
function aptitudeType(r) {
  if (r.unit === 'B2' || r.subject === 'Reasoning') return 'reasoning'
  if (r.unit === 'B1' || r.subject === 'Aptitude & Mental Ability') return 'numerics'
  return null
}

/** One source record → one `questions` row. */
function toRow(r, { testSet, externalId }) {
  const [question_text, question_text_ta] = bilingual(r.question_en, r.question_ta)
  const [option_a, option_a_ta] = bilingual(r.options_en?.A, r.options_ta?.A)
  const [option_b, option_b_ta] = bilingual(r.options_en?.B, r.options_ta?.B)
  const [option_c, option_c_ta] = bilingual(r.options_en?.C, r.options_ta?.C)
  const [option_d, option_d_ta] = bilingual(r.options_en?.D, r.options_ta?.D)
  // The mock papers follow the real TNPSC sheet and carry a 5th "Answer not
  // known" option; the unit papers are 4-option. option_e stays NULL for those,
  // which is exactly what optionLetters(q) expects.
  const [option_e, option_e_ta] = bilingual(r.options_en?.E, r.options_ta?.E)
  const [explanation, explanation_ta] = bilingual(r.explanation_en, r.explanation_ta)
  return {
    external_id: externalId,
    test_set: testSet,
    unit: r.unit_name || null,
    subject: r.subject || null,
    topic: r.subject_concept || null,
    aptitude_type: aptitudeType(r),
    question_type: r.question_type || null,
    difficulty: clampDifficulty(r.difficulty),
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    option_e: option_e || null,
    correct_answer: (r.correct_answer_letter || '').toUpperCase(),
    explanation: explanation || null,
    source_url: r.source_ref || null,
    question_text_ta,
    option_a_ta,
    option_b_ta,
    option_c_ta,
    option_d_ta,
    option_e_ta,
    explanation_ta,
  }
}

const pad2 = (n) => String(n).padStart(2, '0')
const pad3 = (n) => String(n).padStart(3, '0')

/** The 10 unit papers of one language track. */
function loadUnitPapers(lang, firstTestSet) {
  return Array.from({ length: 10 }, (_, i) => i + 1).flatMap((paper) => {
    const file = `${LANG_DIR}/${lang}/test${pad2(paper)}/${lang === 'english' ? 'english' : 'tamil'}_test${paper}.json`
    const slug = lang === 'english' ? 'en' : 'ta'
    return JSON.parse(readFileSync(file, 'utf8')).map((r) =>
      toRow(r, {
        testSet: firstTestSet + paper - 1,
        externalId: `g2t-${slug}-t${pad2(paper)}-q${pad3(r.q_no)}`,
      })
    )
  })
}

/** One half of one Grand Mock. */
function loadMockHalf(mock, file, slug, testSet) {
  return JSON.parse(readFileSync(`${MOCK_DIR}/mock${pad2(mock)}/${file}.json`, 'utf8')).map((r) =>
    toRow(r, { testSet, externalId: `g2t-mock${mock}-${slug}-q${pad3(r.q_no)}` })
  )
}

const MOCKS = [1, 2, 3]

const data = [
  ...loadUnitPapers('english', 1),
  ...loadUnitPapers('tamil', 11),
  ...MOCKS.flatMap((m) => loadMockHalf(m, 'general_studies', 'gs', 40 + m)),
  ...MOCKS.flatMap((m) => loadMockHalf(m, 'general_english', 'en', 43 + m)),
  ...MOCKS.flatMap((m) => loadMockHalf(m, 'general_tamil', 'ta', 46 + m)),
]

// Fail before touching the database rather than loading a short paper: every
// set in this product is exactly 100 questions, and a silently truncated source
// file would otherwise surface as a student sitting a 94-question "100 Q" paper.
const counts = data.reduce((acc, r) => ((acc[r.test_set] = (acc[r.test_set] ?? 0) + 1), acc), {})
const expected = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  41, 42, 43, 44, 45, 46, 47, 48, 49,
]
const bad = expected.filter((s) => counts[s] !== 100)
if (bad.length) {
  console.error(
    `Refusing to load — these test_sets are not 100 questions: ${bad
      .map((s) => `${s} (${counts[s] ?? 0})`)
      .join(', ')}`
  )
  process.exit(1)
}
const missingAnswer = data.filter((r) => !'ABCDE'.includes(r.correct_answer))
if (missingAnswer.length) {
  console.error(
    `Refusing to load — ${missingAnswer.length} rows have no valid correct_answer, e.g. ${missingAnswer[0].external_id}`
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
  `Connected. Loading ${data.length} Target Group 2 2026 questions (20 unit papers + 3 mocks)...`
)

const before = (
  await client.query(`select count(*)::int n from questions where category=$1`, [CATEGORY])
).rows[0].n

try {
  await client.query('begin')

  // Idempotent: remove any prior load of these exact external_ids first. Scoped
  // to the ids we are about to write — never a blanket delete of the category.
  const ids = data.map((d) => d.external_id)
  const del = await client.query(
    `delete from questions where category=$1 and external_id = any($2::text[])`,
    [CATEGORY, ids]
  )
  console.log(`  removed ${del.rowCount} pre-existing rows with same external_id`)

  const ins = await client.query(
    `
    insert into questions (
      category, test_set, external_id, unit, subject, topic, aptitude_type,
      question_type, difficulty,
      question_text, option_a, option_b, option_c, option_d, option_e,
      correct_answer, explanation, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta, option_e_ta,
      explanation_ta
    )
    select
      $2,
      (e->>'test_set')::int,
      nullif(e->>'external_id',''),
      nullif(e->>'unit',''),
      nullif(e->>'subject',''),
      nullif(e->>'topic',''),
      nullif(e->>'aptitude_type',''),
      nullif(e->>'question_type',''),
      e->>'difficulty',
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      nullif(e->>'option_e',''),
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      nullif(e->>'source_url',''),
      nullif(e->>'question_text_ta',''),
      nullif(e->>'option_a_ta',''), nullif(e->>'option_b_ta',''),
      nullif(e->>'option_c_ta',''), nullif(e->>'option_d_ta',''),
      nullif(e->>'option_e_ta',''),
      nullif(e->>'explanation_ta','')
    from jsonb_array_elements($1::jsonb) as e
    `,
    [JSON.stringify(data), CATEGORY]
  )
  console.log(`  inserted ${ins.rowCount} rows`)

  await client.query('commit')
} catch (err) {
  await client.query('rollback')
  console.error('FAILED, rolled back:', err.message)
  process.exit(1)
}

const after = (
  await client.query(`select count(*)::int n from questions where category=$1`, [CATEGORY])
).rows[0].n
const bySet = (
  await client.query(
    `select test_set, count(*)::int n from questions where category=$1
     group by test_set order by test_set`,
    [CATEGORY]
  )
).rows
console.log(`Done. category='${CATEGORY}' rows: ${before} -> ${after}`)
console.table(bySet)

await client.end()
