import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Loads the Group 2 / 2A Previous-Year-Question bank into the live DB under
 * category='pyq2' (kept apart from the Group 1 category='pyq' bank).
 *
 *   Group_2/<year>/general_studies/<Subject>.json   (bilingual EN+TA)
 *   Group_2/<year>/general_english/<Skill>.json      (EN only)
 *   Group_2/<year>/general_tamil/<Skill>.json        (TA only)
 *
 * Row mapping (drives the Group 2 picker: section -> All + sub-type -> year):
 *   subject = SECTION  : 'Aptitude' | 'English' | 'Tamil' | 'General Studies'
 *   topic   = SUB-TYPE : English/Tamil skill area, or a GS subject name
 *   aptitude_type      : 'numerics' | 'reasoning'  (Aptitude rows only)
 *   year    : the exam year (shown as a badge + drives the year filter)
 *
 * Monolingual sections store their single language in the PRIMARY columns
 * (question_text, option_a..d, explanation) and leave the _ta columns null — the
 * app's display helpers fall back to the primary, so a Tamil-only question
 * renders Tamil in every language mode (there is no English version to show).
 *
 * Idempotent by external_id (`pyq2-<group>-<year>-<code>-<q_no>`): re-running
 * deletes the same external_ids then re-inserts, so user history (FK to id) on
 * untouched rows is preserved. Rows whose answer letter is missing, or whose
 * four options aren't all present (e.g. figure-only questions), are skipped.
 *
 * A row that IS re-imported gets a NEW id, and the FKs that point at questions
 * cascade (bookmarks, seen_questions, the SRS deck) — so re-running over a year
 * that is already live silently wipes that user history. When adding a year,
 * always scope the run with YEARS so the existing years are left untouched.
 *
 *   node import_pyq2.mjs                          # dry-run: counts only
 *   YEARS=2013,2015 node import_pyq2.mjs          # dry-run, just those years
 *   YEARS=2013,2015 APPLY=1 node import_pyq2.mjs  # insert just those years
 */

const ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/Group_2'
const IMG_ROOT = `${ROOT}/_img`
const APPLY = process.env.APPLY === '1'
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const BUCKET = 'question-images'

// A question's figure crop, by convention `_img/<year>/q<q_no>.png`, resolved to
// its public bucket URL (uploaded separately by upload_pyq2_images.mjs). Returns
// the images jsonb value (array of one URL) or null when no crop exists. Setting
// it here keeps figures attached across re-imports instead of needing a re-patch.
function imageFor(year, qno) {
  const local = join(IMG_ROOT, String(year), `q${qno}.png`)
  if (!existsSync(local)) return null
  return [`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/pyq2/${year}/q${qno}.png`]
}

