import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
})
await c.connect()

const q = (s) => c.query(s).then((r) => r.rows)

console.log('Before:')
console.table(await q(`
  select coalesce(source_url='tnpsc-official','f') as is_real, ca_type, count(*)::int n
  from questions where category='current_affairs'
  group by 1,2 order by 1,2`))

try {
  await c.query('begin')

  // The scraped CA question ids being purged.
  const targets = `
    select id from questions
    where category='current_affairs'
      and (source_url is distinct from 'tnpsc-official')`

  // Clear dependents first (test_answers has no ON DELETE CASCADE; review_items
  // would cascade but we remove explicitly for a clear count). Pre-launch only.
  const ans = await c.query(
    `delete from test_answers where question_id in (${targets})`
  )
  console.log(`\nDeleted ${ans.rowCount} dependent test_answers`)
  const rev = await c.query(
    `delete from review_items where question_id in (${targets})`
  )
  console.log(`Deleted ${rev.rowCount} dependent review_items`)

  // Now delete the scraped CA questions themselves.
  const del = await c.query(`
    delete from questions
    where category='current_affairs'
      and (source_url is distinct from 'tnpsc-official')`)
  console.log(`Deleted ${del.rowCount} scraped CA rows`)
  await c.query('commit')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}

console.log('\nAfter (current_affairs only):')
console.table(await q(`
  select ca_type, count(*)::int n, count(question_text_ta)::int has_tamil
  from questions where category='current_affairs' group by ca_type order by ca_type`))

console.log('\nFull bank by category (sanity — other categories untouched):')
console.table(await q(`select category, count(*)::int n from questions group by category order by category`))

await c.end()
