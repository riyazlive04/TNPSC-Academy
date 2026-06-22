import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'

/**
 * Safe in-place UPDATE of the current_affairs bank from merged_ca.json.
 *
 * Unlike load-ca.mjs (which deletes by external_id then re-inserts — now unsafe
 * because test_answers RESTRICT-references CA rows, and review_items/
 * seen_questions ON DELETE CASCADE), this updates each row IN PLACE matched by
 * (category='current_affairs', external_id). The row's uuid `id` is preserved,
 * so all user history (test_answers, review_items / SRS, seen_questions,
 * bookmarks) stays intact.
 *
 * All source qids must already exist in the DB (verified separately). Any source
 * row with no matching DB row is reported and skipped (never inserted blindly).
 *
 * Usage:
 *   node update-ca.mjs            # DRY RUN — reports per-column changes
 *   APPLY=1 node update-ca.mjs    # apply the update in a transaction
 */

const MERGED = 'c:/Users/mas20/Desktop/work/TNPSC/Current_affairs_10Months/merged_ca.json'
const APPLY = process.env.APPLY === '1'
const data = JSON.parse(readFileSync(MERGED, 'utf8'))

// Columns updated in place. (NOT category / external_id / id / created_at.)
const UPDATE_COLS = [
  'ca_type', 'ca_month', 'ca_year', 'ca_topic', 'topic', 'question_type',
  'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'difficulty', 'source_url', 'why_wrong',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'explanation_ta',
]

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
  statement_timeout: 180000,
})
await c.connect()

// Guard: every source external_id must match a DB CA row.
const ids = data.map((d) => d.external_id)
const matched = (await c.query(
  `select external_id from questions where category='current_affairs' and external_id = any($1::text[])`,
  [ids]
)).rows.map((r) => r.external_id)
const matchedSet = new Set(matched)
const unmatched = ids.filter((id) => !matchedSet.has(id))
console.log(`source rows: ${data.length} | matched in DB: ${matchedSet.size} | unmatched (skipped): ${unmatched.length}`)
if (unmatched.length) console.log('  unmatched ids:', unmatched.slice(0, 20))

// The shared mapping expression for each column from the jsonb element `e`.
const expr = (col) => {
  switch (col) {
    case 'ca_year': return `nullif(e->>'ca_year','')::int`
    case 'correct_answer': return `upper(e->>'correct_answer')`
    case 'difficulty': return `coalesce(nullif(e->>'difficulty',''),'medium')`
    case 'source_url': return `coalesce(nullif(e->>'source_url',''),'tnpsc-official')`
    case 'why_wrong': return `case when e->'why_wrong' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong' is null then null else e->'why_wrong' end`
    case 'question_text': case 'option_a': case 'option_b': case 'option_c': case 'option_d':
      return `e->>'${col}'`
    default: return `nullif(e->>'${col}','')` // text cols + ca_topic/topic/etc.
  }
}

// ── DRY RUN: per-column change counts (text via ->>, jsonb via ->) ───────────
const srcParam = [JSON.stringify(data)]
if (!APPLY) {
  console.log('\nDRY RUN — per-column rows that would change:')
  let anyChanged = 0
  for (const col of UPDATE_COLS) {
    const newExpr = col === 'why_wrong' ? expr(col) : (col === 'ca_year' ? `nullif(e->>'ca_year','')::int` : expr(col))
    const oldRef = col === 'why_wrong' ? `q.why_wrong` : `q.${col}`
    const sql = `
      select count(*)::int n
      from jsonb_array_elements($1::jsonb) e
      join questions q on q.category='current_affairs' and q.external_id = e->>'external_id'
      where ${oldRef} is distinct from (${newExpr})`
    const n = (await c.query(sql, srcParam)).rows[0].n
    if (n) { console.log(`  ${col.padEnd(18)} ${n}`); anyChanged += n }
  }
  // rows changed in at least one column
  const distinctSql = `
    select count(*)::int n from jsonb_array_elements($1::jsonb) e
    join questions q on q.category='current_affairs' and q.external_id = e->>'external_id'
    where ${UPDATE_COLS.map((col) => `q.${col} is distinct from (${expr(col)})`).join(' or ')}`
  const rowsChanged = (await c.query(distinctSql, srcParam)).rows[0].n
  console.log(`\nDistinct rows changing: ${rowsChanged} / ${matchedSet.size}`)
  console.log('Re-run with APPLY=1 to apply.')
  await c.end()
  process.exit(0)
}

// ── APPLY: one bulk in-place UPDATE in a transaction ─────────────────────────
const before = (await c.query(`select count(*)::int n from questions where category='current_affairs'`)).rows[0].n
try {
  await c.query('begin')
  const setClause = UPDATE_COLS.map((col) => `${col} = ${expr(col)}`).join(',\n    ')
  const res = await c.query(`
    update questions q set
    ${setClause}
    from jsonb_array_elements($1::jsonb) e
    where q.category='current_affairs' and q.external_id = e->>'external_id'`,
    srcParam
  )
  console.log(`\nUpdated ${res.rowCount} rows in place (ids preserved).`)
  await c.query('commit')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}
const after = (await c.query(`select count(*)::int n from questions where category='current_affairs'`)).rows[0].n
console.log(`CA total: ${before} -> ${after} (unchanged count expected; content updated)`)
await c.end()
