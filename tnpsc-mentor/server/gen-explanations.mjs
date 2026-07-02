/**
 * Explanation backfill — pilot: subject = Polity.
 *
 * TWO-STEP, WEB-GROUNDED pipeline:
 *   1) RESEARCH — Claude with the web_search tool gathers facts from competitive
 *      exam websites (Vajiram, NextIAS, StudyIQ, Drishti, BYJU'S, …), cross-checked
 *      against the standard books (NCERT, Samacheer Kalvi, M. Laxmikanth). Returns
 *      concise factual notes. (Tools + citations don't mix with strict JSON, so
 *      research is a separate call from the structured write.)
 *   2) WRITE  — Claude with structured output writes the ≥200-word bilingual
 *      explanation from those notes, using the book-Tamil glossary terms.
 *
 * Question handling:
 *   - statement-type (statements / assertion_reason / match / chronological):
 *       analyse each numbered item + why the correct combination is right.
 *   - factual/direct: explain the correct answer AND each of the other options
 *       (stored in option_explanations).
 *
 * Writes: explanation, explanation_ta, option_explanations, expl_status='generated'.
 * UPDATE-by-id, never delete+reinsert (preserves user history).
 *
 * Usage:
 *   node gen-explanations.mjs --sample 5            # sync 2-step, prints, NO db write
 *   node gen-explanations.mjs --sample 5 --write    # sync, writes those rows
 *   node gen-explanations.mjs --run                 # full run (research sync, write sequential)
 *   node gen-explanations.mjs --run --limit 50      # bounded
 *   node gen-explanations.mjs --run --batch-write   # full run, step-2 writes via Batch API (50% off)
 *
 * Env: ANTHROPIC_API_KEY + SUPABASE_DB_* (server/.env).
 */
import { Client } from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL = 'claude-opus-4-8'
const GLOSSARY = join(__dirname, '..', '..', '..', 'glossary', 'polity_glossary_index.md')

// Competitive-exam sites preferred for grounding; books are the authority.
const EXAM_DOMAINS = [
  'vajiramandravi.com', 'nextias.com', 'studyiq.com', 'drishtiias.com',
  'byjus.com', 'unacademy.com', 'testbook.com', 'insightsonindia.com',
  'constitutionofindia.net', 'indiacode.nic.in', 'tnpscguru.in',
]
const BOOKS = 'NCERT textbooks, Tamil Nadu Samacheer Kalvi State Board books, and M. Laxmikanth — Indian Polity'

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d }
const MODE = has('--run') ? 'run' : 'sample'
const SAMPLE_N = Number(val('--sample', 5))
const LIMIT = val('--limit') ? Number(val('--limit')) : null
const WRITE = has('--write')
const BATCH_WRITE = has('--batch-write')

// ─── db ──────────────────────────────────────────────────────────────────────
function db() {
  const REF = process.env.SUPABASE_DB_USER?.split('.')[1] ?? 'cwpdkhfsyujfjcwbnhdo'
  return new Client({
    host: process.env.SUPABASE_DB_HOST ?? 'aws-1-ap-southeast-2.pooler.supabase.com',
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER ?? `postgres.${REF}`,
    password: process.env.SUPABASE_DB_PASSWORD ?? process.env.DB_PASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false }, statement_timeout: 60000,
  })
}

// ─── glossary: English term → Book Tamil ──────────────────────────────────────
function loadGlossary() {
  const text = readFileSync(GLOSSARY, 'utf8')
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/)
    if (!m) continue
    const en = m[1].trim()
    if (!en || en === 'English' || en.startsWith('---')) continue
    let ta = m[2].split(/[/⁄]/)[0].replace(/\s*\([\d,\s]+\)\s*/g, ' ').trim()
    if (en.length >= 3 && ta) map.set(en.toLowerCase(), { en, ta })
  }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length)
  return { map, keys }
}
function matchTerms(glossary, text, cap = 24) {
  const hay = text.toLowerCase(); const out = []; const used = []
  for (const k of glossary.keys) {
    if (out.length >= cap) break
    if (k.length < 4 || !hay.includes(k)) continue
    if (used.some((u) => u.includes(k))) continue
    used.push(k); out.push(glossary.map.get(k))
  }
  return out
}

// ─── prompts ──────────────────────────────────────────────────────────────────
const STATEMENT_TYPES = new Set(['statements', 'assertion_reason', 'assertion_reasoning', 'match', 'chronological', 'statement_correct', 'statement_incorrect'])
const isFactualType = (t) => !STATEMENT_TYPES.has(t || '')

