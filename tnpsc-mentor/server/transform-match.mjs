import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

/**
 * Normalise every current-affairs `match` question to ONE canonical scheme:
 *   List I  -> A, B, C, D   (capital letters)
 *   List II -> 1, 2, 3, 4
 *   options -> "A-1, B-2, C-3, D-4"
 *
 * Robust to source variants: List/Column/பட்டியல்/நிரல் headers (incl. Tamil
 * pulli corruption); List II labelled 1-4 / a-d / A-D / P-S / I-IV (roman) /
 * Tamil vowels; title prose mentioning "List I/II"; trailing prompts; the
 * combined "A. item — 1. detail" single-line layout; label typos (sliced by
 * POSITION, not label).
 *
 * Each language is parsed independently from its own options. Invariants before
 * accept: 4 items per list; options are a 1-4 permutation; and the canonical EN
 * options equal the canonical Tamil options (same pairing in both languages).
 * Failures are skipped + reported. Dry-run by default; APPLY=1 writes.
 */

const APPLY = process.env.APPLY === '1'
const LETTERS = ['A', 'B', 'C', 'D']
const NUMS = ['1', '2', '3', '4']
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
const isRoman = (t) => /^(I|II|III|IV|V|VI)$/.test(t)
// head words; Tamil forms allow trailing combining chars / corruption bytes
const HEAD = '(?:List|Column|பட்டிய[\\u0b80-\\u0bff\\x80-\\x9f]*|நிர[\\u0b80-\\u0bff\\x80-\\x9f]*|நெடுவரிச[\\u0b80-\\u0bff\\x80-\\x9f]*)'
const SEP = '[\\s\\u0b80-\\u0bff\\x80-\\x9f-]{0,3}'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
})
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function tokRank(t) {
  if (/^[0-9]+$/.test(t)) return Number(t)
  if (isRoman(t)) return ROMAN[t] // roman incl. lone "I" (no 4-item list uses Latin "I")
  return t.codePointAt(0) // letters (Latin or Tamil) by code point
}
const sortToks = (arr) => [...arr].sort((a, b) => tokRank(a) - tokRank(b))

function parseOptions(opts) {
  if (opts.some((o) => o == null)) return null
  const pairRe = /([A-Za-z]+|[0-9]+|[அ-ஔ])\s*[-–—]\s*([A-Za-z]+|[0-9]+|[அ-ஔ])/g
  const parsed = opts.map((o) => {
    const pairs = []; let m; pairRe.lastIndex = 0
    while ((m = pairRe.exec(o)) !== null) pairs.push({ i: m[1], ii: m[2] })
    return pairs
  })
  if (parsed.some((p) => p.length !== 4)) return null
  const iTokens = sortToks([...new Set(parsed.flatMap((p) => p.map((x) => x.i)))])
  const iiTokens = sortToks([...new Set(parsed.flatMap((p) => p.map((x) => x.ii)))])
  if (iTokens.length !== 4 || iiTokens.length !== 4) return null
  const iPos = {}, iiPos = {}
  iTokens.forEach((t, k) => (iPos[t] = k))
  iiTokens.forEach((t, k) => (iiPos[t] = k))
  return { parsed, iTokens, iiTokens, iPos, iiPos }
}

function findHeaders(qt) {
  const reI = new RegExp(`${HEAD}${SEP}(?:I|1)\\b`, 'gi')
  const reII = new RegExp(`${HEAD}${SEP}(?:II|2)\\b`, 'gi')
  const iM = [], iiM = []
  let m
  while ((m = reI.exec(qt)) !== null) iM.push({ index: m.index, end: reI.lastIndex })
  while ((m = reII.exec(qt)) !== null) iiM.push({ index: m.index, end: reII.lastIndex })
  if (!iiM.length) return null
  const mII = iiM[iiM.length - 1]
  const before = iM.filter((x) => x.index < mII.index)
  if (!before.length) return null
  const mI = before[before.length - 1]
  return { preamble: qt.slice(0, mI.index).trim(), block1: qt.slice(mI.end, mII.index), block2: qt.slice(mII.end) }
}

const stripPrompt = (b) =>
  b.replace(/\n[^\n]*(?:choose|select|தேர்ந்தெடு|தேர்வு|பொருத்தத்தைத்|சரியான)[^\n]*$/i, '').trimEnd()

