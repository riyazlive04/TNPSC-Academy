/**
 * PYQ explanation rewrite — Group 1 (category='pyq') + Group 2 (category='pyq2').
 *
 * Rewrites every PYQ explanation in the mentor's voice, routed by subject:
 *
 *   ACADEMIC  (History, Polity, Geography, Economy, Dev-Admin, Science, GS)
 *       → TWO-STEP web-grounded pipeline (same as gen-explanations.mjs):
 *         1) RESEARCH — Claude + web_search over competitive-exam sites, aligned
 *            to the Tamil Nadu Samacheer Kalvi books (the authority).
 *         2) WRITE — ≥200-word bilingual teaching explanation + per-option notes,
 *            using the subject's book-Tamil glossary.
 *
 *   APTITUDE  (subject='Aptitude')
 *       → SINGLE-STEP, no web. A fully worked, line-by-line solution in the exact
 *         style of the TNPSC.Academy Aptitude books (E.F.pdf / T.F.pdf): one
 *         operation per line with short bracketed rule notes, bilingual.
 *
 *   LANGUAGE  (English, Tamil)
 *       → SINGLE-STEP, no web. Teaches the grammar / vocabulary / literature rule,
 *         why the key is right and each distractor wrong, bilingual. Tamil literary
 *         facts aligned to the Samacheer Kalvi Tamil readers.
 *
 * Writes: explanation, explanation_ta, option_explanations, expl_status='generated'.
 * UPDATE-by-id, never delete+reinsert (preserves user history).
 *
 * Usage:
 *   node gen-pyq-explanations.mjs --pilot              # curated mix, prints, NO write
 *   node gen-pyq-explanations.mjs --pilot --write      # write the pilot rows
 *   node gen-pyq-explanations.mjs --sample 5 --subject Polity --group 1
 *   node gen-pyq-explanations.mjs --run                # full run, sequential write
 *   node gen-pyq-explanations.mjs --run --batch-write  # full run, step-2 via Batch API (50% off)
 *   node gen-pyq-explanations.mjs --run --group 2 --subject Aptitude --limit 50
 *   node gen-pyq-explanations.mjs --run --redo         # also re-do rows already 'generated'
 *
 * Env: ANTHROPIC_API_KEY + SUPABASE_DB_* (server/.env).
 */
import 'dotenv/config'
import { Client } from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL = 'claude-opus-4-8'
const GLOSS_DIR = join(__dirname, '..', '..', '..', 'Content_materials', 'glossary')

const EXAM_DOMAINS = [
  'vajiramandravi.com', 'nextias.com', 'studyiq.com', 'drishtiias.com',
  'byjus.com', 'unacademy.com', 'testbook.com', 'insightsonindia.com',
  'constitutionofindia.net', 'indiacode.nic.in', 'tnpscguru.in',
  'gktoday.in', 'jagranjosh.com', 'tn.gov.in', 'wikipedia.org',
]

// ─── subject → routing config ─────────────────────────────────────────────────
const SAMACHEER = 'the Tamil Nadu Samacheer Kalvi State Board textbooks (the authority)'
const SUBJECT_CFG = {
  'Aptitude': { kind: 'aptitude' },
  'English': { kind: 'lang_en' },
  'Tamil': { kind: 'lang_ta' },
  'Polity': { kind: 'academic', gloss: ['polity'],
    books: `${SAMACHEER} Political Science, and M. Laxmikanth — Indian Polity` },
  'History and INM': { kind: 'academic', gloss: ['history'],
    books: `${SAMACHEER} History (classes 6–12) and NCERT History — including the Indian National Movement` },
  'History Culture Heritage of TN': { kind: 'academic', gloss: ['history'],
    books: `${SAMACHEER} History textbooks covering the history, culture and heritage of Tamil Nadu` },
  'Geography': { kind: 'academic', gloss: ['geography', 'environment'],
    books: `${SAMACHEER} Geography and NCERT Geography` },
  'Indian Economy': { kind: 'academic', gloss: ['economy'],
    books: `${SAMACHEER} Economics and NCERT Indian Economic Development` },
  'Development Administration of TamilNadu': { kind: 'academic', gloss: ['social', 'polity'],
    books: `${SAMACHEER} and official Tamil Nadu government sources on the development administration and welfare schemes of Tamil Nadu` },
  'Biology': { kind: 'academic', gloss: ['scitech'],
    books: `${SAMACHEER} Science (Biology / Botany / Zoology) and NCERT Science` },
  'Physics': { kind: 'academic', gloss: ['scitech'],
    books: `${SAMACHEER} Science (Physics) and NCERT Science` },
  'Chemistry': { kind: 'academic', gloss: ['scitech'],
    books: `${SAMACHEER} Science (Chemistry) and NCERT Science` },
  'General Studies': { kind: 'academic',
    gloss: ['polity', 'history', 'geography', 'economy', 'scitech', 'social', 'environment'],
    books: `${SAMACHEER} (classes 6–12, all subjects) and NCERT` },
}
function cfgFor(subject) {
  return SUBJECT_CFG[subject] || { kind: 'academic', gloss: [], books: SAMACHEER }
}

