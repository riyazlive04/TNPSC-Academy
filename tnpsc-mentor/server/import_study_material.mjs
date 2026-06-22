import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

/**
 * Importer for the study_material_mcq aptitude files → questions (category='aptitude').
 *
 * Each source file is { category:'aptitude', aptitude_topic, source, questions[] }.
 * Every row is stamped source_tag = 'GOV' so it carries the admin/superadmin-only
 * "GOV" badge in the admin question bank (the badge renders only in
 * AdminQuestionsPage; students never see source_tag). Per the product decision,
 * the questions THEMSELVES are still served to students in aptitude tests — only
 * the GOV tag is admin-visible.
 *
 * aptitude_topic is normalised to the canonical label already used in the DB so
 * the rows merge under the existing topics (e.g. "HCF and LCM" -> "LCM and HCF").
 * aptitude_type is derived from the topic. Idempotent by external_id
 * (SMGOV-<file-slug>-<q_num>).
 *
 * Usage:
 *   node import_study_material.mjs                 # DRY RUN
 *   APPLY=1 node import_study_material.mjs         # insert
 *   node import_study_material.mjs <dir>           # override source dir
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = join(__dirname, '..', '..', '..', 'study_material_mcq')
const argDir = process.argv[2]
const SRC_DIR = argDir ? (isAbsolute(argDir) ? argDir : join(process.cwd(), argDir)) : DEFAULT_DIR
const APPLY = process.env.APPLY === '1'

// file aptitude_topic -> canonical DB aptitude_topic (so rows merge with existing).
const TOPIC_CANON = {
  'Area and Volume': 'Area And Volume',
  'Conversion of Information to Data': 'Conversion of Information to Data',
  'HCF and LCM': 'LCM and HCF',
  'Parametric Representation': 'Parametric Representation',
  'Percentage': 'Percentage',
  'Probability': 'Probability',
  'Ratio and Proportion': 'Ratio And Proportion',
  'Simple and Compound Interest': 'Simple and Compound Interest',
  'Time and Work': 'Time and Work',
}

// canonical topic -> aptitude_type
const DATA_INTERP = new Set(['Conversion of Information to Data', 'Parametric Representation'])
const aptitudeType = (canonTopic) => (DATA_INTERP.has(canonTopic) ? 'data_interpretation' : 'numerics')

const slug = (name) => name.replace(/\.json$/i, '')

function flattenExplanation(ex) {
  if (!ex) return null
  if (typeof ex === 'string') return ex.trim() || null
  const out = []
  if (Array.isArray(ex.given) && ex.given.length) { out.push('Given:'); out.push(...ex.given) }
  const fq = ex.from_question
  if (fq) { out.push('From question:'); if (fq.formula) out.push(fq.formula); if (Array.isArray(fq.steps)) out.push(...fq.steps) }
  if (ex.asked) out.push(`Asked: ${ex.asked}`)
  if (ex.final) out.push(ex.final)
  return out.join('\n').trim() || null
}

const COLS = [
  'category', 'aptitude_type', 'aptitude_topic', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation',
  'question_text_ta', 'explanation_ta',
  'source_url', 'source_tag', 'external_id', 'active',
]

const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.json')).sort()
const rows = []
const byTopic = {}

for (const file of files) {
  const j = JSON.parse(readFileSync(join(SRC_DIR, file), 'utf8'))
  const rawTopic = j.aptitude_topic
  const canon = TOPIC_CANON[rawTopic]
  if (!canon) { console.error(`UNMAPPED topic "${rawTopic}" in ${file}`); process.exit(1) }
  const fslug = slug(file)
  for (const q of j.questions ?? []) {
    rows.push({
      category: 'aptitude',
      aptitude_type: aptitudeType(canon),
      aptitude_topic: canon,
      difficulty: 'medium',
      question_text: q.question_text,
      option_a: q.option_a ?? null,
      option_b: q.option_b ?? null,
      option_c: q.option_c ?? null,
      option_d: q.option_d ?? null,
      correct_answer: String(q.correct_answer ?? '').toUpperCase(),
      explanation: flattenExplanation(q.explanation),
      question_text_ta: q.question_text_ta ?? null,
      explanation_ta: flattenExplanation(q.explanation_ta),
      source_url: j.source ?? 'tnpsc-gov-material',
      source_tag: 'GOV',
      external_id: `SMGOV-${fslug}-${q.q_num}`,
      active: true,
    })
    byTopic[canon] = (byTopic[canon] ?? 0) + 1
  }
}

console.log(`Mapped ${rows.length} rows from ${SRC_DIR}`)
console.log(`topics:`, byTopic)

const bad = rows.filter((r) => !['A', 'B', 'C', 'D'].includes(r.correct_answer) || !r.external_id || !r.question_text || !r.option_a || !r.option_b || !r.option_c || !r.option_d)
if (bad.length) { console.error(`VALIDATION FAILED: ${bad.length} bad rows`); bad.slice(0, 10).forEach((r) => console.error(`  ${r.external_id}: ca=${r.correct_answer}`)); process.exit(1) }

const dupIds = rows.map((r) => r.external_id).filter((id, i, a) => a.indexOf(id) !== i)
if (dupIds.length) { console.error(`DUPLICATE external_ids within source: ${[...new Set(dupIds)].slice(0, 10).join(', ')}`); process.exit(1) }

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
})
await c.connect()
const seen = new Set(
  (await c.query("select external_id from public.questions where category='aptitude' and external_id is not null")).rows.map((r) => r.external_id)
)
const toInsert = rows.filter((r) => !seen.has(r.external_id))
console.log(`\nAlready present: ${rows.length - toInsert.length} | to insert: ${toInsert.length}`)

if (!APPLY) { console.log('\nDRY RUN — no rows written. Re-run with APPLY=1.'); await c.end(); process.exit(0) }

const placeholders = COLS.map((_, i) => `$${i + 1}`).join(', ')
const insertSql = `insert into public.questions (${COLS.join(', ')}) values (${placeholders})`
let inserted = 0
for (const r of toInsert) { await c.query(insertSql, COLS.map((k) => r[k])); inserted++ }
console.log(`\nInserted ${inserted} rows (source_tag='GOV').`)
await c.end()