// Per-option figures, by convention `_img/<year>/q<q_no>_<a|b|c|d>.png`. Returns
// a {A,B,C,D} map of public URLs for the letters that have a crop, or null when
// none (a letter without a crop keeps its text — e.g. q154 D = "None of these").
function optionImagesFor(year, qno) {
  const out = {}
  for (const l of ['a', 'b', 'c', 'd']) {
    if (existsSync(join(IMG_ROOT, String(year), `q${qno}_${l}.png`))) {
      out[l.toUpperCase()] = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/pyq2/${year}/q${qno}_${l}.png`
    }
  }
  return Object.keys(out).length ? out : null
}

// Placeholder option labels for image-option questions (non-verbal series whose
// four options ARE figures, so the source has empty option text). The combined
// crop shows the labelled options; the letter badge + this text make the four
// choices selectable.
const FIGURE_OPTIONS = ['(A)', '(B)', '(C)', '(D)']

// Folder -> section subject. general_studies splits: APT -> Aptitude, rest -> GS.
const GROUP_DIRS = {
  general_studies: 'gs',
  general_english: 'en',
  general_tamil: 'ta',
}

// subject_code -> { subject (section), topic (sub-type) }. APT is special-cased.
const ENGLISH_TOPIC = { EGRAM: 'Grammar', EVOCAB: 'Vocabulary', ELIT: 'Literature', ECOMP: 'Comprehension' }
const TAMIL_TOPIC = {
  TGRAM: 'Grammar',
  TVOCAB: 'Vocabulary',
  TLIT: 'Literature',
  TAUTH: 'Author & Work',
  TLANGHIST: 'Language History',
  TGK: 'Tamil GK',
}
const GS_TOPIC = {
  BIO: 'Biology',
  PHY: 'Physics',
  CHE: 'Chemistry',
  HIST: 'History',
  GEO: 'Geography',
  POL: 'Polity',
  ECO: 'Economics',
  CULT: 'Culture',
  DEVADM: 'Development Administration',
  CURGK: 'Current Affairs & GK',
}

// Reasoning-style aptitude concepts (everything else is treated as numerics).
const REASONING_HINT =
  /series|dice|direction|blood relation|clock|calendar|coding|syllog|figure|analogy|ranking|seating|missing number|data interpretation|venn|non-verbal|reasoning|inference|puzzle|arrangement|cube|odd one|mirror|water image|embedded/i

function aptitudeType(q) {
  const qt = String(q.question_type ?? '')
  if (/reason|inference/i.test(qt)) return 'reasoning'
  if (/calculate|calculation/i.test(qt)) {
    // "Calculate" is numeric UNLESS the concept is clearly a reasoning pattern.
    return REASONING_HINT.test(String(q.subject_concept ?? '')) ? 'reasoning' : 'numerics'
  }
  return REASONING_HINT.test(`${q.subject_concept ?? ''} ${qt}`) ? 'reasoning' : 'numerics'
}

const clean = (v) => (v == null ? null : String(v).trim() || null)

// Whether a stem is a "match the following" with BOTH lists inline — so the UI
// can render List I / List II side-by-side (QuestionStem's two-column layout,
// gated on question_type='match'). Requires two labelled lists (≥2 alpha items +
// ≥2 numeric items) plus a match cue (wording or a List/Column header, EN or TA).
// Over-tagging is safe: QuestionStem falls back to plain text when the parser
// can't split the stem (e.g. when the second list lives in the options).
// Some match stems are stored fully inline (no newlines), e.g.
// "Match the following Column A (a) X (b) Y Column B 1. P 2. Q" — neither the
// detector nor the side-by-side parser can split them. When a stem has NO
// newlines AND clearly carries two lists (Column A…Column B or List I…List II),
// break the headers and (a)/1. labels onto their own lines so it renders as two
// columns. Conservative: only fires on inline two-list stems, leaving every
// already-multiline stem (the common case) untouched.
function normalizeMatchStem(text) {
  if (!text || /\n/.test(text)) return text
  const twoList =
    /column\s*a\b[\s\S]*column\s*b\b/i.test(text) ||
    /list\s*-?\s*i\b[\s\S]*list\s*-?\s*ii\b/i.test(text)
  if (!twoList) return text
  return text
    .replace(/\s*(Column\s*[AB]|List\s*-?\s*I{1,2})\b/gi, '\n$1') // headers
    .replace(/\s*(\([a-eA-E]\))\s*/g, '\n$1 ') // (a)-(e) item labels
    .replace(/\s+([1-9]\.)\s+/g, '\n$1 ') // 1.-9. item labels (single digit only)
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n/, '')
    .trim()
}

function looksLikeMatch(text) {
  if (!text) return false
  const alpha = (text.match(/(?:^|\n)\s*\(?[a-eA-E]\)?\s*[).]\s+\S/g) || []).length
  const num = (text.match(/(?:^|\n)\s*\(?[1-5]\)?\s*[).]\s+\S/g) || []).length
  if (alpha < 2 || num < 2) return false
  return /\bmatch\b|column\s*[-–]?\s*[abi]|list\s*[-–]?\s*i|பொருத்த|நெடுவரிசை|பட்டியல்/i.test(text)
}

// Explanation is either a per-option object { A:.., B:.. } or a single string.
// Pick the correct option's text for the per-option form; pass strings through.
function pickExplanation(expl, letter) {
  if (expl == null) return null
  if (typeof expl === 'string') return clean(expl)
  if (typeof expl === 'object') return clean(expl[letter] ?? expl[letter?.toLowerCase?.()] ?? null)
  return null
}

const rows = []
const summary = {}
let skipped = 0
const skipSamples = []

// Optional YEARS=2013,2015 filter — scopes the run to the named exam years so a
// year that is already live is not deleted + reinserted (see header note).
const ONLY_YEARS = (process.env.YEARS || '')
  .split(',')
  .map((y) => y.trim())
  .filter(Boolean)

const years = readdirSync(ROOT)
  .filter((d) => /^\d{4}$/.test(d))
  .filter((d) => ONLY_YEARS.length === 0 || ONLY_YEARS.includes(d))
  .sort()

if (ONLY_YEARS.length && years.length !== ONLY_YEARS.length) {
  console.error(`! YEARS names a year with no folder under ${ROOT}: got [${years.join(', ')}]`)
  process.exit(1)
}
console.log(`Years: ${years.join(', ')}`)

for (const year of years) {
  for (const [dir, group] of Object.entries(GROUP_DIRS)) {
    const dirPath = join(ROOT, year, dir)
    if (!existsSync(dirPath)) continue
    for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.json'))) {
      const arr = JSON.parse(readFileSync(join(dirPath, file), 'utf8'))
      for (const q of arr) {
        const code = String(q.subject_code ?? '').toUpperCase()
        const letter = String(q.correct_answer_letter ?? '').trim().toUpperCase()

        // Resolve section (subject) + sub-type (topic) + aptitude_type.
        let subject, topic, aptType = null
        if (group === 'en') {
          subject = 'English'
          topic = ENGLISH_TOPIC[code] ?? 'Grammar'
        } else if (group === 'ta') {
          subject = 'Tamil'
          topic = TAMIL_TOPIC[code] ?? 'Grammar'
        } else if (code === 'APT') {
          subject = 'Aptitude'
          topic = clean(q.subject_concept) // micro-topic, shown as a badge only
          aptType = aptitudeType(q)
        } else {
          subject = 'General Studies'
          topic = GS_TOPIC[code] ?? clean(q.subject)
        }

        // Language columns: GS + Aptitude are bilingual; English/Tamil are mono
        // and store their one language in the PRIMARY columns.
        const bilingual = group === 'gs'
        const oEn = q.options_en ?? {}
        const oTa = q.options_ta ?? {}
        let qText, oa, ob, oc, od, expl
        let qTextTa = null, oaTa = null, obTa = null, ocTa = null, odTa = null, explTa = null
        if (group === 'ta') {
          qText = clean(q.question_ta)
          oa = clean(oTa.A); ob = clean(oTa.B); oc = clean(oTa.C); od = clean(oTa.D)
          expl = pickExplanation(q.explanation_ta, letter)
        } else {
          qText = clean(q.question_en)
          oa = clean(oEn.A); ob = clean(oEn.B); oc = clean(oEn.C); od = clean(oEn.D)
          expl = pickExplanation(q.explanation_en, letter)
          if (bilingual) {
            qTextTa = clean(q.question_ta)
            oaTa = clean(oTa.A); obTa = clean(oTa.B); ocTa = clean(oTa.C); odTa = clean(oTa.D)
            explTa = pickExplanation(q.explanation_ta, letter)
          }
        }

        // Break fully-inline "match" stems onto multiple lines so they render
        // as two columns (no-op for already-multiline stems).
        qText = normalizeMatchStem(qText)
        if (qTextTa) qTextTa = normalizeMatchStem(qTextTa)

        const imgs = imageFor(year, q.q_no)
        const optImgs = optionImagesFor(year, q.q_no)

        // Image-option question: options are figures (empty text) but the
        // question has option crops — substitute selectable letter labels so it
        // imports instead of being skipped (the figure renders in the button).
        if (q.has_figure === true && (imgs || optImgs) && !(oa && ob && oc && od)) {
          ;[oa, ob, oc, od] = FIGURE_OPTIONS
        }

        const reason =
          !/^[ABCD]$/.test(letter) ? 'no-answer'
          : !qText ? 'no-stem'
          : !(oa && ob && oc && od) ? 'missing-option'
          : null
        if (reason) {
          skipped++
          if (skipSamples.length < 15) skipSamples.push(`${year}/${group}/${code}#${q.q_no} (${reason})`)
          continue
        }

        rows.push({
          category: 'pyq2',
          subject,
          topic,
          aptitude_type: aptType,
          year: Number.isFinite(q.year) ? q.year : Number(year),
          external_id: `pyq2-${group}-${year}-${code}-${q.q_no}`,
          difficulty: 'medium',
          // Two-list "match" stems render side-by-side via the 'match' renderer —
          // tag from the source label OR the structural shape of the stem.
          question_type:
            /match|pair/i.test(String(q.question_type ?? '')) || looksLikeMatch(qText)
              ? 'match'
              : null,
          question_text: qText,
          option_a: oa, option_b: ob, option_c: oc, option_d: od,
          images: imgs ? JSON.stringify(imgs) : null,
          option_images: optImgs ? JSON.stringify(optImgs) : null,
          correct_answer: letter,
          explanation: expl,
          explanation_ta: explTa,
          question_text_ta: qTextTa,
          option_a_ta: oaTa, option_b_ta: obTa, option_c_ta: ocTa, option_d_ta: odTa,
          source_url: 'tnpsc-official',
          active: true,
        })
        const key = `${subject}${topic ? ' › ' + topic : ''}`
        summary[key] = (summary[key] ?? 0) + 1
      }
    }
  }
}

