import 'dotenv/config'
import { Client } from 'pg'

const c = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
})
await c.connect()
const sql = process.argv[2]
const res = await c.query(sql)
console.log(JSON.stringify(res.rows, null, 2))
await c.end()
