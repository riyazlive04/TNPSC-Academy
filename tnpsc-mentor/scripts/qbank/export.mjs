// ─── Pull the public question archive's rows out of the live database ────────
// Read-only. Writes one NDJSON file plus a stats file; touches nothing in the
// database and runs no DDL.
//
//   STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node scripts/qbank/export.mjs --stats
//   STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node scripts/qbank/export.mjs
//
// --stats only counts (per category, per subject) and writes no rows, so it is
// the safe first call: it confirms the credentials reach the right database and
// shows whether every `subject` value maps onto a 2026-prelims unit before a
// 47k-row download.
//
// The VPS exposes neither Postgres (firewalled) nor PostgREST (403 at nginx),
// so Studio's pg-meta endpoint through Kong is the only route in from a laptop
// — same as server/load-group1-mocks-studio.mjs.
//
// SCOPE: previous-year papers only — category 'pyq' (Group 1), 'pyq2'
// (Group 2 / 2A) and 'pyq4' (Group 4 / VAO). Nothing else. These are the
// questions TNPSC itself published, so they are already public knowledge and
// cost us nothing to put on the open web; what people search is their exact
// wording, which is precisely what we want to rank for.
//
// Everything else stays off: 'mock' and 'testseries' are paid papers, and
// 'subject' / 'outer' / 'aptitude' / 'current_affairs' are our own authored
// bank — the thing a subscription buys. Widening this list is a pricing
// decision, not a build flag.

import { writeFileSync, createWriteStream, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../../server/_qbank')
const OUT_ROWS = resolve(OUT_DIR, 'questions.ndjson')
const OUT_STATS = resolve(OUT_DIR, 'stats.json')

const ENDPOINT = 'https://db.tnpscmentors.in/api/platform/pg-meta/default/query'
const PAGE = 300
const INCLUDED_CATEGORIES = ['pyq', 'pyq2', 'pyq4']

const statsOnly = process.argv.includes('--stats')
const user = process.env.STUDIO_USER || 'tnpscadmin'
const password = process.env.STUDIO_PASSWORD
if (!password) {
  console.error('STUDIO_PASSWORD is not set. Refusing to run.')
  process.exit(1)
}
const auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')

/** One read-only statement. Throws on any error body. */
async function sql(query, label) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 400)}`)
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${label}: response was not JSON — ${text.slice(0, 200)}`)
  }
  if (json?.error) throw new Error(`${label}: ${JSON.stringify(json.error).slice(0, 400)}`)
  return json
}

const included = INCLUDED_CATEGORIES.map((c) => `'${c}'`).join(', ')
// `active` is the soft-hide flag (supabase/active_flag.sql). A row hidden from
// the app's own quizzes must not be the thing Google indexes, so inactive rows
// are out too.
//
// An allow-list, not a deny-list: a category added to the table later stays off
// the web until somebody decides otherwise, which is the right default when the
// cost of a mistake is a paid bank on Google.
const WHERE = `where q.active and coalesce(q.category, '') in (${included})`

// ─── Identity + counts ──────────────────────────────────────────────────────
console.log('Checking which database this is…')
const who = await sql(
  `select current_database() as db, current_user as usr, inet_server_addr()::text as host`,
  'identity',
)
console.log(`  ${who[0].db} as ${who[0].usr} @ ${who[0].host ?? 'local socket'}`)

const byCategory = await sql(
  `select coalesce(q.category, '(null)') as category,
          count(*) as total,
          count(*) filter (where q.active) as active
     from public.questions q
    group by 1 order by 2 desc`,
  'count by category',
)
console.log('\nQuestions by category (whole table):')
for (const r of byCategory) {
  const skip = INCLUDED_CATEGORIES.includes(r.category) ? '  <- PUBLISHED' : ''
  console.log(
    `  ${String(r.category).padEnd(18)} ${String(r.active).padStart(7)} active / ` +
      `${String(r.total).padStart(7)} total${skip}`,
  )
}

const bySubject = await sql(
  `select coalesce(q.category, '(null)') as category,
          coalesce(q.subject, '(null)') as subject,
          coalesce(q.topic, '') as topic,
          coalesce(q.aptitude_type, '') as aptitude_type,
          count(*) as n
     from public.questions q ${WHERE}
    group by 1, 2, 3, 4 order by 5 desc`,
  'count by subject',
)