// Slice block into 4 ordered item texts. Try known tokens; fall back to generic.
function sliceByPos(block, tokens) {
  // token-based first
  const byTok = []
  let ok = true
  for (const tk of tokens) {
    const re = new RegExp(`(?:^|[\\s(])(${esc(tk)})[.)]`)
    const m = re.exec(block)
    if (!m) { ok = false; break }
    byTok.push({ start: m.index + m[0].lastIndexOf(tk), end: m.index + m[0].length })
  }
  if (ok && byTok.every((p, k) => k === 0 || p.start > byTok[k - 1].start)) {
    return byTok.map((p, k) => block.slice(p.end, k + 1 < byTok.length ? byTok[k + 1].start : block.length).trim().replace(/\s+/g, ' '))
  }
  // generic: any "<label>." / "<label>)" at segment start
  const gre = /(?:^|\n|\s{2,}|[(])\s*([0-9]{1,2}|[A-Za-z]{1,4}|[அ-ஔ])\s*[.)]/g
  const marks = []
  let m
  while ((m = gre.exec(block)) !== null) marks.push({ start: m.index + m[0].indexOf(m[1]), end: gre.lastIndex })
  if (marks.length !== 4) return null
  return marks.map((p, k) => block.slice(p.end, k + 1 < marks.length ? marks[k + 1].start : block.length).trim().replace(/\s+/g, ' '))
}

// Combined "A. item — 1. detail" per line. Returns {iItems[4], iiItems[4]} or null.
function parseCombined(block2) {
  const lines = block2.split('\n').map((l) => l.trim()).filter(Boolean)
  const iItems = [], iiItems = []
  for (const ln of lines) {
    const m = ln.match(/^[(]?\s*([A-Za-z0-9அ-ஔ]+)\s*[.)]\s*(.+?)\s*[—–-]\s*[(]?\s*([A-Za-z0-9அ-ஔ]+)\s*[.)]\s*(.+)$/)
    if (!m) continue
    iItems.push(m[2].trim().replace(/\s+/g, ' '))
    iiItems.push(m[4].trim().replace(/\s+/g, ' '))
  }
  if (iItems.length === 4 && iiItems.length === 4) return { iItems, iiItems }
  return null
}

function buildQ(preamble, iItems, iiItems, headI, headII) {
  const lines = []
  // strip a dangling "List-I" / "List I:" fragment left at the end of the preamble
  if (preamble) preamble = preamble.replace(new RegExp(`${HEAD}${SEP}(?:I|1)\\s*:?\\s*$`, 'i'), '').trim()
  if (preamble) lines.push(preamble)
  lines.push(headI + ':')
  LETTERS.forEach((L, k) => lines.push(`${L}. ${iItems[k]}`))
  lines.push(headII + ':')
  NUMS.forEach((N, k) => lines.push(`${N}. ${iiItems[k]}`))
  return lines.join('\n')
}

// canonical option string from parsed pairs using position maps
const canonOpts = (po) =>
  po.parsed.map((pairs) =>
    pairs.map((p) => ({ L: LETTERS[po.iPos[p.i]], N: NUMS[po.iiPos[p.ii]] }))
      .sort((a, b) => a.L.localeCompare(b.L)).map((x) => `${x.L}-${x.N}`).join(', '))

// Header-less "(A) ... (B) ... (1) ... (2) ..." — slice by PAREN markers only
// (parens avoid colliding with content like "D. Gukesh"). Returns {preamble,iItems,iiItems}.
function parseHeaderless(qt, po) {
  const pos = (tok) => {
    const m = new RegExp(`\\(\\s*${esc(tok)}\\s*\\)`).exec(qt)
    return m ? { start: m.index, end: m.index + m[0].length } : null
  }
  const iM = po.iTokens.map(pos), iiM = po.iiTokens.map(pos)
  if (iM.some((x) => !x) || iiM.some((x) => !x)) return null
  const inc = (a) => a.every((p, k) => k === 0 || p.start > a[k - 1].start)
  if (!inc(iM) || !inc(iiM)) return null
  const firstII = iiM[0].start
  if (!(iM[iM.length - 1].start < firstII)) return null // List I group precedes List II
  const clean = (s) => s.trim().replace(/\s+/g, ' ')
  const iItems = iM.map((p, k) => clean(qt.slice(p.end, k + 1 < iM.length ? iM[k + 1].start : firstII)))
  const iiItems = iiM.map((p, k) => {
    const to = k + 1 < iiM.length ? iiM[k + 1].start : qt.length
    return clean(stripPrompt(qt.slice(p.end, to)))
  })
  return { preamble: qt.slice(0, iM[0].start).trim(), iItems, iiItems }
}