// ─── args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d }
const MODE = has('--run') ? 'run' : has('--pilot') ? 'pilot' : 'sample'
const SAMPLE_N = Number(val('--sample', 5))
const LIMIT = val('--limit') ? Number(val('--limit')) : null
const WRITE = has('--write')
const BATCH_WRITE = has('--batch-write')
const REDO = has('--redo')
const F_SUBJECT = val('--subject')
const F_GROUP = val('--group') // '1' -> pyq, '2' -> pyq2

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

// ─── glossary: English term → Book Tamil (merge N files) ──────────────────────
const _glossCache = new Map()
function loadGlossary(names) {
  const key = names.join(',')
  if (_glossCache.has(key)) return _glossCache.get(key)
  const map = new Map()
  for (const n of names) {
    let text
    try { text = readFileSync(join(GLOSS_DIR, `${n}_glossary_index.md`), 'utf8') } catch { continue }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/)
      if (!m) continue
      const en = m[1].trim()
      if (!en || en === 'English' || en.startsWith('---')) continue
      const ta = m[2].split(/[/⁄]/)[0].replace(/\s*\([\d,\s]+\)\s*/g, ' ').trim()
      if (en.length >= 3 && ta && !map.has(en.toLowerCase())) map.set(en.toLowerCase(), { en, ta })
    }
  }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length)
  const g = { map, keys }
  _glossCache.set(key, g)
  return g
}
function matchTerms(glossary, text, cap = 24) {
  if (!glossary || !glossary.keys.length) return []
  const hay = text.toLowerCase(); const out = []; const used = []
  for (const k of glossary.keys) {
    if (out.length >= cap) break
    if (k.length < 4 || !hay.includes(k)) continue
    if (used.some((u) => u.includes(k))) continue
    used.push(k); out.push(glossary.map.get(k))
  }
  return out
}

// ─── question rendering ────────────────────────────────────────────────────────
const STATEMENT_TYPES = new Set(['statements', 'assertion_reason', 'assertion_reasoning', 'match', 'chronological', 'statement_correct', 'statement_incorrect'])
const isFactualType = (t) => !STATEMENT_TYPES.has(t || '')

function qBlock(q) {
  return `SUBJECT: ${q.subject}   TOPIC: ${q.topic || '-'}
QUESTION:
${q.question_text}
OPTIONS:
A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}
CORRECT ANSWER: ${q.correct_answer}`
}

// ─── ACADEMIC prompts (2-step, web-grounded) ──────────────────────────────────
function researchPrompt(q, books) {
  return `You are researching one TNPSC (Tamil Nadu) ${q.subject} exam question. Use web_search to pull accurate content from Indian competitive-exam websites (Vajiram & Ravi, NextIAS, StudyIQ, Drishti IAS, BYJU'S, GKToday), and align everything to ${books}.

${qBlock(q)}

Return CONCISE factual notes (English, plain text — no preamble) covering:
- The precise fact(s) the question tests, with the exact figure/date/name/place/Act/Article/term involved.
- Why the given correct answer is right, tied to the standard book content.
- What each of the four options actually refers to and why the wrong ones don't fit.
- For statement / match / assertion questions: whether each numbered item is correct and why.
- Any exam-relevant context, related facts, or common traps a mentor would add.
Keep it factual and verifiable. If sources conflict, prefer ${books}. Do not write the final explanation yet — just the notes.`
}