function qBlock(q) {
  return `TOPIC: ${q.topic || 'Polity'}
QUESTION:
${q.question_text}
OPTIONS:
A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}
CORRECT ANSWER: ${q.correct_answer}`
}

function researchPrompt(q) {
  return `You are researching one TNPSC (Tamil Nadu) Polity exam question. Use web_search to pull accurate, current content from Indian competitive-exam websites (e.g. Vajiram & Ravi, NextIAS, StudyIQ, Drishti IAS, BYJU'S), and align everything to the standard books: ${BOOKS}.

${qBlock(q)}

Return CONCISE factual notes (English, plain text — no preamble) covering:
- The exact constitutional basis (Article / Part / Schedule / Section), the relevant Act or Amendment with its year, and any landmark case or body.
- Why the given correct answer is right.
- For a factual question: what each of the four options actually refers to and why the wrong ones don't fit.
- For a statement/assertion question: whether each numbered statement is correct and why.
- Any exam-relevant dates, numbers, or common traps.
Keep it factual and verifiable. If sources conflict, prefer the books. Do not write the final explanation yet — just the notes.`
}

function writePrompt(q, terms, notes) {
  const factual = isFactualType(q.question_type)
  const gloss = terms.length
    ? terms.map((t) => `  - ${t.en} → ${t.ta}`).join('\n')
    : '  (none matched — use standard book Tamil terminology)'
  let p = `You are a senior TNPSC Polity faculty member writing the official answer-explanation for one exam question, in English and Tamil, using the researched notes below.

${qBlock(q)}

RESEARCHED NOTES (grounded in competitive-exam sites + ${BOOKS}):
${notes}

BOOK GLOSSARY (use these exact Tamil terms for the matched English terms — do NOT invent your own translation for them):
${gloss}

REQUIREMENTS:
- English "explanation": one self-contained teaching paragraph, AT LEAST 200 words, combining the question and its answer so a student who reads only this learns the full point.
- Include RELEVANT additional information from the notes (article/amendment/case/body, key dates, exam context) — not a bare restatement.
- Be factually accurate and consistent with the notes and the given correct answer. Never change the correct answer. If unsure of a specific fact, stay general.
- Tamil "explanation_ta": a faithful translation of the SAME content, also ≥200 words of Tamil, using the Book-Tamil terms above; do not transliterate English where a book Tamil term exists.`
  if (factual) {
    p += `\n- Also fill "option_explanations" for A,B,C,D (each with en + ta): why the correct one is right; for each wrong one, what it actually refers to and why it doesn't fit.`
  } else {
    p += `\n- Walk through each numbered statement / the assertion & reason, then explain why the chosen option is the right combination. Leave "option_explanations" empty.`
  }
  return p
}

const OPT = { type: 'object', additionalProperties: false, properties: { en: { type: 'string' }, ta: { type: 'string' } }, required: ['en', 'ta'] }
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    explanation: { type: 'string' }, explanation_ta: { type: 'string' },
    option_explanations: { type: 'object', additionalProperties: false, properties: { A: OPT, B: OPT, C: OPT, D: OPT }, required: ['A', 'B', 'C', 'D'] },
  },
  required: ['explanation', 'explanation_ta'],
}

// ─── step 1: research (web_search, handle pause_turn) ─────────────────────────
async function research(anthropic, q) {
  const messages = [{ role: 'user', content: researchPrompt(q) }]
  let res
  for (let i = 0; i < 6; i++) {
    res = await anthropic.messages.create({
      model: MODEL, max_tokens: 3000, thinking: { type: 'adaptive' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, allowed_domains: EXAM_DOMAINS }],
      messages,
    })
    if (res.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: res.content }) // resume server tool loop
  }
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

// ─── step 2: write (structured output) ────────────────────────────────────────
function writeParams(q, terms, notes) {
  return {
    model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: writePrompt(q, terms, notes) }],
  }
}
async function write(anthropic, q, terms, notes) {
  const res = await anthropic.messages.create(writeParams(q, terms, notes))
  return JSON.parse(res.content.find((b) => b.type === 'text').text)
}

