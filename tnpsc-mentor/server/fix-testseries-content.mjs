import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

/**
 * Repairs three display defects in the scheduled Test Series bank
 * (category='testseries'), all caused by inconsistent authoring:
 *
 *  1. MATCH -> two columns: tag "Match List I / List II" questions with
 *     question_type='match' so QuestionStem renders them side-by-side (the
 *     client parser is still the final gate). Also de-dupes one row whose
 *     "List II" header is repeated, which broke the parse.
 *
 *  2. POWERS -> superscripts: exponents authored as bare carets (2^5, cm^3,
 *     (23/20)^3, 2^(5+3)) never reach KaTeX (no dollar delimiter), so they
 *     showed literally. Rewrite them to Unicode superscripts, matching the
 *     bank's existing 5-squared / CO2 style -- no italic units, works in Tamil.
 *     One logarithm row is hand-typeset in KaTeX instead.
 *
 * (The literal-currency "$100 billion" garbling -- the "missing explanations"
 * report -- is fixed at the render layer in MathText.tsx, not here.)
 *
 * Dry-run by default; APPLY=1 writes inside one transaction.
 */

const APPLY = process.env.APPLY === '1'
const D = String.fromCharCode(36) // literal dollar sign, kept out of source

const c = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
})

const TEXT_COLS = [
  'question_text', 'question_text_ta',
  'option_a', 'option_b', 'option_c', 'option_d',
  'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'explanation', 'explanation_ta',
]

// ── #1 match detection (same logic validated against the live bank) ──────────
const isMatchText = (q) => /List\s*I\b/i.test(q) && /List\s*II\b/i.test(q)

// ── #2 caret -> Unicode superscript ──────────────────────────────────────────
const SUP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '(': '⁽', ')': '⁾',
}
const supize = (s) => [...s].map((ch) => SUP[ch] ?? ch).join('')

function fixCarets(text) {
  if (!text || !text.includes('^')) return text
  // Never touch a field that already carries authored LaTeX (dollar spans).
  if (text.includes(D)) return text
  // Parenthesised simple exponent first: ^(5+3), ^(-4)
  let t = text.replace(/\^\(([-−+\d()]+)\)/g, (_, g) => supize('(' + g + ')'))
  // Bare digit exponent: ^2, ^12
  t = t.replace(/\^(\d+)/g, (_, g) => supize(g))
  return t
}

const hasSup = (s) => /[⁰¹²³⁴-⁹⁺⁻⁽⁾]/.test(s)

// ── Row-specific fixes ───────────────────────────────────────────────────────
const DUP_LIST_ID = '77ce8680-1e26-4f47-b740-9080922ab0cb'
const LOG_ID = 'fa6ff9b5-ceed-46bd-badc-c2ceeabc132d'
const LOG_LATEX =
  D + '25^{-2\\log_5 3} = (5^2)^{-2\\log_5 3} = 5^{-4\\log_5 3} = 5^{\\log_5 3^{-4}} = 3^{-4} = 1/81' + D + '.'

await c.connect()
const rows = (await c.query(
  `select id, question_type, ${TEXT_COLS.join(', ')} from questions where category='testseries'`
)).rows

const updates = []
let tagMatch = 0, caretRows = 0, dupFixed = 0
const caretSamples = []

for (const r of rows) {
  const update = { id: r.id }

  // #1 match tagging (only when not already tagged)
  const matchy = TEXT_COLS.some((k) => r[k] && isMatchText(r[k]))
  if (matchy && r.question_type !== 'match') {
    update.question_type = 'match'
    tagMatch++
  }

  let rowHadCaret = false
  for (const k of TEXT_COLS) {
    const v = r[k]
    if (v == null) continue
    if (v.includes('^')) rowHadCaret = true
    let nv = v

    // one malformed row: drop the repeated "List II" header
    if (r.id === DUP_LIST_ID && k === 'question_text') {
      nv = nv.replace('1. Kudi Arasu\nList II\n2. Dravida Nadu', '1. Kudi Arasu\n2. Dravida Nadu')
      if (nv !== v) dupFixed++
    }

    // #2 powers
    if (r.id === LOG_ID && (k === 'explanation' || k === 'explanation_ta')) {
      nv = LOG_LATEX
    } else {
      nv = fixCarets(nv)
    }

    if (nv !== v) {
      update[k] = nv
      if (caretSamples.length < 16 && v.includes('^') && (hasSup(nv) || nv.includes(D))) {
        caretSamples.push({ id: r.id, col: k, before: v.slice(0, 130), after: nv.slice(0, 130) })
      }
    }
  }
  if (rowHadCaret && Object.keys(update).some((k) => k !== 'id' && k !== 'question_type')) caretRows++
  if (Object.keys(update).length > 1) updates.push(update)
}

console.log('=== Test Series content fix' + (APPLY ? ' (APPLY=1)' : ' — DRY RUN') + ' ===')
console.log('rows scanned              :', rows.length)
console.log('-> tag question_type=match:', tagMatch)
console.log('-> malformed List II fixed:', dupFixed)
console.log('-> rows with power fixes   :', caretRows)
console.log('-> total rows to update    :', updates.length)
console.log('\n--- power before/after samples ---')
for (const s of caretSamples) console.log(`[${s.col}] ${s.before}\n     ->  ${s.after}\n`)

writeFileSync('_ts_fix_preview.json', JSON.stringify(updates, null, 2), 'utf8')
console.log('Full update set written to _ts_fix_preview.json')

if (APPLY && updates.length) {
  await c.query('begin')
  try {
    for (const u of updates) {
      const cols = Object.keys(u).filter((k) => k !== 'id')
      const set = cols.map((k, i) => `${k} = $${i + 2}`).join(', ')
      await c.query(`update questions set ${set} where id = $1`, [u.id, ...cols.map((k) => u[k])])
    }
    await c.query('commit')
    console.log(`\nAPPLIED ${updates.length} row updates.`)
  } catch (e) {
    await c.query('rollback')
    console.error('ROLLED BACK:', e.message)
    process.exit(1)
  }
} else {
  console.log('\nDRY RUN — set APPLY=1 to write.')
}
await c.end()
