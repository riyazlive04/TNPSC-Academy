import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const files = {
  subject: '_dedup_v2_subject.json',
  pyq: '_dedup_v2_pyq.json',
  pyq2: '_dedup_v2_pyq2.json',
  pyq4: '_dedup_v2_pyq4.json',
}

// inspect columns
const colRes = await c.query(`select column_name from information_schema.columns where table_name='questions' order by ordinal_position`)
console.log('COLUMNS:', colRes.rows.map(r=>r.column_name).join(', '))

const out = {}
for (const [cat, file] of Object.entries(files)) {
  const groups = JSON.parse(readFileSync(file, 'utf8'))
  const allIds = groups.flatMap(g => g.rows.map(r => r.id))
  const { rows } = await c.query(`select q.*,
      (select count(*) from bookmarks b where b.question_id=q.id) n_book,
      (select count(*) from seen_questions s where s.question_id=q.id) n_seen,
      (select count(*) from test_answers t where t.question_id=q.id) n_ans
    from questions q where q.id = any($1::uuid[])`, [allIds])
  const byId = new Map(rows.map(r => [r.id, r]))
  out[cat] = groups.map(g => ({
    sig: g.sig,
    rows: g.rows.map(r => byId.get(r.id) || { id: r.id, MISSING: true })
  }))
}
writeFileSync('_dedup_batch_full.json', JSON.stringify(out, null, 1))
console.log('done, wrote _dedup_batch_full.json')
await c.end()
