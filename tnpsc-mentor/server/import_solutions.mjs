import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

/**
 * Importer for the curated `solutions/` aptitude bank (TNPSC/solutions/*.json).
 *
 * Each file is one topic: { category: 'reasoning'|'numerics', aptitude_topic,
 * questions: [...] }. Per question the `explanation`/`explanation_ta` are
 * STRUCTURED objects ({ given[], from_question{formula,steps[]}, asked, final });
 * we serialise them into the header-line text ("Given:/From question:/Asked:" +
 * trailing "→ Option (X)") that the frontend's parseSolution() already renders.
 *
 * Figures (q.images) are mapped to public URLs in the Supabase Storage bucket
 * `question-images` and stored in the new `images` jsonb column.
 *
 * Loads as category='aptitude', source_url='tnpsc-solutions'. Idempotent:
 * dedupes by question_text within that tag.
 *
 * Usage: node import_solutions.mjs            (uses ../../../../solutions)
 *        node import_solutions.mjs <dir>
 */

const SOL_DIR = process.argv[2] ?? 'C:/Users/mas20/Desktop/work/TNPSC/solutions'
const BUCKET_BASE = `${process.env.SUPABASE_URL}/storage/v1/object/public/question-images`

const OPTION_RE = /option\s*\(?\s*([A-D])\s*\)?/i

/** Flatten a structured explanation object into header-line solution text. */
function flattenExplanation(ex) {
  if (!ex) return null
  if (typeof ex === 'string') return ex.trim() || null
  const out = []
  const given = Array.isArray(ex.given) ? ex.given : (ex.given ? [ex.given] : [])
  if (given.length) {
    out.push('Given:')
    given.forEach((g) => out.push(String(g)))
  }
  const fq = ex.from_question
  if (fq) {
    out.push('From question:')
    if (fq.formula) out.push(String(fq.formula))
    const steps = Array.isArray(fq.steps) ? fq.steps : (fq.steps ? [fq.steps] : [])
    steps.forEach((s) => out.push(String(s)))
  }
  if (ex.asked || ex.final) {
    out.push('Asked:')
    if (ex.asked) out.push(String(ex.asked))
    if (ex.final) out.push(String(ex.final))
  }
  const text = out.join('\n').trim()
  return text || null
}

/** Public URL for a figure given its `images/<file>` ref in the JSON. */
function imageUrl(ref) {
  return `${BUCKET_BASE}/${basename(String(ref))}`
}

const files = readdirSync(SOL_DIR).filter((f) => f.endsWith('.json'))
const COLS = [
  'category', 'aptitude_type', 'aptitude_topic', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'explanation_ta',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'images', 'source_url', 'active',
]

const rows = []
let skippedNoAnswer = 0
for (const f of files) {
  const d = JSON.parse(readFileSync(join(SOL_DIR, f), 'utf8'))
  const aptitude_type = d.category === 'reasoning' || d.category === 'numerics' ? d.category : null
  for (const q of d.questions ?? []) {
    let ca = q.correct_answer ? String(q.correct_answer).toUpperCase() : null
    if (!ca) {
      const m = (q.explanation?.final || '').match(OPTION_RE)
      ca = m ? m[1].toUpperCase() : null
    }
    if (!ca || !'ABCD'.includes(ca)) { skippedNoAnswer++; continue }
    const images = Array.isArray(q.images) && q.images.length ? q.images.map(imageUrl) : null
    rows.push({
      category: 'aptitude',
      aptitude_type,
      aptitude_topic: d.aptitude_topic ?? null,
      difficulty: 'medium',
      question_text: q.question_text,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_answer: ca,
      explanation: flattenExplanation(q.explanation),
      explanation_ta: flattenExplanation(q.explanation_ta),
      question_text_ta: q.question_text_ta ?? null,
      option_a_ta: q.option_a_ta ?? null, option_b_ta: q.option_b_ta ?? null,
      option_c_ta: q.option_c_ta ?? null, option_d_ta: q.option_d_ta ?? null,
      images: images ? JSON.stringify(images) : null,
      source_url: 'tnpsc-solutions',
      active: true,
    })
  }
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
})
await c.connect()

// Dedupe key = question_text + images. Figure questions (e.g. "Find how many
// triangles…") repeat verbatim with DIFFERENT figures, so text alone collapses
// distinct questions — the image set disambiguates them.
const keyOf = (text, images) =>
  `${(text || '').trim()}${normImgs(images)}`
const normImgs = (images) =>
  images == null ? '' : (typeof images === 'string' ? images : JSON.stringify(images))
const seen = new Set(
  (await c.query(
    "select question_text, images from public.questions where source_url='tnpsc-solutions' and category='aptitude'"
  )).rows.map((r) => keyOf(r.question_text, r.images))
)

// images is jsonb -> cast its placeholder; everything else is text/bool.
const placeholders = COLS.map((col, i) => (col === 'images' ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')
const insertSql = `insert into public.questions (${COLS.join(', ')}) values (${placeholders})`

let inserted = 0, skipped = 0, withImages = 0
for (const r of rows) {
  const key = keyOf(r.question_text, r.images)
  if (seen.has(key)) { skipped++; continue }
  await c.query(insertSql, COLS.map((k) => r[k]))
  seen.add(key)
  inserted++
  if (r.images) withImages++
}

console.log(`files: ${files.length} | rows built: ${rows.length} | inserted: ${inserted} | skipped(dup): ${skipped} | skipped(no answer): ${skippedNoAnswer} | with images: ${withImages}`)
await c.end()
