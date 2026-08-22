import { Client } from 'pg'
import { readFileSync } from 'node:fs'

// The 10 "Language Test" papers of the Rank Booster series (see
// supabase/rank_booster_language_tests.sql for the matching test_series catalog
// rows, test_set 11..20): 5 General English + 5 General Tamil, 100Q each,
// sourced from two sibling parser output folders with slightly different file
// names/field shapes than the GS+Aptitude loader (load-rank-booster.mjs).
const ENGLISH_DIR = 'c:/Users/mas20/Desktop/work/parser/Group2/english_sets_v2'
const TAMIL_DIR = 'c:/Users/mas20/Desktop/work/parser/Group2/tamil_sets'

// set N -> test_set, matching rank_booster_language_tests.sql's g2rb11..g2rb20.
const ENGLISH_TEST_SET = { 1: 11, 2: 13, 3: 15, 4: 17, 5: 19 }
const TAMIL_TEST_SET = { 1: 12, 2: 14, 3: 16, 4: 18, 5: 20 }

/** Clamp to the schema's easy/medium/hard, defaulting to medium (mirrors
 *  load-rank-booster.mjs's SQL-side clamp, done in JS here instead). */
function clampDifficulty(d) {
  const v = String(d ?? '').toLowerCase()
  return v === 'easy' || v === 'medium' || v === 'hard' ? v : 'medium'
}

/**
 * These are monolingual papers: an English-paper item has no real Tamil
 * translation stored (question_ta/options_ta/explanation_ta come through as
 * empty), and a Tamil-paper item has no English side (question_en/options_en/
 * explanation_en empty — Tamil grammar/vocabulary/literature items often don't
 * translate meaningfully). `question_text`/`option_*`/`explanation` are NOT
 * NULL in the schema and are what renders whenever the UI's language toggle
 * isn't specifically 'ta' (see displayQuestion() in src/types/index.ts, which
 * only falls back TO Tamil, never the other way) — so leaving the primary
 * field blank for a Tamil-only item would render an empty question stem for
 * anyone using the English UI. Route whichever side actually has content into
 * the primary field, and only fill the _ta column when there's a genuinely
 * distinct translation to show alongside it.
 */
function bilingual(en, ta) {
  const enT = (en ?? '').toString().trim()
  const taT = (ta ?? '').toString().trim()
  if (enT) return [enT, taT || null]
  return [taT, null]
}

function loadSet(dir, file, lang, set, testSet) {
  const rows = JSON.parse(readFileSync(`${dir}/set${String(set).padStart(2, '0')}/${file}`, 'utf8'))
  return rows.map((r) => {
    const [question_text, question_text_ta] = bilingual(r.question_en, r.question_ta)
    const [option_a, option_a_ta] = bilingual(r.options_en?.A, r.options_ta?.A)
    const [option_b, option_b_ta] = bilingual(r.options_en?.B, r.options_ta?.B)
    const [option_c, option_c_ta] = bilingual(r.options_en?.C, r.options_ta?.C)
    const [option_d, option_d_ta] = bilingual(r.options_en?.D, r.options_ta?.D)
    const [explanation, explanation_ta] = bilingual(r.explanation_en, r.explanation_ta)
    return {
      external_id: `g2rb-lang-${lang}-s${String(set).padStart(2, '0')}-q${String(r.q_no).padStart(3, '0')}`,
      test_set: testSet,
      unit: r.unit_name || null,
      subject: r.subject || null,
      topic: r.subject_concept || null,
      aptitude_type: null,
      question_type: r.question_type || null,
      difficulty: clampDifficulty(r.difficulty),
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer: (r.correct_answer_letter || '').toUpperCase(),
      explanation: explanation || null,
      source_url: r.source_ref || null,
      question_text_ta,
      option_a_ta,
      option_b_ta,
      option_c_ta,
      option_d_ta,
      explanation_ta,
    }
  })
}

const data = [
  ...Object.entries(ENGLISH_TEST_SET).flatMap(([set, testSet]) =>
    loadSet(ENGLISH_DIR, 'general_english.json', 'en', Number(set), testSet)
  ),
  ...Object.entries(TAMIL_TEST_SET).flatMap(([set, testSet]) =>
    loadSet(TAMIL_DIR, 'general_tamil.json', 'ta', Number(set), testSet)
  ),
]

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
console.log(`Connected. Loading ${data.length} Rank Booster Language Test questions (10 papers)...`)

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
