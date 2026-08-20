import 'dotenv/config'
import { Client } from 'pg'
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(`
  select table_name, column_name from information_schema.columns
  where table_schema='public' and (column_name ilike '%question_text%' or table_name ilike '%question%')
  order by table_name, column_name`)
console.log(JSON.stringify(rows, null, 1))
const { rows: cnt } = await c.query(`
  select table_name from information_schema.tables where table_schema='public' and table_name ilike '%question%'`)
console.log('\nQUESTION-LIKE TABLES:', cnt.map(r=>r.table_name))
await c.end()