// Parse one language -> { newQt, newOpts[4] } or { err }
function doLang(qt, opts, headI, headII) {
  const po = parseOptions(opts)
  if (!po) return { err: 'options not clean' }
  const newOpts = canonOpts(po)
  for (const o of newOpts) {
    if (!/^A-[1-4], B-[1-4], C-[1-4], D-[1-4]$/.test(o)) return { err: 'bad canon opt ' + o }
    if (new Set(o.match(/[1-4]/g)).size !== 4) return { err: 'not permutation ' + o }
  }
  let preamble, iItems, iiItems
  const sp = findHeaders(qt)
  if (sp) {
    preamble = sp.preamble
    iItems = sliceByPos(sp.block1, po.iTokens)
    iiItems = sliceByPos(stripPrompt(sp.block2), po.iiTokens)
    if (!iItems || !iiItems) {
      const comb = parseCombined(stripPrompt(sp.block2))
      if (comb) { iItems = comb.iItems; iiItems = comb.iiItems }
    }
  }
  if (!iItems || !iiItems || iItems.length !== 4 || iiItems.length !== 4) {
    const hl = parseHeaderless(qt, po)
    if (hl) { preamble = hl.preamble; iItems = hl.iItems; iiItems = hl.iiItems }
  }
  if (!iItems || iItems.length !== 4) return { err: 'slice List I' }
  if (!iiItems || iiItems.length !== 4) return { err: 'slice List II' }
  // Reject malformed slices (empty / leftover layout artefacts / embedded labels).
  const bad = (items, kind) => {
    for (const it of items) {
      if (!it) return 'empty item'
      if (/codes\b/i.test(it)) return 'leftover "Codes"'
      if (/[(—–-]$/.test(it)) return 'dangling separator'
      if (kind === 'I' && /\s[A-D]\.\s/.test(it)) return 'embedded List I label'
      if (kind === 'II' && /\s[1-4]\.\s/.test(it)) return 'embedded List II label'
    }
    return null
  }
  const b = bad(iItems, 'I') || bad(iiItems, 'II')
  if (b) return { err: 'malformed source (' + b + ')' }
  return { newQt: buildQ(preamble, iItems, iiItems, headI, headII), newOpts }
}

function transformRow(row) {
  const en = doLang(row.question_text, [row.option_a, row.option_b, row.option_c, row.option_d], 'List I', 'List II')
  if (en.err) return { skip: true, reasons: ['EN: ' + en.err] }
  const update = {
    id: row.external_id, question_text: en.newQt,
    option_a: en.newOpts[0], option_b: en.newOpts[1], option_c: en.newOpts[2], option_d: en.newOpts[3],
  }
  if (row.question_text_ta) {
    const ta = doLang(row.question_text_ta, [row.option_a_ta, row.option_b_ta, row.option_c_ta, row.option_d_ta], 'பட்டியல் I', 'பட்டியல் II')
    if (ta.err) return { skip: true, reasons: ['TA: ' + ta.err] }
    // cross-language invariant: same pairing in both languages
    if (JSON.stringify(ta.newOpts) !== JSON.stringify(en.newOpts))
      return { skip: true, reasons: ['EN/TA option mismatch: ' + en.newOpts.join('|') + ' vs ' + ta.newOpts.join('|')] }
    update.question_text_ta = ta.newQt
    update.option_a_ta = ta.newOpts[0]; update.option_b_ta = ta.newOpts[1]
    update.option_c_ta = ta.newOpts[2]; update.option_d_ta = ta.newOpts[3]
  }
  return { skip: false, update }
}

await c.connect()
const rows = (await c.query(`
  select external_id, correct_answer, question_text, option_a, option_b, option_c, option_d,
         question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta
  from questions where category='current_affairs' and question_type='match'
  order by external_id`)).rows

const updates = [], skipped = []
let already = 0
for (const r of rows) {
  const res = transformRow(r)
  if (res.skip) { skipped.push({ id: r.external_id, reasons: res.reasons }); continue }
  const u = res.update
  const unchanged = u.question_text === r.question_text && u.option_a === r.option_a &&
    u.option_b === r.option_b && u.option_c === r.option_c && u.option_d === r.option_d &&
    (u.question_text_ta ?? r.question_text_ta) === r.question_text_ta
  if (unchanged) { already++; continue }
  updates.push(u)
}

console.log(`Total match: ${rows.length}`)
console.log(`Already canonical: ${already}`)
console.log(`Will transform:    ${updates.length}`)
console.log(`Skipped:           ${skipped.length}`)
if (skipped.length) console.log(JSON.stringify(skipped, null, 2))

const sample = updates.slice(0, 6).map((u) => {
  const b = rows.find((r) => r.external_id === u.id)
  return { id: u.id, correct: b.correct_answer,
    BEFORE_q: b.question_text, BEFORE_opts: [b.option_a, b.option_b, b.option_c, b.option_d],
    AFTER_q: u.question_text, AFTER_opts: [u.option_a, u.option_b, u.option_c, u.option_d] }
})
writeFileSync('_match_preview.json', JSON.stringify(sample, null, 2), 'utf8')

if (APPLY && updates.length) {
  await c.query('begin')
  try {
    for (const u of updates) {
      const cols = Object.keys(u).filter((k) => k !== 'id')
      const set = cols.map((k, i) => `${k} = $${i + 2}`).join(', ')
      await c.query(`update questions set ${set} where external_id = $1`, [u.id, ...cols.map((k) => u[k])])
    }
    await c.query('commit')
    console.log(`\nAPPLIED ${updates.length} updates.`)
  } catch (e) { await c.query('rollback'); console.error('ROLLED BACK:', e.message); process.exit(1) }
} else {
  console.log('\nDRY RUN — samples in _match_preview.json. Set APPLY=1 to write.')
}
await c.end()
