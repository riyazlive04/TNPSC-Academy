import { Client } from 'pg'
import { config } from 'dotenv'
config()

const REF = process.env.SUPABASE_DB_USER?.split('.')[1] ?? 'cwpdkhfsyujfjcwbnhdo'
const client = new Client({
  host: process.env.SUPABASE_DB_HOST ?? 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? `postgres.${REF}`,
  password: process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
const { rows } = await client.query(`
  select subject, topic, count(*)::int as n
  from questions
  where category = 'subject'
  group by subject, topic
  order by subject, n asc
`)
console.log(JSON.stringify(rows, null, 0))
await client.end()
