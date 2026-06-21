import { Client } from 'pg'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Preview how a question renders, by id — without starting a test.
 * Mirrors the frontend display helpers (en / ta / both fallback logic) so you
 * can verify the exact text a student sees in each language mode.
 *
 * Usage:
 *   node preview-question.mjs <id> [<id> ...]
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

const ids = process.argv.slice(2)
if (!ids.length) {
  console.error('Usage: node preview-question.mjs <question-id> [<id> ...]')
  process.exit(2)
}

const client = new Client({
  host: process.env.SUPABASE_DB_HOST ?? 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? 'postgres.cwpdkhfsyujfjcwbnhdo',
  password: process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
})

// Frontend fallback logic (see src/types/index.ts displayQuestion/displayOption)
const pick = (en, ta, lang) => {
  const t = ta?.toString().trim()
  if (lang === 'ta' && t) return t
  if (lang === 'both' && t) return `${en} / ${t}`
  return en ?? ''
}
const LETTERS = ['a', 'b', 'c', 'd']

await client.connect()
for (const id of ids) {
  const { rows } = await client.query(
    `select id, category, aptitude_type, aptitude_topic, subject, topic,
            question_text, question_text_ta,
            option_a, option_b, option_c, option_d,
            option_a_ta, option_b_ta, option_c_ta, option_d_ta,
            correct_answer, images
     from public.questions where id = $1`, [id])
  if (!rows.length) { console.log(`\n❌ ${id} — not found`); continue }
  const q = rows[0]
  console.log('\n' + '='.repeat(70))
  console.log(`id: ${q.id}`)
  console.log(`category: ${q.category}  type: ${q.aptitude_type ?? '-'}  topic: ${q.aptitude_topic ?? q.topic ?? '-'}`)
  console.log(`images: ${q.images ? JSON.stringify(q.images) : 'none'}`)
  for (const lang of ['en', 'ta', 'both']) {
    console.log(`\n--- [${lang}] ---`)
    console.log('Q: ' + pick(q.question_text, q.question_text_ta, lang))
    for (const L of LETTERS) {
      const mark = q.correct_answer?.toLowerCase() === L ? ' ✓' : ''
      console.log(`  (${L.toUpperCase()}) ` + pick(q[`option_${L}`], q[`option_${L}_ta`], lang) + mark)
    }
  }
}
await client.end()
