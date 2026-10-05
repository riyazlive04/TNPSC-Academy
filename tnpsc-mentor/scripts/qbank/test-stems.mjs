import { readFileSync } from 'node:fs'
import { stemHtml } from './stemfmt.mjs'

const id = (s) => String(s ?? '')
const strip = (s) => String(s).replace(/<[^>]+>/g, ' ')
/** Comparable form: letters and digits only, so markup and spacing drop out. */
const flat = (s) => strip(s).toLowerCase().replace(/[^a-z0-9஀-௿]+/g, '')
/**
 * A match table interleaves the two columns (a,1,b,2,…) where the source lists
 * them one after the other (a,b,c,d,1,2,3,4). That is the whole point of the
 * table, so the check has to be order-insensitive: sorting the characters still
 * catches anything dropped or duplicated, which is what actually matters.
 */
const bag = (s) => [...flat(s)].sort().join('')

const rows = readFileSync('server/_qbank/questions.ndjson', 'utf8')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))

const GRID_HDR = /^(\s*\(?[a-eA-E]\)?\s*){2,}$/

const shape = { match: 0, list: 0, ar: 0, lines: 0, plain: 0 }
const lost = []
const samples = { match: null, list: null, ar: null }

for (const q of rows) {
  for (const field of ['question_text', 'question_text_ta']) {
    const src = q[field]
    if (!src || !String(src).trim()) continue
    const { lead, body } = stemHtml(src, id)

    const kind = body.includes('<table class="match"')
      ? 'match'
      : body.includes('<ul class="stem-list"')
        ? 'list'
        : body.includes('<div class="stem-ar"')
          ? 'ar'
          : body
            ? 'lines'
            : 'plain'
    shape[kind]++
    if (field === 'question_text' && samples[kind] === null && kind !== 'plain' && kind !== 'lines') {
      samples[kind] = { q, lead, body }
    }

    // Nothing may vanish except the printed answer-grid header.
    const expected = bag(
      String(src)
        .split('\n')
        .filter((l) => !GRID_HDR.test(l.trim()))
        .join(' '),
    )
    // Column headings we supplied for a table the paper printed without any
    // are chrome, not content — see matchTable(). They are dropped here so the
    // check still proves that every character of the SOURCE survived.
    const GENERATED_TH = new RegExp('<th[^>]*data-generated="1"[^>]*>.*?<\/th>', 'g')
    const got = bag((lead + ' ' + body).replace(GENERATED_TH, ' '))
    if (got !== expected) {
      lost.push({ id: q.id, field, expected, got, src: String(src).slice(0, 200) })
    }
  }
}

console.log('shapes recognised:')
for (const [k, v] of Object.entries(shape)) console.log(`  ${k.padEnd(7)} ${String(v).padStart(5)}`)
console.log(`\ncontent-preservation failures: ${lost.length}`)
for (const l of lost.slice(0, 5)) {
  console.log(`\n  ${l.id} (${l.field})`)
  console.log(`    src : ${JSON.stringify(l.src)}`)
  console.log(`    want: ${l.expected.slice(0, 150)}`)
  console.log(`    got : ${l.got.slice(0, 150)}`)
}

for (const [k, s] of Object.entries(samples)) {
  if (!s) continue
  console.log(`\n${'='.repeat(74)}\n${k.toUpperCase()}  (${s.q.category} ${s.q.year})`)
  console.log('LEAD: ' + s.lead)
  console.log('BODY: ' + s.body.replace(/></g, '>\n      <').slice(0, 900))
}
