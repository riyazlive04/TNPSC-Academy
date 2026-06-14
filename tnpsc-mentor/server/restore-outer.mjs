import 'dotenv/config'
import { Client } from 'pg'

/**
 * Restores the admin-only Outer question bank (category='outer', ~28.6k rows)
 * from questions_backup back into the live `questions` table.
 *
 * The 2026-06-14 restructure (backup-and-purge.mjs) moved pyq/samacheer/aptitude/
 * outer into questions_backup. PYQ was reloaded from pyq_all/; Outer was left in
 * the backup, so the admin "Outer Questions" view showed nothing. This copies the
 * archived rows back verbatim (same ids — backup is `like questions including all`,
 * columns are identical). Idempotent by id.
 *
 *   node restore-outer.mjs          # dry-run: counts only
 *   APPLY=1 node restore-outer.mjs  # perform the restore
 */

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

const inBackup = (await c.query("select count(*)::int n from questions_backup where category='outer'")).rows[0].n
const liveNow = (await c.query("select count(*)::int n from questions where category='outer'")).rows[0].n
const toRestore = (await c.query(
  `select count(*)::int n from questions_backup b
     where b.category='outer'
       and not exists (select 1 from questions q where q.id = b.id)`
)).rows[0].n
console.log(`outer in backup: ${inBackup} | live now: ${liveNow} | will restore: ${toRestore}`)

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to restore.')
  await c.end()
  process.exit(0)
}

try {
  await c.query('begin')
  const res = await c.query(
    `insert into public.questions
       select * from public.questions_backup b
       where b.category='outer'
         and not exists (select 1 from public.questions q where q.id = b.id)`
  )
  console.log(`Restored ${res.rowCount} outer rows.`)
  await c.query('commit')
  console.log('COMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.table((await c.query("select category, count(*)::int n from questions group by category order by category")).rows)
console.table((await c.query("select subject, count(*)::int n from questions where category='outer' group by subject order by n desc")).rows)
await c.end()
