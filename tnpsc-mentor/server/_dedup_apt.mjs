/**
 * Dedup analysis for the topic-wise aptitude bank (category='aptitude').
 * DRY by default (report only). Pass --write to delete redundant copies
 * (keeps the copy with the most user history; backs up deleted rows to JSON).
 */
import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

const WRITE = process.argv.includes('--write')
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows } = await c.query(`
  select q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.correct_answer, q.aptitude_type, q.expl_status, q.images,
         (select count(*) from bookmarks b where b.question_id=q.id) n_book,
         (select count(*) from seen_questions s where s.question_id=q.id) n_seen,
         (select count(*) from review_items r where r.question_id=q.id) n_rev,
         (select count(*) from test_answers t where t.question_id=q.id) n_ans
    from questions q where q.category='aptitude'`)

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const tamil = /[஀-௿]/
// Group by STEM (same question text = duplicate, even if options were digitised differently).
const keyOf = (r) => norm(r.question_text)

const groups = new Map()
for (const r of rows) { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r) }

const refs = (r) => r.n_book + r.n_seen + r.n_rev + r.n_ans
const completeOpts = (r) => ['option_a', 'option_b', 'option_c', 'option_d'].filter((o) => (r[o] || '').trim()).length
const englishOpts = (r) => (r.option_a && !tamil.test(r.option_a) ? 1 : 0) // schema expects option_a in English
const dupGroups = [...groups.values()].filter((g) => g.length > 1)
const toDelete = []
for (const g of dupGroups) {
  // keeper: most complete options, then English (not Tamil) options, then most user refs,
  // then already-generated (KaTeX), then non-image, then lowest id.
  g.sort((a, b) => completeOpts(b) - completeOpts(a) || englishOpts(b) - englishOpts(a)
    || refs(b) - refs(a) || (b.expl_status === 'generated') - (a.expl_status === 'generated')
    || (a.images ? 1 : 0) - (b.images ? 1 : 0) || (a.id < b.id ? -1 : 1))
  const [keep, ...rest] = g
  for (const d of rest) toDelete.push({ ...d, keeper_id: keep.id })
}

// stem-only dups where full-key differs (same question text, different options/answer) — report, don't delete
const stem = new Map()
for (const r of rows) { const k = norm(r.question_text); if (!stem.has(k)) stem.set(k, new Set()); stem.get(k).add(keyOf(r)) }
const variantStems = [...stem.entries()].filter(([, set]) => set.size > 1).length

console.log('=== APTITUDE DEDUP', WRITE ? '(WRITE)' : '(DRY)', '===')
console.log('total rows:', rows.length)
console.log('full-duplicate groups:', dupGroups.length, '| rows to delete:', toDelete.length)
console.log('same-stem-but-different-options groups (NOT auto-deleted):', variantStems)
const delWithRefs = toDelete.filter((d) => refs(d) > 0)
console.log('deletions that carry user history (book/seen/rev/ans):', delWithRefs.length)
delWithRefs.slice(0, 12).forEach((d) => console.log(`  del ${d.id.slice(0, 8)} (book${d.n_book}/seen${d.n_seen}/rev${d.n_rev}/ans${d.n_ans}) keep ${d.keeper_id.slice(0, 8)}`))
console.log('sample deletions:')
toDelete.slice(0, 6).forEach((d) => console.log(`  [${d.aptitude_type}] "${(d.question_text || '').replace(/\s+/g, ' ').slice(0, 70)}" del=${d.id.slice(0, 8)} keep=${d.keeper_id.slice(0, 8)}`))

if (WRITE && toDelete.length) {
  writeFileSync('_apt_deleted_backup.json', JSON.stringify(toDelete, null, 1))
  const ids = toDelete.map((d) => d.id)
  const res = await c.query('delete from questions where id = any($1::uuid[]) and category=\'aptitude\'', [ids])
  console.log('DELETED rows:', res.rowCount, '(backup: server/_apt_deleted_backup.json)')
}
await c.end()