function academicWritePrompt(q, terms, notes, books) {
  const factual = isFactualType(q.question_type)
  const gloss = terms.length
    ? terms.map((t) => `  - ${t.en} → ${t.ta}`).join('\n')
    : '  (none matched — use standard book Tamil terminology)'
  let p = `You are a senior TNPSC ${q.subject} faculty member with 20+ years' teaching experience, writing the official answer-explanation for one exam question, in English and Tamil, using the researched notes below.

${qBlock(q)}

RESEARCHED NOTES (grounded in competitive-exam sites + ${books}):
${notes}

BOOK GLOSSARY (use these exact Tamil terms for the matched English terms — do NOT invent your own translation for them):
${gloss}

REQUIREMENTS:
- English "explanation": one self-contained teaching paragraph, AT LEAST 200 words, combining the question and its answer so a student who reads only this learns the full point.
- Include RELEVANT additional context from the notes and from ${books} (dates, names, related facts, exam context) — teach, don't merely restate.
- Be factually accurate and consistent with the notes and the given correct answer. NEVER change the correct answer. If unsure of a specific fact, stay general.
- Tamil "explanation_ta": a faithful translation of the SAME content, also ≥200 words of Tamil, using the Book-Tamil terms above; do not transliterate English where a book Tamil term exists.`
  if (factual) {
    p += `\n- Also fill "option_explanations" for A,B,C,D (each en + ta): why the correct one is right; for each wrong one, what it actually refers to and why it doesn't fit.`
  } else {
    p += `\n- Walk through each numbered statement / match pair / the assertion & reason, then explain why the chosen option is the right combination. Leave "option_explanations" empty.`
  }
  return p
}

// ─── APTITUDE prompt (single-step, worked solution, no web) ────────────────────
function aptitudePrompt(q) {
  return `You are a senior TNPSC Aptitude & Mental Ability faculty member. Write the fully worked, step-by-step solution to this question in the EXACT style of the TNPSC.Academy Aptitude worked-solution books:
  • Open with a one-line statement of the concept or formula being used.
  • Then show the working ONE OPERATION PER LINE, each on its own line (use "\\n" newlines), keeping the mathematical expressions clean and aligned like a worked example.
  • After a key step, add a SHORT bracketed note naming the rule/operation applied, e.g. "[bracket is given preference]", "[BODMAS: ÷ before −]", "[a² − b² = (a+b)(a−b)]", "[of = multiplication]".
  • Finish with a line: "∴ Answer: (${q.correct_answer})".

${qBlock(q)}

REQUIREMENTS:
- "explanation" (English): the worked solution as described, with real newlines between steps. Keep it clear and complete — a student should be able to reproduce it.
- "explanation_ta" (Tamil): the SAME worked solution in Tamil. Keep every mathematical expression IDENTICAL (do not translate numbers/symbols); translate only the words and the bracketed notes, using standard Tamil aptitude terms (சுருக்குக, தீர்வு, வாய்ப்பாடு, விடை, முதலில், etc.).
- Solve it correctly and arrive at option (${q.correct_answer}); NEVER change the correct answer. Leave "option_explanations" empty.`
}

// ─── LANGUAGE prompts (single-step, no web) ────────────────────────────────────
function langEnPrompt(q) {
  return `You are a senior TNPSC English faculty member. Explain this English-language question (it may test grammar, tense, articles, prepositions, voice, vocabulary, synonyms/antonyms, idioms, or reading comprehension).

${qBlock(q)}

REQUIREMENTS:
- "explanation" (English): teach the underlying RULE or meaning that decides the answer (name the grammar rule / define the word), state why option ${q.correct_answer} is correct, and briefly why each other option is wrong. At least 80 words. NEVER change the correct answer.
- "explanation_ta" (Tamil): a clear Tamil explanation of the same rule so a Tamil-medium student understands it; keep the English words, examples and quoted text in English.
- Fill "option_explanations" for A,B,C,D (each en + ta): one line each on why it is right/wrong.`
}
function langTaPrompt(q) {
  return `நீங்கள் 20+ ஆண்டுகள் அனுபவமுள்ள மூத்த தமிழ் ஆசிரியர். இந்த தமிழ்க் கேள்வியை விளக்குங்கள் (இது தமிழ் இலக்கணம், இலக்கியம், சொல்/பொருள், அகர வரிசை, பழமொழி, அணி, யாப்பு அல்லது ஆசிரியர்/நூல் தொடர்பானதாக இருக்கலாம்).

${qBlock(q)}

REQUIREMENTS:
- "explanation_ta" (தமிழ்): விடையைத் தீர்மானிக்கும் இலக்கண/இலக்கியக் கோட்பாட்டைக் கற்பியுங்கள்; சரியான விடை (${q.correct_answer}) ஏன் சரி என்பதையும், மற்ற விருப்பங்கள் ஏன் தவறு என்பதையும் சுருக்கமாகக் கூறுங்கள். குறைந்தது 80 சொற்கள். இலக்கிய உண்மைகளை சமச்சீர் கல்வி தமிழ்ப் பாடநூல்களுடன் ஒத்திசைக்கவும். சரியான விடையை ஒருபோதும் மாற்ற வேண்டாம்.
- "explanation" (English): a faithful English rendering of the same explanation for reference.
- Fill "option_explanations" for A,B,C,D (each en + ta): one line each.`
}

