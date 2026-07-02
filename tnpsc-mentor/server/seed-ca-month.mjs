import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'

/**
 * Insert-only seed for a NEW current_affairs month.
 *
 * Unlike load-ca.mjs (delete-by-external_id + re-insert — destroys FK history
 * when the ids already exist) this ONLY inserts rows whose external_id is not
 * already in the DB, and reads a single month's source file so existing months
 * are never touched. Bilingual en/ta source rows (sharing a `qid`) are collapsed
 * into one DB row, mirroring merge_ca.mjs.
 *
 * Usage:
 *   node seed-ca-month.mjs            # DRY RUN — reports what would insert
 *   APPLY=1 node seed-ca-month.mjs    # insert new rows in a transaction
 */

const SRC =
  'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/Current_affairs_10Months/current_affairs_2026-06.json'
const APPLY = process.env.APPLY === '1'

const DIFF_MAP = {
  easy: 'easy', medium: 'medium', hard: 'hard',
  'very tough': 'hard', very_tough: 'hard', tough: 'hard',
}
const normDiff = (v) => (v ? DIFF_MAP[String(v).trim().toLowerCase()] ?? 'medium' : 'medium')

// ── Merge bilingual source rows -> one DB-shaped record per qid ───────────────
const raw = JSON.parse(readFileSync(SRC, 'utf8').replace(/^﻿/, ''))
const byQid = new Map()
for (const r of raw) {
  const m = byQid.get(r.qid) ?? {}
  m[r.language ?? 'en'] = r
  byQid.set(r.qid, m)
}
const data = []
for (const [qid, pair] of byQid) {
  const en = pair.en ?? Object.values(pair)[0]
  const ta = pair.ta ?? null
  data.push({
    category: 'current_affairs',
    ca_type: en.ca_type || 'month_wise',
    ca_month: en.ca_month ?? null,
    ca_year: en.ca_year ?? null,
    ca_topic: null,
    topic: en.topic ?? null,
    question_type: en.question_type ?? null,
    external_id: qid,
    question_text: en.question_text ?? null,
    option_a: en.option_a ?? null,
    option_b: en.option_b ?? null,
    option_c: en.option_c ?? null,
    option_d: en.option_d ?? null,
    correct_answer: (en.correct_answer || '').trim().toUpperCase(),
    explanation: en.explanation ?? null,
    difficulty: normDiff(en.difficulty),
    source_url: 'tnpsc-official',
    why_wrong: en.why_wrong || null,
    question_text_ta: ta ? ta.question_text : null,
    option_a_ta: ta ? ta.option_a : null,
    option_b_ta: ta ? ta.option_b : null,
    option_c_ta: ta ? ta.option_c : null,
    option_d_ta: ta ? ta.option_d : null,
    explanation_ta: ta ? ta.explanation : null,
  })
}
const months = [...new Set(data.map((d) => d.ca_month))]
console.log(`Merged ${data.length} questions from ${raw.length} source rows | months: ${months.join(', ')}`)

const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME, ssl: { rejectUnauthorized: false },
  statement_timeout: 180000,
})
await c.connect()

// Guard: only insert external_ids that do NOT already exist (protect FK history).
const ids = data.map((d) => d.external_id)
const existing = new Set(
  (await c.query(
    `select external_id from questions where category='current_affairs' and external_id = any($1::text[])`,
    [ids]
  )).rows.map((r) => r.external_id)
)
const toInsert = data.filter((d) => !existing.has(d.external_id))
console.log(`already in DB (skip): ${existing.size} | new to insert: ${toInsert.length}`)

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with APPLY=1 to insert.')
  if (existing.size) console.log('  (existing ids left untouched:', [...existing].slice(0, 5), '…)')
  await c.end()
  process.exit(0)
}

if (!toInsert.length) {
  console.log('\nNothing new to insert.')
  await c.end()
  process.exit(0)
}

const before = (await c.query(`select count(*)::int n from questions where category='current_affairs'`)).rows[0].n
try {
  await c.query('begin')
  const ins = await c.query(
    `
    insert into questions (
      category, ca_type, ca_month, ca_year, ca_topic, topic, question_type,
      external_id, question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, difficulty, source_url, why_wrong,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta
    )
    select
      e->>'category',
      nullif(e->>'ca_type',''),
      nullif(e->>'ca_month',''),
      nullif(e->>'ca_year','')::int,
      nullif(e->>'ca_topic',''),
      nullif(e->>'topic',''),
      nullif(e->>'question_type',''),
      nullif(e->>'external_id',''),
      e->>'question_text',
      e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
      upper(e->>'correct_answer'),
      nullif(e->>'explanation',''),
      coalesce(nullif(e->>'difficulty',''),'medium'),
      coalesce(nullif(e->>'source_url',''),'tnpsc-official'),
      case when e->'why_wrong' in ('null'::jsonb,'{}'::jsonb) or e->'why_wrong' is null
           then null else e->'why_wrong' end,
      nullif(e->>'question_text_ta',''),
      nullif(e->>'option_a_ta',''), nullif(e->>'option_b_ta',''),
      nullif(e->>'option_c_ta',''), nullif(e->>'option_d_ta',''),
      nullif(e->>'explanation_ta','')
    from jsonb_array_elements($1::jsonb) as e
    `,
    [JSON.stringify(toInsert)]
  )
  console.log(`  inserted ${ins.rowCount} rows`)
  await c.query('commit')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLED BACK:', e.message)
  process.exit(1)
}
const after = (await c.query(`select count(*)::int n from questions where category='current_affairs'`)).rows[0].n
console.log(`\nCA rows: ${before} -> ${after}`)
await c.end()
