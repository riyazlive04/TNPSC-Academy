// ─── Check a built archive before it goes anywhere near the open web ─────────
//   node scripts/qbank/verify.mjs [--out qbank-dist]
//
// Everything here is a thing that would be expensive to find out from Google
// Search Console three weeks later: a dead internal link, two pages claiming the
// same canonical, a page with no <h1>, a sitemap pointing at a file that was
// never written. Exits non-zero if any of it is wrong.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORIGIN, BASE, HUB_PATH } from './render.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const i = argv.indexOf('--out')
const OUT = resolve(ROOT, i >= 0 && argv[i + 1] ? argv[i + 1] : 'qbank-dist')

if (!existsSync(OUT)) {
  console.error(`Nothing built at ${OUT}`)
  process.exit(1)
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(OUT)
const htmlFiles = files.filter((f) => f.endsWith('.html'))
console.log(`${htmlFiles.length} HTML pages, ${files.length} files in total`)

/** '/questions/foo/' -> the file that serves it. OUT/index.html is reachable
 * at HUB_PATH ('/') too: nginx answers the root with it (see render.mjs). */
const served = new Set()
for (const f of files) {
  const rel = relative(OUT, f).split('\\').join('/')
  served.add(`${BASE}/${rel}`)
  if (rel.endsWith('/index.html')) served.add(`${BASE}/${rel.slice(0, -'index.html'.length)}`)
  else if (rel === 'index.html') {
    served.add(`${BASE}/`)
    served.add(HUB_PATH)
  }
}

const problems = []
const canonicals = new Map()
let totalLinks = 0
let bytes = 0

for (const f of htmlFiles) {
  const rel = relative(OUT, f).split('\\').join('/')
  const html = readFileSync(f, 'utf8')
  bytes += Buffer.byteLength(html)

  if (!/<h1[ >]/.test(html)) problems.push(`${rel}: no <h1>`)
  if ((html.match(/<h1[ >]/g) ?? []).length > 1) problems.push(`${rel}: more than one <h1>`)

  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
  if (!title.trim()) problems.push(`${rel}: empty <title>`)

  const desc = html.match(/<meta name="description" content="([\s\S]*?)">/)?.[1] ?? ''
  if (!desc.trim()) problems.push(`${rel}: empty meta description`)

  const canon = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1]
  if (!canon) problems.push(`${rel}: no canonical`)
  else {
    const seen = canonicals.get(canon)
    if (seen) problems.push(`${rel}: shares its canonical with ${seen} (${canon})`)
    else canonicals.set(canon, rel)
  }

  // Every JSON-LD block must parse — a broken one is invisible until a crawler
  // silently ignores it.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1])
    } catch (e) {
      problems.push(`${rel}: JSON-LD does not parse (${e.message.slice(0, 60)})`)
    }
  }

  // Duplicate ids. The contents box jumps to them and a search result can link
  // straight to one, so a repeated id silently sends people to the wrong part of
  // the page — which is exactly how an inner section heading and its wrapper
  // both ended up claiming #explanation.
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
  const dupIds = [...new Set(ids.filter((x, k) => ids.indexOf(x) !== k))]
  for (const d of dupIds) problems.push(`${rel}: id "${d}" is used more than once`)

  // Internal links must land on something this tree actually serves.
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1]
    if (href !== HUB_PATH && !href.startsWith(`${BASE}/`)) continue
    totalLinks++
    if (!served.has(href)) problems.push(`${rel}: dead link -> ${href}`)
  }
}

