// Checks a built CA archive against its source dump. Exits 1 on any problem;
// rebuild.sh only swaps the live tree in when this passes.
//
//   node scripts/ca-archive/verify.mjs [--src server/_ca/ca.ndjson] [--out ca-dist]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORIGIN, CA_PATH, excerpt } from '../qbank/render.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const argOf = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const SRC = resolve(ROOT, argOf('--src', 'server/_ca/ca.ndjson'))
const OUT = resolve(ROOT, argOf('--out', 'ca-dist'))
const CA = CA_PATH.replace(/\/$/, '')

const problems = []
const rows = readFileSync(SRC, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
const pubMag = new Set(rows.filter((r) => r.k === 'pub' && r.type === 'magazine').map((r) => r.date))
const pubDq = new Set(rows.filter((r) => r.k === 'pub' && r.type === 'daily_q').map((r) => r.date))

// ─── Walk the tree ───────────────────────────────────────────────────────────
const pages = new Map() // path -> html
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (name === 'index.html') {
      const rel = relative(OUT, dir).split('\\').join('/')
      pages.set(`${CA}/${rel ? rel + '/' : ''}`, readFileSync(full, 'utf8'))
    }
  }
})(OUT)
if (!pages.has(`${CA}/`)) problems.push('no hub page')

// ─── Publication gate ────────────────────────────────────────────────────────
for (const path of pages.keys()) {
  const m = path.match(/^\/current-affairs\/(\d{4}-\d{2}-\d{2})\/$/)
  if (m && !pubMag.has(m[1]) && !pubDq.has(m[1])) problems.push(`day page for unpublished ${m[1]}`)
}

const publicQ = new Map() // String(id) -> row
for (const r of rows) {
  if (r.k === 'mq' && r.active !== false) publicQ.set(String(r.id), r)
  if (r.k === 'dq' && r.active !== false && pubDq.has(r.date)) publicQ.set(String(r.id), r)
}
const qPages = [...pages.entries()].filter(([p]) => p.startsWith(`${CA}/q/`))
for (const [path, html] of qPages) {
  const id = html.match(/id="exp-locked" data-qid="([^"]+)"/)?.[1]
  if (id && !publicQ.has(id)) problems.push(`${path} serves non-public question ${id}`)
}
const rejected = existsSync(join(dirname(SRC), 'build-report.json'))
  ? JSON.parse(readFileSync(join(dirname(SRC), 'build-report.json'), 'utf8')).rejected.length
  : 0
if (qPages.length !== publicQ.size - rejected) {
  problems.push(`${qPages.length} question pages for ${publicQ.size - rejected} public questions`)
}

// ─── Per-page structure ──────────────────────────────────────────────────────
const linkRe = /href="(\/current-affairs\/[^"#?]*)/g
for (const [path, html] of pages) {
  const canon = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1]
  if (canon !== ORIGIN + path) problems.push(`${path}: canonical is ${canon}`)
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length
  if (h1s !== 1) problems.push(`${path}: ${h1s} <h1>`)
  for (const [, href] of html.matchAll(linkRe)) {
    if (!href.endsWith('.css') && !href.endsWith('.xml') && !pages.has(href)) {
      problems.push(`${path}: broken link ${href}`)
    }
  }
}

// ─── Sitemap lists exactly the indexable pages' first entries ────────────────
const sm = readFileSync(join(OUT, 'sitemap.xml'), 'utf8')
const smUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, ''))
for (const u of smUrls) if (!pages.has(u)) problems.push(`sitemap lists missing ${u}`)
for (const p of pages.keys()) {
  if (!/\/page-\d+\/$/.test(p) && !smUrls.includes(p)) problems.push(`sitemap misses ${p}`)
}

// ─── Nothing unpublished, nothing past the explanation opening ───────────────
const strip = (s) => String(s ?? '').toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]/g, '')
const blob = strip([...pages.values()].join(' '))

// Text that is public on purpose through SOME row: published notes, public
// question stems/options, and every explanation's given-away opening. The same
// fact routinely appears in several rows (a story repeated across days, a
// monthly question on an unapproved day's news, two questions with the same
// opening), so a probe found here is not a leak and is skipped.
// Stripped row by row: raw text holds stray '<' / '>' ("x < y"), and stripping
// the concatenation would let a '<' in one row and a '>' in another erase
// everything between them.
const allowed = [
  ...rows
    .filter((r) => r.k === 'item' && pubMag.has(r.date))
    .map((r) => [r.title, r.content, r.title_ta, r.content_ta]),
  ...[...publicQ.values()].map((q) => [
    q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
    q.question_text_ta, q.option_a_ta, q.option_b_ta, q.option_c_ta, q.option_d_ta,
    excerpt(q.explanation).text, excerpt(q.explanation_ta, { max: 240 }).text,
  ]),
].map((fields) => fields.map(strip).join('')).join(' ')

let itemProbes = 0
for (const r of rows) {
  if (r.k !== 'item' || pubMag.has(r.date)) continue
  const flat = strip(r.content)
  if (flat.length < 90) continue
  const probe = flat.slice(10, 90)
  if (allowed.includes(probe)) continue
  itemProbes++
  if (blob.includes(probe)) problems.push(`unpublished item ${r.external_id} (${r.date}) is in the HTML`)
}

let expProbes = 0
for (const q of publicQ.values()) {
  const texts = [
    [q.explanation, {}],
    [q.explanation_ta, { max: 240 }], // the renderer's Tamil cut
    ...Object.values(q.why_wrong && typeof q.why_wrong === 'object' ? q.why_wrong : {}).map((v) => [v, null]),
  ]
  for (const [t, gated] of texts) {
    const flat = strip(t)
    const given = gated ? strip(excerpt(t, gated).text).length : 0
    if (flat.length - given < 60) continue
    const probe = flat.slice(given + 10, given + 70)
    if (allowed.includes(probe)) continue
    expProbes++
    if (blob.includes(probe)) {
      problems.push(`question ${q.id}: ${gated ? "explanation text past the opening" : "why-wrong text"} is in the HTML ("${probe}")`)
    }
  }
}

console.log(`${pages.size} pages, ${qPages.length} question pages, ${smUrls.length} sitemap URLs; ` +
  `${itemProbes} unpublished-item probes, ${expProbes} explanation probes`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ` + problems.slice(0, 40).join('\n  '))
  process.exit(1)
}
console.log('No problems found.')