// ─── schema ────────────────────────────────────────────────────────────────────
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
async function research(anthropic, q, books) {
  const messages = [{ role: 'user', content: researchPrompt(q, books) }]
  let res
  for (let i = 0; i < 6; i++) {
    res = await anthropic.messages.create({
      model: MODEL, max_tokens: 3000, thinking: { type: 'adaptive' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, allowed_domains: EXAM_DOMAINS }],
      messages,
    })
    if (res.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: res.content })
  }
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

// ─── step 2 / single-step: build write params by kind ──────────────────────────
function buildWritePrompt(job) {
  const { q, cfg, terms, notes } = job
  switch (cfg.kind) {
    case 'aptitude': return aptitudePrompt(q)
    case 'lang_en': return langEnPrompt(q)
    case 'lang_ta': return langTaPrompt(q)
    default: return academicWritePrompt(q, terms, notes, cfg.books)
  }
}
function writeParams(job) {
  return {
    model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: buildWritePrompt(job) }],
  }
}
async function write(anthropic, job) {
  const res = await anthropic.messages.create(writeParams(job))
  return JSON.parse(res.content.find((b) => b.type === 'text').text)
}

// whether this job stores per-option notes
function storesOptions(job) {
  if (job.cfg.kind === 'aptitude') return false
  return isFactualType(job.q.question_type)
}

// ─── db read / write ───────────────────────────────────────────────────────────
async function save(client, id, out, keepOptions) {
  await client.query(
    `update questions set explanation=$1, explanation_ta=$2, option_explanations=$3, expl_status='generated' where id=$4`,
    [out.explanation, out.explanation_ta, keepOptions ? (out.option_explanations ?? null) : null, id]
  )
}
async function fetchRows(client, { limit, subject, group }) {
  const where = [`category in ('pyq','pyq2')`]
  const params = []
  if (group === '1') where.push(`category='pyq'`)
  if (group === '2') where.push(`category='pyq2'`)
  if (subject) { params.push(subject); where.push(`subject=$${params.length}`) }
  if (!REDO) where.push(`expl_status is distinct from 'generated' and expl_status is distinct from 'verified'`)
  const sql = `select id, category, subject, topic, question_type, question_text,
                      option_a, option_b, option_c, option_d, correct_answer
                 from questions where ${where.join(' and ')}
                order by category, subject, external_id ${limit ? 'limit ' + limit : ''}`
  return (await client.query(sql, params)).rows
}

// build a job (route + glossary terms) for one row
function makeJob(q) {
  const cfg = cfgFor(q.subject)
  let terms = []
  if (cfg.kind === 'academic' && cfg.gloss?.length) {
    const g = loadGlossary(cfg.gloss)
    terms = matchTerms(g, `${q.question_text} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d}`)
  }
  return { q, cfg, terms, notes: null }
}

// ─── pilot / sample fetch ──────────────────────────────────────────────────────
const PILOT_MIX = [
  ['Aptitude', 'pyq', 2], ['Aptitude', 'pyq2', 1],
  ['Polity', 'pyq', 1], ['History and INM', 'pyq', 1], ['Indian Economy', 'pyq', 1],
  ['Geography', 'pyq', 1], ['Biology', 'pyq', 1],
  ['Development Administration of TamilNadu', 'pyq', 1],
  ['General Studies', 'pyq2', 2], ['English', 'pyq2', 2], ['Tamil', 'pyq2', 2],
]
async function fetchPilot(client) {
  const out = []
  for (const [subject, cat, n] of PILOT_MIX) {
    const r = await client.query(
      `select id, category, subject, topic, question_type, question_text,
              option_a, option_b, option_c, option_d, correct_answer
         from questions where category=$1 and subject=$2 order by external_id limit $3`,
      [cat, subject, n])
    out.push(...r.rows)
  }
  return out
}

