import { Client } from 'pg'

const HOST = process.env.SUPABASE_DB_HOST
const PORT = Number(process.env.SUPABASE_DB_PORT ?? 5432)
const USER = process.env.SUPABASE_DB_USER
const PASSWORD = process.env.SUPABASE_DB_PASSWORD
const DB = process.env.SUPABASE_DB_NAME ?? 'postgres'

const sql = process.argv.slice(2).join(' ')
if (!sql) {
  console.error('usage: node query.mjs "<sql>"')
  process.exit(2)
}

const client = new Client({
  host: HOST,
  port: PORT,
  user: USER,
  password: PASSWORD,
  database: DB,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

await client.connect()
try {
  const res = await client.query(sql)
  console.log(JSON.stringify(res.rows, null, 2))
} finally {
  await client.end()
}
