import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute, basename } from 'node:path'
import { buildImageIndex, resolveRef, publicUrl } from './logical_images.mjs'

/**
 * Importer for the full logical/ aptitude bank → questions (category='aptitude').
 *
 * Each file is { category:'reasoning'|'numerics', aptitude_topic, questions[] }.
 * All rows load with category='aptitude', aptitude_type=<file.category>,
 * aptitude_topic=<file.aptitude_topic>.
 *
 * Naming: every row is stamped source_tag = 'IndiaBix' | 'Original' (derived from
 * per-question source / source_url; numerics with no provenance = 'Original').
 * source_tag is admin/superadmin-only — it is NOT returned by get_quiz_questions
 * (see supabase/option_e.sql) and renders only in the admin question bank.
 *
 * 5-option items (analogy / number_series / alphabet_series) carry option_e —
 * requires the option_e columns from supabase/option_e.sql.
 *
 * Structured explanation/explanation_ta objects are flattened to text.
 *
 * Idempotent by external_id ('apt-<file>-q<q_num>').
 *
 * Usage:
 *   node import_logical.mjs                 # DRY RUN (counts only, no writes)
 *   APPLY=1 node import_logical.mjs         # actually insert
 *   node import_logical.mjs <dir>           # override source dir
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = join(__dirname, '..', '..', '..', 'logical')
const argDir = process.argv[2]
const SRC_DIR = argDir ? (isAbsolute(argDir) ? argDir : join(process.cwd(), argDir)) : DEFAULT_DIR
const APPLY = process.env.APPLY === '1'

/** IndiaBix vs Original, from per-question provenance. */
function sourceTag(q) {
  const s = String(q.source ?? '').toLowerCase()
  if (s.includes('indiabix')) return 'IndiaBix'
  if (s.includes('original')) return 'Original'
  if (q.source_url && /indiabix/i.test(q.source_url)) return 'IndiaBix'
  return 'Original'
}

/** Flatten a structured explanation object into readable text. */
function flattenExplanation(ex) {
  if (!ex) return null
  if (typeof ex === 'string') return ex.trim() || null
  const out = []
  if (Array.isArray(ex.given) && ex.given.length) {
    out.push('Given:')
    out.push(...ex.given)
  }
  const fq = ex.from_question
  if (fq) {
    out.push('From question:')
    if (fq.formula) out.push(fq.formula)
    if (Array.isArray(fq.steps)) out.push(...fq.steps)
  }
  if (ex.asked) out.push(`Asked: ${ex.asked}`)
  if (ex.final) out.push(ex.final)
  return out.join('\n').trim() || null
}

const COLS = [
  'category', 'aptitude_type', 'aptitude_topic', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
  'correct_answer', 'explanation', 'images',
  'question_text_ta', 'explanation_ta',
  'source_url', 'source_tag', 'external_id', 'active',
]

function toRow(file, slug, q, index, unresolved) {
  // Rewrite each figure ref → its hosted public URL in the question-images bucket.
  let imgs = null
  if (Array.isArray(q.images) && q.images.length) {
    imgs = q.images.map((ref) => {
      const r = resolveRef(ref, SRC_DIR, index)
      if (!r) { unresolved.push(`${slug} q${q.q_num}: ${ref}`); return ref }
      return publicUrl(r.objectName)
    })
  }
  return {
    category: 'aptitude',
    aptitude_type: file.category, // 'reasoning' | 'numerics'
    aptitude_topic: file.aptitude_topic,
    difficulty: 'medium',
    question_text: q.question_text,
    option_a: q.option_a ?? null,
    option_b: q.option_b ?? null,
    option_c: q.option_c ?? null,
    option_d: q.option_d ?? null,
    option_e: q.option_e ?? null,
    correct_answer: String(q.correct_answer).toUpperCase(),
    explanation: flattenExplanation(q.explanation),
    images: imgs ? JSON.stringify(imgs) : null, // jsonb
    question_text_ta: q.question_text_ta ?? null,
    explanation_ta: flattenExplanation(q.explanation_ta),
    source_url: q.source_url ?? null,
    source_tag: sourceTag(q),
    external_id: `apt-${slug}-q${q.q_num}`,
    active: true,
  }
}

// ─── Load + map ──────────────────────────────────────────────────────────────
const files = readdirSync(SRC_DIR).filter((f) => /\.json$/i.test(f)).sort()
const index = buildImageIndex(SRC_DIR)
const rows = []
const tagCounts = {}
let imgRefs = 0
const unresolved = []

for (const f of files) {
  const obj = JSON.parse(readFileSync(join(SRC_DIR, f), 'utf8'))
  if (!obj || !Array.isArray(obj.questions)) continue // skip non-bank json
  const slug = basename(f, '.json')
  for (const q of obj.questions) {
    rows.push(toRow(obj, slug, q, index, unresolved))
    tagCounts[sourceTag(q)] = (tagCounts[sourceTag(q)] ?? 0) + 1
    imgRefs += (q.images ?? []).length
  }
}

console.log(`Mapped ${rows.length} rows from ${SRC_DIR}`)
console.log(`source_tag (naming): ${JSON.stringify(tagCounts)}`)
const byTopic = {}
for (const r of rows) byTopic[r.aptitude_topic] = (byTopic[r.aptitude_topic] ?? 0) + 1
console.log(`topics: ${Object.keys(byTopic).length} | image refs rewritten to bucket URLs: ${imgRefs - unresolved.length}/${imgRefs}`)
if (unresolved.length) {
  console.error(`⚠ UNRESOLVED image refs (kept as-is — upload first): ${unresolved.length}`)
  unresolved.slice(0, 10).forEach((m) => console.error('   ' + m))
  process.exit(1)
}

// Validation: every correct_answer must reference a present option.
const bad = rows.filter((r) => {
  const letters = ['A', 'B', 'C', 'D']
  if (r.option_e != null && String(r.option_e).trim() !== '') letters.push('E')
  return !letters.includes(r.correct_answer)
})
if (bad.length) {
  console.error(`\nVALIDATION FAILED: ${bad.length} row(s) whose correct_answer has no matching option:`)
  bad.slice(0, 10).forEach((r) => console.error(`  ${r.external_id}: correct=${r.correct_answer}`))
  process.exit(1)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

// Idempotency: skip external_ids already present in the aptitude bank.
const seen = new Set(
  (await c.query(
    "select external_id from public.questions where category='aptitude' and external_id is not null"
  )).rows.map((r) => r.external_id)
)
const toInsert = rows.filter((r) => !seen.has(r.external_id))
console.log(`\nAlready present: ${rows.length - toInsert.length} | to insert: ${toInsert.length}`)

if (!APPLY) {
  console.log('\nDRY RUN — no rows written. Re-run with APPLY=1 to insert.')
  await c.end()
  process.exit(0)
}

const placeholders = COLS.map((_, i) => `$${i + 1}`).join(', ')
const insertSql = `insert into public.questions (${COLS.join(', ')}) values (${placeholders})`
let inserted = 0
for (const r of toInsert) {
  await c.query(insertSql, COLS.map((k) => r[k]))
  inserted++
}
console.log(`\nInserted ${inserted} rows.`)
await c.end()
