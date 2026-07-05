import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'question-images'
if (!SUPABASE_URL || !KEY) { console.error('missing env'); process.exit(2) }

// local crop -> bucket object -> DB question id
const JOBS = [
  { file: '_imgcache/q54_circle.png',  object: 'pyq/2022/q54.png',  id: 'd07bcc64-f4a0-4fac-ad8f-b87a08a16ebf' },
  { file: '_imgcache/q152_grid.png',   object: 'pyq/2022/q152.png', id: 'c288c3c4-c247-4c1a-bcaa-bdd6e7278922' },
  { file: '_imgcache/q153_cube.png',   object: 'pyq/2022/q153.png', id: '241c7f24-08c0-4d2b-9a2e-b4d21191feef' },
  { file: '_imgcache/q200_cube.png',   object: 'pyq/2025/q200.png', id: 'db885766-c9da-40f5-ac99-a85025297478' },
]

const c = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
})
await c.connect()

for (const j of JOBS) {
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${j.object}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: readFileSync(j.file),
  })
  if (!up.ok) { console.error(`UPLOAD FAIL ${j.object}: ${up.status} ${await up.text()}`); continue }
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${j.object}`
  const res = await c.query('update public.questions set images = $1 where id = $2', [JSON.stringify([url]), j.id])
  console.log(`OK ${j.object} -> row updated: ${res.rowCount} | ${url}`)
}
await c.end()
