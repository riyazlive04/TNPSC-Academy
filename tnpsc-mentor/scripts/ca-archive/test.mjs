// Acceptance tests for the public CA archive, mapped to
// build-docs/features/public-current-affairs.md. Builds a hand-made fixture
// into a temp dir and checks the output.   node scripts/ca-archive/test.mjs

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'ca-archive-test-'))

const LONG = 'The committee was formed in 2026 to review the scheme and its funding across districts. It met in Madurai first, then in Salem, and reported to the cabinet within six weeks. Members included two retired judges and an economist from Coimbatore. '
const SECRET_TAIL = 'Zebra quokka xylophone hidden tail sentence that must never be published on any page at all.'
const q = (o) => ({
  k: 'dq', active: true, ca_topic: 'Tamil Nadu', topic: 'Tamil Nadu', question_type: 'direct',
  question_text_ta: 'தமிழ் வினா', option_a: 'Alpha', option_b: 'Beta', option_c: 'Gamma', option_d: 'Delta',
  correct_answer: 'B', explanation: LONG + SECRET_TAIL, explanation_ta: null, why_wrong: { A: 'Wrong because alpha is unrelated to the scheme in every respect whatsoever.' },
  ...o,
})
const item = (o) => ({ k: 'item', title_ta: 'தலைப்பு', content_ta: '- தமிழ் குறிப்பு', know_level: null, ...o })

