import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, existsSync } from 'node:fs'

/**
 * Loads the consolidated Previous-Year-Question bank into the live DB.
 *
 *   pyq_all/TNPSC_AllYears_<Subject>.json   (10 subject files, all years)
 *
 * Stored under category='pyq', surfaced by the Previous Year page which drills
 * group -> subject (-> topic for Aptitude). PYQ uses the subject-membership
 * model: rows carry no group_type; a question appears under any group whose
 * syllabus includes its subject (see get_quiz_questions / GROUP_SUBJECTS).
 *
 * Each row's `subject` is mapped to the EXACT string the frontend pills emit
 * (src/lib/constants.ts SUBJECTS) so the get_quiz_questions RPC matches.
 *
 * Idempotent by external_id (`pyq-<subjectSlug>-<qid>`). Rows whose source
 * marked_answer is null/non-letter are skipped (we never serve an unknown key).
 * Safe dry-run by default; APPLY=1 to write.
 *   node import_pyq.mjs           # dry-run: counts only
 *   APPLY=1 node import_pyq.mjs   # insert
 */

const ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/pyq_all'
const Q_ROOT = `${ROOT}/Questions`
const APPLY = process.env.APPLY === '1'

// JSON filename -> { subject: exact frontend label, slug: external_id namespace, explFile: explanation lookup }
const FILES = {
  'TNPSC_AllYears_History.json': { subject: 'History and INM', slug: 'history', explFile: 'History_explanations.json' },
  'TNPSC_AllYears_Polity.json': { subject: 'Polity', slug: 'polity', explFile: 'Polity_explanations.json' },
  'TNPSC_AllYears_Geography.json': { subject: 'Geography', slug: 'geography', explFile: 'Geography_explanations.json' },
  'TNPSC_AllYears_Culture.json': { subject: 'History Culture Heritage of TN', slug: 'culture', explFile: 'Culture_explanations.json' },
  'TNPSC_AllYears_Development_Administration.json': { subject: 'Development Administration of TamilNadu', slug: 'devadmin', explFile: 'Development_Administration_explanations.json' },
  'TNPSC_AllYears_Biology.json': { subject: 'Biology', slug: 'biology', explFile: 'Biology_explanations.json' },
  'TNPSC_AllYears_Physics.json': { subject: 'Physics', slug: 'physics', explFile: 'Physics_explanations.json' },
  'TNPSC_AllYears_Chemistry.json': { subject: 'Chemistry', slug: 'chemistry', explFile: 'Chemistry_explanations.json' },
  'TNPSC_AllYears_Economics.json': { subject: 'Indian Economy', slug: 'economics', explFile: 'Economics_explanations.json' },
  // Aptitude lives in AllYears/ (already has inline explanations)
  'TNPSC_AllYears_Aptitude.json': { subject: 'Aptitude', slug: 'aptitude', explFile: null, qDir: 'c:/Users/mas20/Desktop/work/TNPSC/AllYears' },
}

const clean = (v) => (v == null ? null : String(v).trim() || null)
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

function diff(d) {
  const s = String(d || '').toLowerCase()
  if (s.includes('low') || s.includes('easy')) return 'easy'
  if (s.includes('high') || s.includes('hard')) return 'hard'
  return 'medium'
}

// Remove trailing lines "(X) text" from a stem ONLY when text exactly matches
// the structured option[x] value — strips duplicated options without touching
// matching-list / statement stems (whose (a)(b).. lines are part of the body).
function stripEmbeddedOptions(text, opts) {
  if (!text) return text
  const lines = String(text).split('\n')
  let end = lines.length
  while (end > 0) {
    const m = lines[end - 1].trim().match(/^\(([A-Da-d])\)\s*(.+)$/)
    if (!m) break
    const letter = m[1].toLowerCase()
    if (norm(m[2]) !== norm(opts?.[letter])) break
    end--
  }
  return lines.slice(0, end).join('\n').trim()
}

const rows = []
const summary = {}
let skippedNoAnswer = 0
const skippedSamples = []

