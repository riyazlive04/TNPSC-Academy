import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const ids = [
  '000181c8-76d1-4701-80e7-2df650616048','5634d14a-b556-4863-98f7-8517b36b5dc8',
  '03867245-4bd6-4100-9c99-40d6a689c023','597d5a45-880c-4f19-a592-04daa703adae',
  '062b136f-3800-419d-9de0-794c3948426f','76f74247-9556-471b-aff3-b1212def02c1',
  '1f93f581-cd2a-42a1-abf8-0605f7c07d7d','c1c652ac-dff7-4e24-a161-0daabd45a3f2',
  '26eda9fd-1f26-4d42-8558-bf5592cd146e','a11155e0-8d4e-46f0-967b-0ae3a9d70523',
  '36e0db2b-3a12-4aac-95a7-17739a6f6b70','674a4c9c-e439-4284-85fb-a7e7ca91019f',
  '46d8afb4-f3ba-42dc-92c1-ae118fb2cc2a','db416d62-3732-404d-8ee9-dbd24d278a54',
  '48f4d32a-a379-4e80-a882-f209c0386796','4911f244-81b5-417a-9709-c52116ae21b3',
  '650ee18c-5b46-4248-9615-bbe540d7b649','93c6cb14-b75a-4890-98bf-8d2d81f87019',
  '75d7006e-ca31-475a-ac1d-a7c75df711d2','ec78ceed-44fe-4ed6-b60f-c64eb76d84e8',
  '8d0d3d18-0629-434f-b9a4-47b538d6eb6a','e1de31d3-0236-44a2-8772-b1624764fb28',
  '00cc0e01-6c03-42ad-b45e-9b35640db840','e6706e4a-102f-49a8-9289-7cf50f06b409',
  '13450074-5ede-4031-b124-611f10c78c1f','51081289-2c2e-428f-9322-32397ee937b2',
  '1e072779-3909-469a-976d-f567590ec177','68821949-3fa2-4770-9725-acbcfc9a7449',
  '20af0a7b-a748-4dc6-a6da-a88b409f72b0','32fc7eee-e9aa-4e89-969c-72a3c94483ed',
  '2fbff59e-4269-4a00-8fb4-c47723bf4a46','d9210e57-8019-4fe2-a384-d8ed861cf608',
  '443d3e9d-7f4a-4ad0-813c-b8483597a67c','ada3731d-cfa4-4cd4-a8be-ca5727406b98',
  '48f57a7d-0456-4948-b29f-cae1f68450a8','94e3b493-b96a-4245-ada7-256d33ad792b',
  '496c95e8-9332-4987-86d3-6cc1930d7ebb','7c7518a3-9d2e-4c82-b83e-388f90d968f2',
  '525f6af1-f9ce-454e-9cf4-e12b4dabc5c6','54b8f9aa-d349-4277-a5a8-28c396e23ea3',
  '58649618-a651-4b48-a1d8-d4bf2b09799d','b4f1c168-809a-41ff-851b-b3b9d5a0f2f8',
  '61b9a4c7-a431-4a9b-842f-0f1b68f32a2e','7dcafa47-1f6f-4b4d-a8c5-9bc07825dcbe','c91b8a77-ffbe-4e5e-853d-5d87b60bed30',
  '6d6d7375-6455-4d6c-8301-bba11bf18a61','c8737714-ad68-48aa-8b41-a3138448a128',
  '7b4a0f6d-03e5-465a-a55c-ef5c60dc393d','bfc745e1-bab0-41fa-8ad8-8a4f8f766091',
  'c213df2c-abb8-4ae9-8801-b8e34954f9a4','d3b6c5bb-c246-4c08-8d78-41dad7282898',
  'cd048abd-6b69-48a0-990d-d3878f94d00e','d1070e72-1c74-47f4-87c9-a29e37c6b85c',
]

const { rows } = await c.query(`select id, aptitude_topic, aptitude_type, subject, question_text_ta,
    option_a_ta, option_b_ta, option_c_ta, option_d_ta,
    (select count(*) from bookmarks b where b.question_id=q.id)::int n_book,
    (select count(*) from seen_questions s where s.question_id=q.id)::int n_seen,
    (select count(*) from test_answers t where t.question_id=q.id)::int n_ans
  from questions q where id = any($1::uuid[])`, [ids])

console.log('total rows found:', rows.length)
const hasTamil = rows.filter((r) => r.question_text_ta).length
console.log('rows with Tamil question_text_ta populated:', hasTamil, '/', rows.length)
console.log('distinct aptitude_type values:', [...new Set(rows.map(r=>r.aptitude_type))])
console.log('distinct subject values:', [...new Set(rows.map(r=>r.subject))])
console.log('\nper-row refs (book/seen/ans):')
rows.forEach((r) => console.log(`  ${r.id.slice(0,8)} book=${r.n_book} seen=${r.n_seen} ans=${r.n_ans} tamil=${!!r.question_text_ta} apt_type=${r.aptitude_type}`))
await c.end()