function fixture({ publishNov4 = false } = {}) {
  return [
    { k: 'pub', type: 'magazine', date: '2026-11-01' },
    { k: 'pub', type: 'magazine', date: '2026-11-02' },
    { k: 'pub', type: 'daily_q', date: '2026-11-02' },
    { k: 'pub', type: 'daily_q', date: '2026-11-03' },
    ...(publishNov4 ? [{ k: 'pub', type: 'magazine', date: '2026-11-04' }, { k: 'pub', type: 'daily_q', date: '2026-11-04' }] : []),
    item({ id: 'i1', external_id: 'ca-mag-2026-11-01-001', date: '2026-11-01', topic: 'TNPSC BITS', title: 'TNPSC BITS', title_ta: 'TNPSC BITS', content: '- **Bit one** fact\n- Bit two fact' }),
    item({ id: 'i2', external_id: 'ca-mag-2026-11-01-002', date: '2026-11-01', topic: 'TAMIL NADU', title: 'State scheme launched', content: '- Launched in **Chennai**\n  - nested detail', know_level: 'must' }),
    item({ id: 'i3', external_id: 'ca-mag-2026-11-02-001', date: '2026-11-02', topic: 'SPORTS', title: 'Chess title won', title_ta: null, content: '- Won <b>gold</b>', content_ta: null }),
    item({ id: 'i4', external_id: 'ca-mag-2026-11-04-001', date: '2026-11-04', topic: 'NATIONAL', title: 'Unpublished headline here', content: '- Secret unpublished note about a matter nobody approved for the public yet, padded out.' }),
    q({ id: 1, external_id: 'ca-daily-2026-11-02-01', created_at: '2026-11-02T01:00:00Z', date: '2026-11-02', question_text: 'Which scheme was launched in Chennai?' }),
    q({ id: 2, external_id: 'ca-daily-2026-11-02-02', created_at: '2026-11-02T01:00:01Z', date: '2026-11-02', question_text: 'Inactive question text', active: false }),
    q({ id: 3, external_id: 'ca-daily-2026-11-02-03', created_at: '2026-11-02T01:00:02Z', date: '2026-11-02', question_text: 'Badly keyed question', correct_answer: 'E' }),
    q({ id: 4, external_id: 'ca-daily-2026-11-03-01', created_at: '2026-11-03T01:00:00Z', date: '2026-11-03', question_text: 'Which scheme was launched in Chennai?' }),
    q({ id: 5, external_id: 'ca-daily-2026-11-04-01', created_at: '2026-11-04T01:00:00Z', date: '2026-11-04', question_text: 'Secret unpublished question stem' }),
    q({ k: 'mq', id: '11111111-1111-1111-1111-111111111111', external_id: 'ca-2026-10-0001', created_at: '2026-11-01T00:00:00Z', ca_month: 'October 2026', ca_year: 2026, ca_topic: 'Sports', question_text: 'Who won the October final?', images: null, option_images: null }),
    q({ k: 'mq', id: '22222222-2222-2222-2222-222222222222', external_id: 'ca-2026-10-0002', created_at: '2026-11-01T00:00:01Z', ca_month: 'October 2026', ca_year: 2026, question_text: 'Inactive monthly question', active: false }),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n'
}

function build(name, opts) {
  const src = join(tmp, name, 'ca.ndjson')
  const out = join(tmp, name, 'dist')
  execFileSync('node', ['-e', `require('fs').mkdirSync(${JSON.stringify(dirname(src))},{recursive:true})`])
  writeFileSync(src, fixture(opts))
  execFileSync('node', [join(HERE, 'build.mjs'), '--src', src, '--out', out], { stdio: 'pipe' })
  execFileSync('node', [join(HERE, 'verify.mjs'), '--src', src, '--out', out], { stdio: 'pipe' })
  const files = []
  ;(function walk(d) {
    for (const n of readdirSync(d)) (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : files.push(join(d, n)))
  })(out)
  return {
    out,
    report: JSON.parse(readFileSync(join(dirname(src), 'build-report.json'), 'utf8')),
    html: (rel) => readFileSync(join(out, rel, 'index.html'), 'utf8'),
    all: files.filter((f) => f.endsWith('.html')).map((f) => readFileSync(f, 'utf8')).join('\n'),
    qDirs: readdirSync(join(out, 'q')).sort(),
  }
}

const tests = []
const test = (name, fn) => tests.push([name, fn])
const a = build('a')

test('AC1 unpublished day has no page and none of its content ships', () => {
  assert.ok(existsSync(join(a.out, '2026-11-01')))
  assert.ok(!existsSync(join(a.out, '2026-11-04')))
  assert.ok(!a.all.includes('Secret unpublished'))
  assert.ok(!a.all.includes('Unpublished headline'))
})

test('AC2 explanation past the opening never ships; why_wrong never ships', () => {
  assert.ok(!a.all.includes('Zebra quokka'))
  assert.ok(!a.all.includes('alpha is unrelated'))
  assert.ok(a.html('q/' + a.qDirs[0]).includes('id="exp-locked"'))
})

test('AC1 inactive and badly keyed questions are not published; the rest are', () => {
  assert.equal(a.qDirs.length, 3) // ids 1, 4, monthly #1
  assert.ok(!a.all.includes('Inactive question text') && !a.all.includes('Inactive monthly question'))
  assert.equal(a.report.rejected.length, 1)
  assert.match(a.report.rejected[0].why, /keyed answer "E"/)
})

test('AC3 approving a day later adds its pages without moving any existing URL', () => {
  const b = build('b', { publishNov4: true })
  assert.ok(existsSync(join(b.out, '2026-11-04')))
  for (const d of a.qDirs) assert.ok(b.qDirs.includes(d), `slug ${d} moved`)
  // identical stems on two days get distinct, stable slugs
  assert.ok(a.qDirs.includes('which-scheme-was-launched-in-chennai') && a.qDirs.includes('which-scheme-was-launched-in-chennai-2'))
})

test('AC4 day page: sections in order, echo title hidden, CABITS label, know badge, Tamil only when present', () => {
  const d1 = a.html('2026-11-01')
  assert.ok(d1.indexOf('TNPSC CABITS') < d1.indexOf('Tamil Nadu'))
  assert.ok(!/<h3>[^]*?TNPSC BITS/.test(d1))
  assert.ok(d1.includes('know-must'))
  assert.ok(d1.includes('<strong>Chennai</strong>') && d1.includes('class="d1"'))
  const d2 = a.html('2026-11-02')
  assert.ok(d2.includes('&lt;b&gt;gold&lt;/b&gt;'), 'item markup is escaped')
  assert.ok(!/<h3>.*l-ta.*Chess/.test(d2))
})

test('day with questions but no published notes renders questions only', () => {
  const d3 = a.html('2026-11-03')
  assert.ok(d3.includes('id="questions"'))
  assert.ok(!d3.includes('class="ca-sec"'))
})

test('month pages exist for the bank month and the daily month; topic pages link back', () => {
  assert.ok(a.html('2026/10').includes('Who won the October final?'))
  assert.ok(a.html('2026/11').includes('/current-affairs/2026-11-01/'))
  assert.ok(a.html('topic/tamil-nadu').includes('/current-affairs/2026-11-01/#n'))
})

test('AC6 pages use their own stylesheet and keep the shared chrome', () => {
  const hub = a.html('')
  assert.ok(hub.includes('href="/current-affairs/archive.css"'))
  assert.ok(hub.includes('href="/current-affairs/"'))
  assert.ok(existsSync(join(a.out, 'archive.css')))
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${name}\n       ${e.message}`)
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${tests.length} passed`)
process.exit(failed ? 1 : 0)