const totalRow = await sql(`select count(*) as n from public.questions q ${WHERE}`, 'total')
const total = Number(totalRow[0].n)
console.log(`\nIn scope for the archive: ${total.toLocaleString('en-IN')} questions (categories ${INCLUDED_CATEGORIES.join(', ')})`)

// ─── Does every subject map onto a 2026-prelims unit? ────────────────────────
const { resolveUnit, UNIT_OTHER } = await import('./taxonomy.mjs')
const perUnit = new Map()
const unmapped = []
for (const r of bySubject) {
  const unit = resolveUnit({
    category: r.category,
    subject: r.subject === '(null)' ? null : r.subject,
    topic: r.topic || null,
    aptitude_type: r.aptitude_type || null,
  })
  perUnit.set(unit.key, (perUnit.get(unit.key) ?? 0) + Number(r.n))
  if (unit.key === UNIT_OTHER.key) unmapped.push({ ...r, n: Number(r.n) })
}
console.log('\nBy 2026 prelims unit:')
for (const [key, n] of [...perUnit].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(22)} ${String(n).padStart(7)}`)
}
if (unmapped.length) {
  console.log(`\n!! ${unmapped.length} subject value(s) map to no unit — add an alias in taxonomy.mjs:`)
  for (const r of unmapped) {
    console.log(
      `   ${String(r.n).padStart(6)}  category=${r.category}  subject=${JSON.stringify(r.subject)}` +
        `  topic=${JSON.stringify(r.topic)}`,
    )
  }
} else {
  console.log('\nEvery subject value maps onto a unit.')
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  OUT_STATS,
  JSON.stringify(
    {
      takenAt: new Date().toISOString(),
      database: who[0].db,
      total,
      byCategory,
      bySubject,
      perUnit: Object.fromEntries(perUnit),
      unmapped,
    },
    null,
    2,
  ),
)
console.log(`\nWrote ${OUT_STATS}`)

if (statsOnly) {
  console.log('--stats: stopping before the row download.')
  process.exit(0)
}

// ─── The rows ────────────────────────────────────────────────────────────────
// Keyset pagination on id so a resumed run can't skip or double-count, and no
// single response carries more than ~2 MB of bilingual text.
const COLUMNS = [
  'id', 'category', 'group_type', 'year', 'standard',
  'ca_month', 'ca_year', 'ca_type', 'ca_topic',
  'aptitude_type', 'aptitude_topic', 'subject', 'topic',
  'question_type', 'external_id', 'difficulty', 'source_tag',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'why_wrong',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta', 'explanation_ta',
  'images', 'option_images',
]

// Columns added by later migrations may not exist on every environment, so they
// are probed once rather than assumed — a missing one must not fail the export.
const OPTIONAL = ['option_e', 'option_e_ta', 'explanation_video_url']
const present = await sql(
  `select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'questions'
      and column_name in (${OPTIONAL.map((c) => `'${c}'`).join(', ')})`,
  'optional columns',
)
const columns = [...COLUMNS, ...present.map((r) => r.column_name)]
const missing = OPTIONAL.filter((c) => !present.some((r) => r.column_name === c))
if (missing.length) console.log(`\nNote: this database has no ${missing.join(', ')} — skipped.`)

const select = columns.map((c) => `q.${c}`).join(', ')
const out = createWriteStream(OUT_ROWS, { encoding: 'utf8' })
let after = '00000000-0000-0000-0000-000000000000'
let written = 0
process.stdout.write('\nDownloading rows: ')
for (;;) {
  const rows = await sql(
    `select ${select} from public.questions q ${WHERE} and q.id > '${after}'
      order by q.id limit ${PAGE}`,
    `page after ${after}`,
  )
  if (rows.length === 0) break
  for (const r of rows) out.write(JSON.stringify(r) + '\n')
  written += rows.length
  after = rows[rows.length - 1].id
  if (written % 3000 < PAGE) process.stdout.write(`${written} `)
}
await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())))
console.log(`\nWrote ${written.toLocaleString('en-IN')} rows to ${OUT_ROWS}`)
if (written !== total) {
  console.warn(`!! expected ${total} rows but wrote ${written} — the bank changed mid-export; re-run before building.`)
}
