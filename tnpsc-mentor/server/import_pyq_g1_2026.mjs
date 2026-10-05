// ─── Load the TNPSC Group 1 2026 prelims paper into public.questions ─────────
//
// The paper was sat on 27 September 2026 and published the same week as PDFs on
// /tnpsc-group-1-answer-key-2026, but it was never loaded into the questions
// table — nothing in that table has year = 2026. So it is absent from PYQ
// practice in the app and from the public archive at /questions/, which is the
// one paper people are searching for most right now.
//
// The source is the workspace those PDFs were built from:
//   parser/Group1/_build2026/batch_all.json   200 questions, English
//   parser/Group1/_build2026/tamil_all.json   the same 200, Tamil
// paired by `qno`, with the four options inside the question string.
//
//   node server/import_pyq_g1_2026.mjs                 dry run, writes nothing
//   node server/import_pyq_g1_2026.mjs --out rows.ndjson   dry run + a row dump
//   STUDIO_USER=… STUDIO_PASSWORD=… node server/import_pyq_g1_2026.mjs --commit
//
// --commit is scoped to this paper's own external_ids and nothing else. On a
// first load that is a pure insert, because year 2026 has no rows at all. Note
// for any RE-run: it deletes those 200 ids before reinserting, and questions.id
// is referenced by user history with ON DELETE CASCADE / SET NULL — see the
// `ca-update-inplace` note. Once students have answered these, prefer an UPDATE.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
// ROOT is .../work/TNPSC/TNPSC-Academy/tnpsc-mentor, and the parser workspace
// is a sibling of TNPSC under work/ — the same place
// scripts/watermark_answer_key_pdfs.py takes its PDFs from. Overridable, since
// it lives outside this repo and may not sit there on another machine.
const SRC = process.env.G1_2026_SRC
  ? resolve(process.env.G1_2026_SRC)
  : resolve(ROOT, '../../../parser/Group1/_build2026')
const ENDPOINT = 'https://db.tnpscmentors.in/api/platform/pg-meta/default/query'

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const OUT = (() => {
  const i = argv.indexOf('--out')
  return i >= 0 && argv[i + 1] ? resolve(ROOT, argv[i + 1]) : null
})()

/**
 * The paper's own unit names, mapped onto the `subject` values the rest of the
 * pyq bank already uses — so the 2026 questions land in the same buckets as
 * 2025's in the app, and resolve to the same units in scripts/qbank/taxonomy.mjs.
 *
 * Aptitude and Reasoning share one subject and are told apart by
 * aptitude_type, which is the convention the existing bank follows.
 */
const UNIT_MAP = {
  'Unit I - General Science': { subject: 'General Science', slug: 'science' },
  'Unit II - Geography of India': { subject: 'Geography', slug: 'geography' },
  'Unit III - History, Culture of India, and Indian National Movement': {
    subject: 'History and INM',
    slug: 'history',
  },
  'Unit IV - Indian Polity': { subject: 'Polity', slug: 'polity' },
  'Unit V - Indian Economy and Development Administration in Tamil Nadu': {
    subject: 'Indian Economy',
    slug: 'economy',
  },
  'Unit VI - History, Culture, Heritage and Socio-Political Movements in Tamil Nadu': {
    subject: 'History Culture Heritage of TN',
    slug: 'tnhistory',
  },
  'Part B, Unit I - Aptitude': { subject: 'Aptitude', slug: 'aptitude', aptitude_type: 'numerics' },
  'Part B, Unit II - Reasoning': { subject: 'Aptitude', slug: 'reasoning', aptitude_type: 'reasoning' },
}

/** Options live inside the question string, each on its own line as "(A) …". */
const OPT_SPLIT = /\n\((A|B|C|D)\)\s*/

function splitOptions(text) {
  const parts = String(text ?? '').split(new RegExp(OPT_SPLIT.source, 'g'))
  const stem = (parts[0] ?? '').trim()
  const opts = {}
  for (let i = 1; i < parts.length; i += 2) opts[parts[i]] = (parts[i + 1] ?? '').trim()
  return { stem, opts }
}

// ─── Read and pair ───────────────────────────────────────────────────────────

const en = JSON.parse(readFileSync(resolve(SRC, 'batch_all.json'), 'utf8'))
const taRaw = JSON.parse(readFileSync(resolve(SRC, 'tamil_all.json'), 'utf8'))
const ta = new Map((Array.isArray(taRaw) ? taRaw : Object.values(taRaw)[0]).map((r) => [r.qno, r]))
console.log(`source: ${en.length} English, ${ta.size} Tamil, from ${SRC}`)

const rows = []
const skipped = []