// Sitemaps must list only URLs that exist.
const indexPath = join(OUT, 'sitemap.xml')
let sitemapUrls = 0
if (!existsSync(indexPath)) problems.push('sitemap.xml is missing')
else {
  for (const m of readFileSync(indexPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const name = m[1].split('/').pop()
    const chunk = join(OUT, name)
    if (!existsSync(chunk)) {
      problems.push(`sitemap.xml points at ${name}, which was not written`)
      continue
    }
    for (const u of readFileSync(chunk, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      sitemapUrls++
      const path = u[1].replace(ORIGIN, '')
      if (!served.has(path)) problems.push(`${name}: lists ${path}, which is not served`)
    }
  }
}

// ─── The explanations must not be in the HTML at all ─────────────────────────
// render.mjs withholds the explanation text rather than blurring it (see
// lockedExplanation there). That is the business model, so it gets a test and
// not a promise: take a distinctive run of letters out of each explanation in
// the source export and confirm it appears nowhere in the built tree.
//
// Comparison strips everything but lowercase letters and digits, so HTML
// entities, line wrapping and markup between words cannot hide a match.
//
// A sample rather than all of them: the gate is one branch in one function, so
// a leak is systemic and a few hundred probes find it. Checking every row would
// mean a full scan of the whole tree per row.

const srcArg = argv.indexOf('--src')
const SRC = srcArg >= 0 && argv[srcArg + 1]
  ? resolve(ROOT, argv[srcArg + 1])
  : [resolve(ROOT, 'server/_qbank/questions.ndjson'), resolve(ROOT, 'server/_qbank/fixture.ndjson')]
      .find((p) => existsSync(p))

const strip = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

if (!SRC) {
  console.log('No source export found, so the explanation-leak check was skipped.')
} else {
  const blob = htmlFiles.map((f) => strip(readFileSync(f, 'utf8'))).join('|')
  const secrets = []
  for (const line of readFileSync(SRC, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const q = JSON.parse(line)
    const texts = [q.explanation, q.explanation_ta]
    if (q.why_wrong && typeof q.why_wrong === 'object') texts.push(...Object.values(q.why_wrong))
    // The question and its options are published on purpose, and explanations
    // in the aptitude banks routinely open by restating the question word for
    // word ("Given: Position 1: top 2, left 3, right 5 …"). A probe taken from
    // that restatement finds itself on the page and reports a leak that is not
    // one, so the window slides along until it lands on something the page does
    // not already carry. An explanation that is nothing but a restatement has
    // no secret to leak and is skipped.
    const published = strip(
      [
        q.question_text,
        q.question_text_ta,
        ...['a', 'b', 'c', 'd', 'e'].flatMap((L) => [q[`option_${L}`], q[`option_${L}_ta`]]),
      ].join(' '),
    )
    for (const t of texts) {
      const flat = strip(t)
      if (flat.length < 120) continue
      for (let at = 40; at + 60 <= flat.length; at += 20) {
        const probe = flat.slice(at, at + 60)
        if (published.includes(probe)) continue
        secrets.push({ id: q.id, probe })
        break
      }
    }
  }
  const STEP = Math.max(1, Math.floor(secrets.length / 400))
  let probed = 0
  for (let k = 0; k < secrets.length; k += STEP) {
    probed++
    if (blob.includes(secrets[k].probe)) {
      problems.push(`explanation text for row ${secrets[k].id} is in the published HTML`)
    }
  }
  console.log(`explanation-leak check: ${probed} of ${secrets.length} explanations probed`)
}

const mb = (bytes / 1024 / 1024).toFixed(1)
console.log(`${totalLinks} internal links, ${sitemapUrls} sitemap URLs, ${mb} MB of HTML`)
console.log(`average page ${(bytes / htmlFiles.length / 1024).toFixed(1)} kB`)

if (!problems.length) {
  console.log('\nNo problems found.')
  process.exit(0)
}
// Group identical problems so one systemic fault does not print 40,000 times.
const grouped = new Map()
for (const p of problems) {
  const key = p.replace(/^[^:]+:/, '…:')
  if (!grouped.has(key)) grouped.set(key, [])
  grouped.get(key).push(p)
}
console.log(`\n${problems.length} problem(s):`)
for (const [key, list] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${list.length}x  ${key}`)
  for (const p of list.slice(0, 5)) console.log(`      ${p}`)
  if (list.length > 5) console.log(`      … and ${list.length - 5} more`)
}
process.exit(1)