// ─── printing ──────────────────────────────────────────────────────────────────
function printRow(job, out) {
  const wc = out.explanation.trim().split(/\s+/).length
  console.log('━'.repeat(84))
  console.log(`[${job.cfg.kind}] ${job.q.category} / ${job.q.subject} / ${job.q.topic || '-'}   (${job.q.id})`)
  console.log(`Q: ${job.q.question_text}`)
  console.log(`ans: ${job.q.correct_answer}   matched terms: ${job.terms.map((t) => t.en).join(', ') || '(none)'}`)
  console.log(`\nEN (${wc} words):\n${out.explanation}\n\nTA:\n${out.explanation_ta}`)
  if (storesOptions(job) && out.option_explanations) {
    console.log()
    for (const k of ['A', 'B', 'C', 'D']) console.log(`  ${k}: ${out.option_explanations[k]?.en || ''}`)
  }
  console.log()
}

// ─── process one job end-to-end (research if academic, then write) ─────────────
async function process1(anthropic, job) {
  if (job.cfg.kind === 'academic') job.notes = await research(anthropic, job.q, job.cfg.books)
  return write(anthropic, job)
}

// ─── modes ─────────────────────────────────────────────────────────────────────
async function runSampleOrPilot() {
  const anthropic = new Anthropic()
  const client = db(); await client.connect()
  const rows = MODE === 'pilot'
    ? await fetchPilot(client)
    : await fetchRows(client, { limit: SAMPLE_N, subject: F_SUBJECT, group: F_GROUP })
  console.log(`${MODE}: ${rows.length} rows (write=${WRITE})\n`)
  for (const q of rows) {
    const job = makeJob(q)
    process.stdout.write(`  generating ${q.id} [${job.cfg.kind}] …\r`)
    try {
      const out = await process1(anthropic, job)
      printRow(job, out)
      if (WRITE) { await save(client, q.id, out, storesOptions(job)); console.log('  -> written\n') }
    } catch (e) { console.error(`\n  FAILED ${q.id}: ${e.message}`) }
  }
  await client.end()
}

async function runFull() {
  const anthropic = new Anthropic()
  const client = db(); await client.connect()
  const rows = await fetchRows(client, { limit: LIMIT, subject: F_SUBJECT, group: F_GROUP })
  console.log(`Full run: ${rows.length} rows  (batch-write=${BATCH_WRITE}, redo=${REDO})`)

  // Step 1: research all academic rows up front (web tool needs the sync loop).
  const jobs = rows.map(makeJob)
  let i = 0
  for (const job of jobs) {
    i++
    if (job.cfg.kind === 'academic') {
      try { job.notes = await research(anthropic, job.q, job.cfg.books) }
      catch (e) { console.error(`\n  research failed ${job.q.id}: ${e.message}`) }
    }
    process.stdout.write(`  prepared ${i}/${jobs.length}\r`)
  }
  console.log(`\nPrepared ${jobs.length} jobs. Writing …`)

  if (BATCH_WRITE) {
    const requests = jobs.map((job) => ({ custom_id: job.q.id, params: writeParams(job) }))
    const meta = new Map(jobs.map((job) => [job.q.id, storesOptions(job)]))
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
    for (const job of jobs) {
      try { const out = await write(anthropic, job); await save(client, job.q.id, out, storesOptions(job)); ok++ }
      catch (e) { fail++; console.error(`\n  write failed ${job.q.id}: ${e.message}`) }
      process.stdout.write(`  written ${ok}/${jobs.length}\r`)
    }
    console.log(`\nDone. written=${ok} failed=${fail}`)
  }
  await client.end()
}

if (!process.env.ANTHROPIC_API_KEY) { console.error('FATAL: ANTHROPIC_API_KEY not set'); process.exit(2) }
;(MODE === 'run' ? runFull() : runSampleOrPilot()).catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
