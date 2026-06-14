import { Client } from 'pg'
import { readFileSync } from 'node:fs'

/**
 * One-off importer for AllYears/TNPSC_AllYears_Aptitude.json.
 * - Tags each row source_url='tnpsc-official' and active=true.
 * - Remaps difficulty 'low' -> 'easy' (DB check allows only easy/medium/hard).
 * - Dedupes against existing rows already tagged tnpsc-official (idempotent rerun).
 *
 * Usage: node import_aptitude.mjs <path-to-json>
 */

const file = process.argv[2]
if (!file) {
  console.error('usage: node import_aptitude.mjs <file.json>')
  process.exit(2)
}

const DIFF_MAP = { low: 'easy', easy: 'easy', medium: 'medium', hard: 'hard' }
const COLS = [
  'category', 'aptitude_type', 'aptitude_topic', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'why_wrong',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'explanation_ta', 'source_url', 'active',
]

const raw = JSON.parse(readFileSync(file, 'utf8'))
const rows = raw.map((q) => ({
  category: q.category,
  aptitude_type: q.aptitude_type ?? null,
  aptitude_topic: q.aptitude_topic ?? null,
  difficulty: DIFF_MAP[String(q.difficulty || 'medium').toLowerCase()] ?? 'medium',
  question_text: q.question_text,
  option_a: q.option_a,
  option_b: q.option_b,
  option_c: q.option_c,
  option_d: q.option_d,
  correct_answer: String(q.correct_answer).toUpperCase(),
  explanation: q.explanation ?? null,
  why_wrong: q.why_wrong ? JSON.stringify(q.why_wrong) : null,
  question_text_ta: q.question_text_ta ?? null,
  option_a_ta: q.option_a_ta ?? null,
  option_b_ta: q.option_b_ta ?? null,
  option_c_ta: q.option_c_ta ?? null,
  option_d_ta: q.option_d_ta ?? null,
  explanation_ta: q.explanation_ta ?? null,
  source_url: 'tnpsc-official',
  active: true,
}))

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

// Idempotency: skip texts already imported under the tnpsc-official tag.
const seen = new Set(
  (await c.query(
    "select question_text from public.questions where source_url='tnpsc-official' and category='aptitude'"
  )).rows.map((r) => (r.question_text || '').trim())
)

let inserted = 0, skipped = 0
const placeholders = COLS.map((_, i) => `$${i + 1}`).join(', ')
const insertSql = `insert into public.questions (${COLS.join(', ')}) values (${placeholders})`

for (const r of rows) {
  if (seen.has((r.question_text || '').trim())) { skipped++; continue }
  await c.query(insertSql, COLS.map((k) => r[k]))
  seen.add((r.question_text || '').trim())
  inserted++
}

console.log(`file rows: ${rows.length} | inserted: ${inserted} | skipped (dup): ${skipped}`)
await c.end()
