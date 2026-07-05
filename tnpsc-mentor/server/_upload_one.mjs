import 'dotenv/config'
import { readFileSync } from 'node:fs'

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'question-images'
if (!SUPABASE_URL || !KEY) { console.error('no env'); process.exit(2) }

const localPath = process.argv[2]
const objectName = process.argv[3]
const body = readFileSync(localPath)
const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(objectName)}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true', 'cache-control': '3600' },
  body,
})
if (!res.ok) { console.error('FAIL', res.status, await res.text()); process.exit(1) }
console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectName}`)
