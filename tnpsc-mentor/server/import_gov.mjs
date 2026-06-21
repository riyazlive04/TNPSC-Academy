import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'
import { buildImageIndex, resolveRef, publicUrl } from './logical_images.mjs'

/**
 * Importer for the GOV bank (logical/Gov/GOV.json) → questions (category='aptitude').
 *
 * GOV.json is a master: { topics:[{ aptitude_topic, category, questions[] }] }.
 * Every row is stamped source_tag = 'GOV' (admin/superadmin-only — NOT returned
 * by get_quiz_questions; renders only in the admin question bank).
 *
 * aptitude_type = topic.category ∈ numerics | data_interpretation | general_studies
 * (the last two require supabase/gov_aptitude_types.sql to be applied first).
 *
 * Figures are uploaded separately (upload_logical_images.mjs <Gov dir>); here the
 * refs are rewritten to their hosted public URLs. Idempotent by external_id (gov_id).
 *
 * Usage:
 *   node import_gov.mjs                 # DRY RUN
 *   APPLY=1 node import_gov.mjs         # insert
 *   node import_gov.mjs <dir>           # override Gov dir
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = join(__dirname, '..', '..', '..', 'logical', 'Gov')
const argDir = process.argv[2]
const SRC_DIR = argDir ? (isAbsolute(argDir) ? argDir : join(process.cwd(), argDir)) : DEFAULT_DIR
const APPLY = process.env.APPLY === '1'

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
  'correct_answer', 'explanation', 'images',
  'question_text_ta', 'explanation_ta',
  'source_url', 'source_tag', 'external_id', 'active',
]

const index = buildImageIndex(SRC_DIR)
const master = JSON.parse(readFileSync(join(SRC_DIR, 'GOV.json'), 'utf8'))
const rows = []
const unresolved = []
let imgRefs = 0

for (const t of master.topics ?? []) {
  for (const q of t.questions ?? []) {
    let imgs = null
    if (Array.isArray(q.images) && q.images.length) {
      imgRefs += q.images.length
      imgs = q.images.map((ref) => {
        const r = resolveRef(ref, SRC_DIR, index)
        if (!r) { unresolved.push(`${q.gov_id}: ${ref}`); return ref }
        return publicUrl(r.objectName)
      })
    }
    rows.push({
      category: 'aptitude',
      aptitude_type: t.category,
      aptitude_topic: t.aptitude_topic,
      difficulty: 'medium',
      question_text: q.question_text,
      option_a: q.option_a ?? null,
      option_b: q.option_b ?? null,
      option_c: q.option_c ?? null,
      option_d: q.option_d ?? null,
      correct_answer: String(q.correct_answer).toUpperCase(),
      explanation: flattenExplanation(q.explanation),
      images: imgs ? JSON.stringify(imgs) : null,
      question_text_ta: q.question_text_ta ?? null,
      explanation_ta: flattenExplanation(q.explanation_ta),
      source_url: q.source_url ?? null,
      source_tag: 'GOV',
      external_id: q.gov_id,
      active: true,
    })
  }
}

console.log(`Mapped ${rows.length} GOV rows from ${SRC_DIR}`)
const byType = {}, byTopic = {}
for (const r of rows) { byType[r.aptitude_type] = (byType[r.aptitude_type] ?? 0) + 1; byTopic[r.aptitude_topic] = (byTopic[r.aptitude_topic] ?? 0) + 1 }
console.log(`aptitude_type: ${JSON.stringify(byType)}`)
console.log(`topics: ${Object.keys(byTopic).length} | source_tag: GOV (all) | image refs → URLs: ${imgRefs - unresolved.length}/${imgRefs}`)
if (unresolved.length) { console.error(`⚠ UNRESOLVED images: ${unresolved.length}`); unresolved.slice(0, 10).forEach((m) => console.error('  ' + m)); process.exit(1) }

const bad = rows.filter((r) => !['A', 'B', 'C', 'D'].includes(r.correct_answer) || !r.external_id)
if (bad.length) { console.error(`VALIDATION FAILED: ${bad.length} bad rows`); bad.slice(0, 10).forEach((r) => console.error(`  ${r.external_id}: ${r.correct_answer}`)); process.exit(1) }

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
console.log(`\nInserted ${inserted} GOV rows.`)
await c.end()
