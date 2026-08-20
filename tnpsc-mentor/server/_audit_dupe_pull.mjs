import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const ids = [
  'b7d85f5a-1494-4296-95c6-aaef71b1133c','657765b2-584b-45f6-8453-b97158347f9d',
  'c956d9d0-5876-4eb7-982b-b765552acb06','369bf481-6cb8-4228-99f6-0bca2091beeb',
  '959f445f-1344-4d14-836d-e4a2eccdf968','5ec888a6-1540-44f9-804b-f8666997e2b4',
  '68a5f574-002f-4b04-88e9-438c2432929e','b96e760e-c358-4762-b3fe-8ba81d76699d','c5989dfb-ac43-4b13-8070-32c631e4bfa7',
  '1dc0c379-6bdb-4e5e-b098-763308f9a6e5','863eab10-33b2-4ad2-a3b3-ccc3216bc4be',
  '366fd959-ac3d-4601-ab48-7682a2367d97','7b4a0f6d-03e5-465a-a55c-ef5c60dc393d',
  'a43bd9f0-3afc-41a0-9622-9379ecd018dc','c8222b55-ba97-474c-8899-4eb9c8299f38',
  '07ae6028-52d2-423d-9549-ad1dd9825dc3','9c61a76e-e624-4834-9020-8d4f262cf9f0','b66c0f41-b424-4754-a747-136d51af25e7',
  '710d0586-fdfb-4096-b4ca-28e3cb2279f7','ea987b69-d0b9-4f2c-9a53-a62c94cb6593',
  'a3c7a607-955e-450c-919c-db72b2ede2c2','540cc703-a8a8-481f-a325-b67e0bb95c12',
]
const { rows } = await c.query(`select id::text as id, aptitude_topic, question_text, question_text_ta,
    option_a,option_b,option_c,option_d, option_a_ta,option_b_ta,option_c_ta,option_d_ta,
    correct_answer, explanation, explanation_ta,
    (select count(*) from bookmarks b where b.question_id=q.id)::int n_book,
    (select count(*) from seen_questions s where s.question_id=q.id)::int n_seen,
    (select count(*) from test_answers t where t.question_id=q.id)::int n_ans
  from questions q where id::text = any($1)`, [ids])
console.log('found', rows.length, 'of', ids.length)
writeFileSync('_audit_dupe_full.json', JSON.stringify(rows, null, 1))
await c.end()