for (const [file, { subject, slug, explFile, qDir }] of Object.entries(FILES)) {
  const qPath = `${qDir ?? Q_ROOT}/${file}`
  const ePath = explFile ? `${ROOT}/${explFile}` : null
  if (!existsSync(qPath)) {
    console.error(`  ! missing file: ${file}`)
    summary[subject] = 0
    continue
  }
  const arr = JSON.parse(readFileSync(qPath, 'utf8'))
  const explMap = (ePath && existsSync(ePath)) ? JSON.parse(readFileSync(ePath, 'utf8')) : {}
  let kept = 0
  arr.forEach((q) => {
    const ans = String(q.marked_answer ?? '').trim().toUpperCase()
    if (!/^[ABCD]$/.test(ans)) {
      skippedNoAnswer++
      if (skippedSamples.length < 12) skippedSamples.push(`${slug}/${q.qid}`)
      return
    }
    const opts = q.options || {}
    const optsTa = q.options_ta || {}
    // Explanation: two formats in the file —
    //   { opts: { a: {en,ta}, … } }  → per-option (use correct option)
    //   { type, expl: {en,ta} }       → question-level (single explanation)
    // Fallback to inline q.explanation if neither is present.
    const eEntry = explMap[q.qid]
    let explanation, explanation_ta
    if (eEntry?.opts) {
      const opt = eEntry.opts[ans.toLowerCase()]
      explanation = clean(opt?.en ?? q.explanation)
      explanation_ta = clean(opt?.ta ?? null)
    } else if (eEntry?.expl) {
      explanation = clean(eEntry.expl.en ?? q.explanation)
      explanation_ta = clean(eEntry.expl.ta ?? null)
    } else {
      explanation = clean(q.explanation)
      explanation_ta = null
    }
    rows.push({
      category: 'pyq',
      subject,
      year: Number.isFinite(q.year) ? q.year : null,
      topic: clean(q.topic),
      external_id: `pyq-${slug}-${q.qid}`,
      difficulty: diff(q.difficulty),
      question_text: stripEmbeddedOptions(clean(q.question_text), opts),
      option_a: clean(opts.a),
      option_b: clean(opts.b),
      option_c: clean(opts.c),
      option_d: clean(opts.d),
      correct_answer: ans,
      explanation,
      explanation_ta,
      question_text_ta: stripEmbeddedOptions(clean(q.question_text_ta), optsTa),
      option_a_ta: clean(optsTa.a),
      option_b_ta: clean(optsTa.b),
      option_c_ta: clean(optsTa.c),
      option_d_ta: clean(optsTa.d),
      source_url: 'tnpsc-official',
      active: true,
    })
    kept++
  })
  summary[subject] = kept
}

console.table(summary)
console.log(`Total rows prepared: ${rows.length}  | Skipped (null answer): ${skippedNoAnswer} [${skippedSamples.join(', ')}]  | Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

// Guard: every row must have the four options and a stem (DB has NOT NULL on them).
const bad = rows.filter((r) => !r.question_text || !r.option_a || !r.option_b || !r.option_c || !r.option_d)
if (bad.length) {
  console.error(`\n! ${bad.length} rows missing required content (stem/options). First:`, bad[0].external_id)
  process.exit(1)
}

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to insert.')
  process.exit(0)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})
await c.connect()
console.log('Connected.')

const COLS = [
  'category', 'subject', 'year', 'topic', 'external_id', 'difficulty',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'explanation_ta',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'source_url', 'active',
]

try {
  await c.query('begin')
  const ids = rows.map((r) => r.external_id)
  const del = await c.query(
    `delete from questions where category='pyq' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`Removed ${del.rowCount} pre-existing pyq rows with same external_id.`)

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const values = []
    const params = []
    let p = 1
    for (const r of batch) {
      const ph = COLS.map((col) => {
        params.push(r[col])
        return `$${p++}`
      })
      values.push(`(${ph.join(',')})`)
    }
    const sql = `insert into questions (${COLS.join(',')}) values ${values.join(',')}`
    const res = await c.query(sql, params)
    inserted += res.rowCount
    process.stdout.write(`\r  inserted ${inserted}/${rows.length}`)
  }
  console.log('')
  await c.query('commit')
  console.log('COMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.table(
  (await c.query(`select category, count(*)::int n from questions group by category order by category`)).rows
)
console.table(
  (await c.query(`select subject, count(*)::int n, min(year) miny, max(year) maxy from questions where category='pyq' group by subject order by subject`)).rows
)
await c.end()