for (const q of en) {
  const unit = UNIT_MAP[q.unit]
  if (!unit) { skipped.push({ qno: q.qno, why: `unmapped unit ${JSON.stringify(q.unit)}` }); continue }

  const e = splitOptions(q.question)
  const letters = Object.keys(e.opts).sort().join('')
  const key = (String(q.answer ?? '').trim().match(/^\(?([A-D])\)?/) ?? [])[1]

  if (letters !== 'ABCD') {
    // q179 is a figure-only reasoning item whose options are diagrams; the
    // source itself says they are "not reproducible as plain text". It needs a
    // cropped image before it can be a row, so it is reported rather than
    // guessed at.
    skipped.push({ qno: q.qno, why: `options are ${letters || 'absent'} — needs a figure` })
    continue
  }
  if (!key) { skipped.push({ qno: q.qno, why: `no keyed answer in ${JSON.stringify(String(q.answer).slice(0, 40))}` }); continue }

  const t = ta.get(q.qno)
  const tam = t ? splitOptions(t.question) : null

  rows.push({
    external_id: `pyq-${unit.slug}-2026_Q${q.qno}`,
    category: 'pyq',
    year: 2026,
    subject: unit.subject,
    aptitude_type: unit.aptitude_type ?? null,
    question_text: e.stem,
    option_a: e.opts.A, option_b: e.opts.B, option_c: e.opts.C, option_d: e.opts.D,
    correct_answer: key,
    explanation: String(q.explanation ?? '').trim() || null,
    question_text_ta: tam?.stem || null,
    option_a_ta: tam?.opts.A ?? null, option_b_ta: tam?.opts.B ?? null,
    option_c_ta: tam?.opts.C ?? null, option_d_ta: tam?.opts.D ?? null,
    explanation_ta: t ? String(t.explanation ?? '').trim() || null : null,
    difficulty: 'medium',
    active: true,
  })
}

// ─── Report ──────────────────────────────────────────────────────────────────

const bySubject = new Map()
for (const r of rows) bySubject.set(r.subject, (bySubject.get(r.subject) ?? 0) + 1)
console.log(`\nready to load: ${rows.length}   skipped: ${skipped.length}`)
for (const [s, c] of [...bySubject].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}  ${s}`)
const bilingual = rows.filter((r) => r.question_text_ta).length
console.log(`\nbilingual: ${bilingual} / ${rows.length}   with explanation: ${rows.filter((r) => r.explanation).length}`)
for (const s of skipped) console.log(`  SKIPPED q${s.qno}: ${s.why}`)

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`\nwrote ${OUT}`)
}

if (!COMMIT) {
  console.log('\nDry run — the database was not contacted. Add --commit to load.')
  process.exit(0)
}

// ─── Load ────────────────────────────────────────────────────────────────────
// Postgres is firewalled and PostgREST is 403 at nginx, so writes go through
// Studio's pg-meta endpoint, the same route the other loaders use.

const password = process.env.STUDIO_PASSWORD
if (!password) { console.error('STUDIO_PASSWORD is not set. Refusing to run.'); process.exit(1) }
const auth = 'Basic ' + Buffer.from(`${process.env.STUDIO_USER || 'tnpscadmin'}:${password}`).toString('base64')

async function sql(query, label) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 300)}`)
  const json = JSON.parse(text)
  if (json?.error) throw new Error(`${label}: ${JSON.stringify(json.error).slice(0, 300)}`)
  return json
}

const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const COLS = [
  'external_id', 'category', 'year', 'subject', 'aptitude_type',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer',
  'explanation', 'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta',
  'option_d_ta', 'explanation_ta', 'difficulty', 'active',
]

const before = await sql(`select count(*)::int as n from public.questions where year = 2026`, 'before')
console.log(`\nrows with year 2026 before: ${before[0].n}`)

for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50)
  const ids = batch.map((r) => lit(r.external_id)).join(', ')
  const values = batch
    .map((r) => `(${COLS.map((c) => (c === 'year' ? r.year : c === 'active' ? r.active : lit(r[c]))).join(', ')})`)
    .join(',\n')
  await sql(
    `delete from public.questions where category = 'pyq' and external_id in (${ids});
     insert into public.questions (${COLS.join(', ')}) values\n${values};`,
    `batch ${i / 50 + 1}`,
  )
  console.log(`  loaded ${Math.min(i + 50, rows.length)} / ${rows.length}`)
}

const after = await sql(
  `select count(*)::int as n, count(*) filter (where active)::int as live
     from public.questions where year = 2026`,
  'after',
)
console.log(`\nrows with year 2026 now: ${after[0].n} (${after[0].live} active)`)
console.log('Next: re-run scripts/qbank/export.mjs, build.mjs and verify.mjs to put them on the archive.')
