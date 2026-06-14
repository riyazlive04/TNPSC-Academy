import 'dotenv/config'
import { Client } from 'pg'

/**
 * Moves every non-current_affairs question into `questions_backup` and removes
 * it from the live `questions` table, so the app ships only the curated Current
 * Affairs bank + the new rewritten Subject Practice bank (loaded separately).
 *
 *   Categories moved: pyq, samacheer, aptitude, outer
 *   Kept live:        current_affairs   (+ 'subject', loaded by load-subjects.mjs)
 *
 * Idempotent: rows already copied to the backup are not duplicated. Safe by
 * default (dry-run). Pass APPLY=1 to actually move + delete.
 *
 *   node backup-and-purge.mjs          # dry-run: report only
 *   APPLY=1 node backup-and-purge.mjs  # perform the move + delete
 */

const MOVE = ['pyq', 'samacheer', 'aptitude', 'outer']
const APPLY = process.env.APPLY === '1'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})
await c.connect()
console.log(`Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

const counts = (
  await c.query(
    `select category, count(*)::int n from questions where category = any($1) group by category order by category`,
    [MOVE]
  )
).rows
console.table(counts)
const totalToMove = counts.reduce((s, r) => s + r.n, 0)

const depAnswers = (
  await c.query(
    `select count(*)::int n from test_answers ta join questions q on q.id = ta.question_id where q.category = any($1)`,
    [MOVE]
  )
).rows[0].n
console.log(`Rows to move: ${totalToMove}  |  dependent test_answers: ${depAnswers}`)

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to move + delete.')
  await c.end()
  process.exit(0)
}

try {
  await c.query('begin')
  // Faithful structural copy (one-time) — holds everything we remove.
  await c.query(`create table if not exists public.questions_backup (like public.questions including all)`)

  // Copy rows not already backed up (idempotent across re-runs).
  const cp = await c.query(
    `insert into public.questions_backup
       select * from public.questions q
       where q.category = any($1)
         and not exists (select 1 from public.questions_backup b where b.id = q.id)`,
    [MOVE]
  )
  console.log(`Backed up ${cp.rowCount} rows into questions_backup.`)

  // Remove dependent test_answers first (FK has no cascade). These reference
  // only mock-era questions being retired.
  const da = await c.query(
    `delete from public.test_answers ta using public.questions q
       where q.id = ta.question_id and q.category = any($1)`,
    [MOVE]
  )
  console.log(`Deleted ${da.rowCount} dependent test_answers.`)

  // Remove the moved questions from the live table.
  const dq = await c.query(`delete from public.questions where category = any($1)`, [MOVE])
  console.log(`Deleted ${dq.rowCount} rows from live questions.`)

  await c.query('commit')
  console.log('\nCOMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

const after = (
  await c.query(`select category, count(*)::int n from questions group by category order by category`)
).rows
console.log('\nLive questions by category now:')
console.table(after)
const bk = (await c.query(`select count(*)::int n from questions_backup`)).rows[0].n
console.log(`questions_backup total: ${bk}`)
await c.end()