console.table(summary)
console.log(
  `Total rows: ${rows.length} | Skipped: ${skipped} [${skipSamples.join(', ')}] | Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`
)

// Guard: every row must satisfy the DB NOT NULLs.
const bad = rows.filter((r) => !r.question_text || !r.option_a || !r.option_b || !r.option_c || !r.option_d)
if (bad.length) {
  console.error(`! ${bad.length} rows missing required content. First:`, bad[0].external_id)
  process.exit(1)
}
// Guard: external_id must be unique within this batch.
const seen = new Set()
const dupes = []
for (const r of rows) {
  if (seen.has(r.external_id)) dupes.push(r.external_id)
  seen.add(r.external_id)
}
if (dupes.length) {
  console.error(`! ${dupes.length} duplicate external_ids. First:`, dupes.slice(0, 5))
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
  'category', 'subject', 'topic', 'aptitude_type', 'year', 'external_id', 'difficulty',
  'question_type', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'images', 'option_images',
  'correct_answer', 'explanation', 'explanation_ta',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'source_url', 'active',
]

try {
  await c.query('begin')
  const ids = rows.map((r) => r.external_id)
  const del = await c.query(
    `delete from questions where category='pyq2' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`Removed ${del.rowCount} pre-existing pyq2 rows with same external_id.`)

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
  (await c.query(
    `select subject, count(*)::int n, min(year) miny, max(year) maxy
     from questions where category='pyq2' group by subject order by subject`
  )).rows
)
await c.end()