// ─── db ───────────────────────────────────────────────────────────────────────
async function save(client, id, out, factual) {
  await client.query(
    `update questions set explanation=$1, explanation_ta=$2, option_explanations=$3, expl_status='generated' where id=$4`,
    [out.explanation, out.explanation_ta, factual ? (out.option_explanations ?? null) : null, id]
  )
}
async function fetchRows(client, n) {
  const r = await client.query(
    `select id, category, topic, question_type, question_text, option_a, option_b, option_c, option_d, correct_answer
       from questions
      where subject='Polity' and category in ('subject','mock','pyq')
        and expl_status is distinct from 'generated' and expl_status is distinct from 'verified'
      order by category, external_id ${n ? 'limit ' + n : ''}`)
  return r.rows
}

// ─── modes ────────────────────────────────────────────────────────────────────
async function runSample() {
  const anthropic = new Anthropic(); const glossary = loadGlossary()
  const client = db(); await client.connect()
  const rows = await fetchRows(client, SAMPLE_N)
  console.log(`Sample: ${rows.length} Polity rows (write=${WRITE})\n`)
  for (const q of rows) {
    const factual = isFactualType(q.question_type)
    const terms = matchTerms(glossary, `${q.question_text} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d}`)
    process.stdout.write(`  researching ${q.id} …\r`)
    const notes = await research(anthropic, q)
    const out = await write(anthropic, q, terms, notes)
    const wc = out.explanation.trim().split(/\s+/).length
    console.log('━'.repeat(80))
    console.log(`[${q.question_type}] ${q.topic}  (${q.id})`)
    console.log(`matched terms: ${terms.map((t) => t.en).join(', ') || '(none)'}`)
    console.log(`EN (${wc} words):\n${out.explanation}\n\nTA:\n${out.explanation_ta}\n`)
    if (factual && out.option_explanations) { for (const k of ['A', 'B', 'C', 'D']) console.log(`  ${k}: ${out.option_explanations[k].en}`); console.log() }
    if (WRITE) { await save(client, q.id, out, factual); console.log('  -> written\n') }
  }
  await client.end()
}

async function runFull() {
  const anthropic = new Anthropic(); const glossary = loadGlossary()
  const client = db(); await client.connect()
  const rows = await fetchRows(client, LIMIT)
  console.log(`Full run: ${rows.length} rows  (batch-write=${BATCH_WRITE})`)
  const prepared = [] // {q, terms, notes, factual}
  let i = 0
  for (const q of rows) {
    i++
    const factual = isFactualType(q.question_type)
    const terms = matchTerms(glossary, `${q.question_text} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d}`)
    try {
      const notes = await research(anthropic, q)
      prepared.push({ q, terms, notes, factual })
    } catch (e) { console.error(`\n  research failed ${q.id}: ${e.message}`) }
    process.stdout.write(`  researched ${i}/${rows.length}\r`)
  }
  console.log(`\nResearch done: ${prepared.length} ready.`)

  if (BATCH_WRITE) {
    const requests = prepared.map((p) => ({ custom_id: p.q.id, params: writeParams(p.q, p.terms, p.notes) }))
    const meta = new Map(prepared.map((p) => [p.q.id, p.factual]))
    const batch = await anthropic.messages.batches.create({ requests })
    console.log(`Batch ${batch.id} — polling …`)
    let b = batch
    while (b.processing_status !== 'ended') {
      await new Promise((r) => setTimeout(r, 30000))
      b = await anthropic.messages.batches.retrieve(batch.id)
      process.stdout.write(`  ${b.processing_status} done=${b.request_counts.succeeded} err=${b.request_counts.errored}\r`)
    }
    let ok = 0, fail = 0
    for await (const r of await anthropic.messages.batches.results(batch.id)) {
      if (r.result.type !== 'succeeded') { fail++; continue }
      try { const out = JSON.parse(r.result.message.content.find((x) => x.type === 'text').text); await save(client, r.custom_id, out, meta.get(r.custom_id)); ok++ } catch { fail++ }
    }
    console.log(`\nDone. written=${ok} failed=${fail} (batch ${batch.id})`)
  } else {
    let ok = 0, fail = 0
    for (const p of prepared) {
      try { const out = await write(anthropic, p.q, p.terms, p.notes); await save(client, p.q.id, out, p.factual); ok++ }
      catch (e) { fail++; console.error(`\n  write failed ${p.q.id}: ${e.message}`) }
      process.stdout.write(`  written ${ok}/${prepared.length}\r`)
    }
    console.log(`\nDone. written=${ok} failed=${fail}`)
  }
  await client.end()
}

if (!process.env.ANTHROPIC_API_KEY) { console.error('FATAL: ANTHROPIC_API_KEY not set'); process.exit(2) }
;(MODE === 'run' ? runFull() : runSample()).catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
