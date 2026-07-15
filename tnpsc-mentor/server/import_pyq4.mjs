import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Loads the Group 4 / VAO Previous-Year-Question bank into the live DB under
 * category='pyq4' (kept apart from the Group 1 'pyq' and Group 2 'pyq2' banks).
 *
 *   Content_materials/Group_4/<year>_group4_app.json   (200 rows per year)
 *   Content_materials/Group_4/figures/<year>/<qid>.png (figure crops)
 *
 * Each year holds two papers: General_Tamil (100, Tamil-only — that paper has no
 * English version) and GS_Maths (100, bilingual), the latter splitting into the
 * GS and Aptitude sections.
 *
 * Row mapping (drives the Group 4 picker: section -> All + sub-type -> year):
 *   subject = SECTION  : 'Tamil' | 'General Studies' | 'Aptitude'
 *   topic   = SUB-TYPE : a normalized skill/subject area (see classify*), except
 *                        on Aptitude rows where it stays the source micro-topic
 *                        and is shown as a badge only
 *   aptitude_type      : 'numerics' | 'reasoning'  (Aptitude rows only)
 *   year               : the exam year (badge + year filter)
 *
 * The source topics are free text (365 distinct across 373 GS rows), so they are
 * classified into the fixed sub-type sets the picker renders. The raw source
 * topic is preserved in aptitude_topic so nothing is lost.
 *
 * The Tamil paper is monolingual and stores its one language in the PRIMARY
 * columns (question_text, option_a..d, explanation) with the _ta columns null —
 * the app's display helpers fall back to the primary, so it renders Tamil in
 * every language mode. This matches the Group 2 English/Tamil sections.
 *
 * Option (E) ("Answer not known" / "விடை தெரியவில்லை") is dropped, as in every
 * other bank — no row in `questions` has ever populated option_e.
 *
 * Idempotent by external_id (`pyq4-<year>-<qnum>`): re-running deletes the same
 * external_ids then re-inserts, so user history (FK to id) on untouched rows is
 * preserved.
 *
 *   node import_pyq4.mjs           # dry-run: counts + classification only
 *   APPLY=1 node import_pyq4.mjs   # insert
 */

const ROOT = 'c:/Users/mas20/Desktop/work/TNPSC/Content_materials/Group_4'
const YEARS = [2018, 2019, 2022, 2024, 2025]
const APPLY = process.env.APPLY === '1'
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const BUCKET = 'question-images'

const clean = (v) => (v == null ? null : String(v).trim() || null)

// ─── Sub-type classification ────────────────────────────────────────────────
// The source `topic` is free text authored per question ("Bhagat Singh",
// "Mars Missions of countries"), so it can't drive a picker. Each topic is
// mapped onto one of the fixed sub-types the Group 4 section page lists.
//
// Topics are overwhelmingly written as "<subject> - <detail>" ("Biology -
// Respiration", "Current Affairs - Sports (Chess)"), so the LEADING segment is
// the author's own subject label and is matched first, anchored. Scanning the
// whole string instead lets an early rule steal a row on an incidental word —
// "Ancient History - Medical Texts" is History, not Biology, and "Modern Indian
// history / Industries" is History, not Culture via the "Indus" inside
// "Industries". Only when the head matches nothing does a word-bounded scan of
// the full topic run, then the section's catch-all.

/** The label's informative part: "Science - Biology (Algae)" -> "Biology (Algae)". */
const stripLead = (t) =>
  t.replace(/^(?:general\s+)?(?:science(?:\s*(?:and|&)\s*tech(?:nology)?)?|general knowledge|gk)\s*[-–/(]\s*/i, '')
/** The leading segment: "Biology - Respiration" -> "Biology". */
const head = (t) => stripLead(t).split(/\s*[-–/(,]\s*/)[0].trim()

const GS_HEAD = [
  ['Biology', /^(?:biolog|botan|zoolog|genetic|cancer|anatomy|human body|nutrition|vitamin|blood|dentition|phloem|fungi|algae|cell\b|molecular|nucleic|embryolog|plant kingdom|reproduction|respiration|diseases|virolog|microbiolog|immunolog)/i],
  ['Chemistry', /^(?:chemistr|metallurg|acids?\b|alkali|ph value|shale gas|insecticide|electrochemistr|food adulteration)/i],
  ['Physics', /^(?:physic|astronom|applied science|electric|doppler|optic|magnet|inventions?\b|mars mission|space|units of measurement|telecommunication)/i],
  ['Geography', /^(?:geograph|environment|rivers?\b|forest|mangrove|national parks?|cities\b|climate|soil|monsoon|winds?\b|floods?\b|natural|mineral|wildlife|agricultur|cultivation|irrigation|tn agricultur)/i],
  ['History', /^(?:history|historical|ancient|medieval|modern|freedom|maratha|delhi sultanate|gupta|chola|chera|pandya|indus valley|shivaji|bhagat|kakori|alipur|palayakkarar|periyar|iyothee|ramalinga|natesa|rettaimalai|swadeshi|madras presidency|musiri|c\.? natesa|v\.?\s?o\.?\s?chidambaram|tn (?:history|freedom|social reform|labour movement|archaeolog)|tamil nadu history|indian freedom)/i],
  ['Polity', /^(?:polity|indian polity|constitution|indian constitution|tn polity|fundamental|directive principle|judiciar|writs?\b|political|state legislat|centre|constitutional|mandal|right to education|legal services|national flag code|consumer protection|acts?\b|election|parliament|rajya sabha|lok sabha|panchayat)/i],
  ['Economics', /^(?:econom|five year plan|niti aayog|rbi|industrial policy|kisan|birth rate|government revenue|poverty|micro irrigation|tn economic|inflation|cause of high inflation|economic plans)/i],
  ['Development Administration', /^(?:development|schemes?\b|government schemes|welfare|tn welfare|rural development|education system|national education|illam thedi|thiranari|adi dravidar|anemia mukt|ministry of education|poverty eradication|tn (?:health|urban health|education|administration)|tn multi|logistics|national highways|metro)/i],
  // "Tamil - Classical Language" is Culture; "Tamil Nadu <anything>" is not — it
  // is a state-prefixed topic whose real subject follows.
  ['Culture', /^(?:culture|thirukkural|literature|tamil literature|indian literature|tamil(?!\s+nadu\b)\b|books|post-sangam|linguistics|classical language|archaeolog|ancient monuments|cave architecture|bharathi|match authors|christianity|religion|temple|art\b|folk)/i],
  ['Current Affairs & GK', /^(?:current affairs|current gk|awards?\b|important days|national days|national integration|gi tags|first woman|civilian awards|acronyms|general knowledge|gk\b|sports?\b|summit|unesco)/i],
]

// Word-bounded fallback scan for topics whose head matched nothing.
const GS_KEYWORD = [
  ['Biology', /\b(?:biolog|botan|zoolog|genetic|cancer|vitamin|disease|anemia|health|virolog)\w*/i],
  ['Chemistry', /\b(?:chemistr|metal|acid|gas|element|compound|adulteration)\w*/i],
  ['Physics', /\b(?:physic|electric|energy|engine|planet|satellite|invention|optoelectronic|electronic|telecommunication|measurement)\w*/i],
  ['Geography', /\b(?:geograph|river|forest|park|climate|greenhouse|railway|highway|agricultur|cultivation)\w*/i],
  ['Polity', /\b(?:constitution|article|fundamental|writ|judiciar|parliament|amendment|commission|act|rights|duties|symbol)\w*/i],
  ['Economics', /\b(?:econom|inflation|budget|plan|revenue|tax|bank|poverty)\w*/i],
  ['Development Administration', /\b(?:scheme|welfare|programme|policy|project|millet)\w*/i],
  ['History', /\b(?:history|freedom|struggle|movement|dynasty|conspiracy|presidency)\w*/i],
  ['Culture', /\b(?:thirukkural|kural|literature|author|book|heritage|monument|architecture|valluvar|sangam)\w*/i],
]

const TAMIL_HEAD = [
  ['Comprehension', /^(?:comprehension|passage)/i],
  ['Author & Work', /^(?:author|editor|biograph|epithet|quote attribution)/i],
  ['Language History', /^(?:language|linguistic|etymolog|lexicograph|alphabetical order|tamil numerals)/i],
  // Prosody (யாப்பு) and poetics (அணி) are divisions of Tamil grammar, so they
  // belong here rather than under Language History.
  ['Grammar', /^(?:grammar|punarchi|sandhi|segmentation|punctuation|marabu|ilakkana|prosod|poetic|thodai|monai|ethukai)/i],
  ['Vocabulary', /^(?:vocab|synonym|antonym|word|monosyllab|idiom|proverb|simile)/i],
  ['Literature', /^(?:literature|poetry|poem|poet\b|drama|thirukkural|kural|siddhar|thembavani|purananuru|novel|epic|folk literature|cinema)/i],
  ['Tamil GK', /^(?:general knowledge|history|culture|science|geography|award|current|folk art|tamil nadu|assertion)/i],
]

const TAMIL_KEYWORD = [
  ['Comprehension', /\bcomprehension\b/i],
  ['Author & Work', /\b(?:author|editor|biograph)\w*/i],
  ['Grammar', /\b(?:grammar|sentence|verb|noun|word split|compound|tokai|root word|passive|vinaiyecham|error correction|question formation|prosod|poetic|thodai|monai|ethukai)\w*/i],
  ['Language History', /\b(?:language|linguistic|etymolog)\w*/i],
  ['Vocabulary', /\b(?:vocab|synonym|antonym|meaning|idiom|proverb|simile)\w*/i],
  ['Literature', /\b(?:literature|poetry|poem|drama|kural|translation|genre)\w*/i],
]

function classify(headRules, keywordRules, topic, fallback) {
  const t = String(topic ?? '')
  const h = head(t)
  for (const [name, re] of headRules) if (re.test(h)) return name
  const full = stripLead(t)
  for (const [name, re] of keywordRules) if (re.test(full)) return name
  return fallback
}

// ─── Structured aptitude explanation -> flattened LaTeX text ────────────────
// The 127 aptitude rows carry a structured worked solution
// ({ given[], key_point, formula_label, formula[], steps[][], asked, final[] })
// whose maths lives in typed segments. Every bank in `questions` instead stores
// explanations as TEXT with inline $..$ LaTeX, which parseSolution()
// (src/lib/aptitudeSolution.ts) splits back into Given / From question / Asked
// sections and KaTeX renders. Flatten to exactly that convention.

/** Maths operators that must not reach KaTeX as their unicode glyphs. */
const mathText = (s) =>
  String(s).replace(/−/g, '-').replace(/×/g, ' \\times ').replace(/÷/g, ' \\div ').replace(/\s+/g, ' ')

/** Render segments to a LaTeX body (no $ delimiters) — used inside fractions. */
function latexBody(segs) {
  if (typeof segs === 'string') return mathText(segs)
  return (Array.isArray(segs) ? segs : [segs]).map((s) => latexSeg(s)).join('')
}

/** One segment as bare LaTeX. */
function latexSeg(seg) {
  if (seg == null) return ''
  if (typeof seg === 'string') return mathText(seg)
  if (seg.t != null) return mathText(seg.t)
  if (seg.sup) return `${latexBody(seg.sup[0])}^{${latexBody(seg.sup[1])}}`
  if (seg.supp) return `\\left(${latexBody(seg.supp[0])}\\right)^{${latexBody(seg.supp[1])}}`
  if (seg.frac) return `\\dfrac{${latexBody(seg.frac[0])}}{${latexBody(seg.frac[1])}}`
  if (seg.fracp) return `\\dfrac{${latexBody(seg.fracp[0])}}{${latexBody(seg.fracp[1])}}`
  if (seg.sqrt) return `\\sqrt{${latexBody(seg.sqrt)}}`
  return ''
}

/**
 * A segment run -> a display line: text segments pass through verbatim, and each
 * maths segment is wrapped in its own $..$ (matching the existing bank's style,
 * e.g. `Mean $= \dfrac{\Sigma x}{n}$`).
 */
function renderLine(segs) {
  if (segs == null) return ''
  if (typeof segs === 'string') return segs.trim()
  return (Array.isArray(segs) ? segs : [segs])
    .map((s) => (s && s.t != null ? String(s.t) : s ? `$${latexSeg(s)}$` : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

// A trailing "விடை (D)" / "Option (D)" already sitting on the `final` line — we
// re-emit it in the canonical "→ Option (X)" form the parser looks for.
const TRAILING_OPTION = /[,;]?\s*(?:→|⇒|->)?\s*(?:option|விடை)\s*\(?\s*([A-E])\s*\)?\.?\s*$/i

/** Structured worked solution -> sectioned solution text. */
function flattenWorked(ex, letter, lang) {
  if (!ex) return null
  const out = []
  const given = (ex.given ?? []).map((g) => renderLine(g)).filter(Boolean)
  if (given.length) {
    out.push(lang === 'ta' ? 'தரவுகள்:' : 'Given:')
    out.push(...given)
  }

  const working = []
  if (ex.key_point) working.push(renderLine(ex.key_point))
  const formula = renderLine(ex.formula)
  if (formula) working.push(`${ex.formula_label ?? (lang === 'ta' ? 'சூத்திரம்: ' : 'Formula: ')}${formula}`)
  for (const step of ex.steps ?? []) {
    const line = renderLine(step)
    if (line) working.push(line)
  }
  if (working.length) {
    out.push(lang === 'ta' ? 'தீர்வு:' : 'From question:')
    out.push(...working)
  }

  const asked = renderLine(ex.asked)
  let final = renderLine(ex.final)
  // Strip whatever option marker the author wrote, then re-emit it canonically
  // so parseSolution() picks up the answer letter instead of leaving it inline.
  if (final) final = final.replace(TRAILING_OPTION, '').replace(/[,;]\s*$/, '').trim()
  if (asked || final) {
    out.push(lang === 'ta' ? 'கேட்டது:' : 'Asked:')
    if (asked) out.push(asked)
    if (final) out.push(`${final} → ${lang === 'ta' ? 'விடை' : 'Option'} (${letter})`)
    else out.push(`→ ${lang === 'ta' ? 'விடை' : 'Option'} (${letter})`)
  }
  return out.join('\n').trim() || null
}

/** Non-aptitude explanation: { en?, ta } plain strings. */
const plainExpl = (ex, key) => (ex && typeof ex === 'object' ? clean(ex[key]) : clean(ex))

// ─── Match-stem handling (mirrors import_pyq2.mjs) ──────────────────────────
function looksLikeMatch(text) {
  if (!text) return false
  const alpha = (text.match(/(?:^|\n)\s*\(?[a-eA-E]\)?\s*[).]\s+\S/g) || []).length
  const num = (text.match(/(?:^|\n)\s*\(?[1-5]\)?\s*[).]\s+\S/g) || []).length
  if (alpha < 2 || num < 2) return false
  return /\bmatch\b|column\s*[-–]?\s*[abi]|list\s*[-–]?\s*i|பொருத்த|நெடுவரிசை|பட்டியல்/i.test(text)
}

/** Public bucket URL for a figure, given the JSON's `figures/<year>/<f>.png`. */
const imageUrl = (ref) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/pyq4/${String(ref).split('/').slice(-2).join('/')}`

// ─── Build rows ─────────────────────────────────────────────────────────────
const rows = []
const summary = {}
const classLog = { 'General Studies': {}, Tamil: {} }
let skipped = 0
const skipSamples = []

for (const year of YEARS) {
  const file = join(ROOT, `${year}_group4_app.json`)
  const arr = JSON.parse(readFileSync(file, 'utf8'))
  for (const q of arr) {
    const letter = String(q.answer ?? '').trim().toUpperCase()
    const isTamilPaper = q.paper === 'General_Tamil'
    const rawTopic = clean(q.topic)

    // Section + sub-type.
    let subject, topic, aptType = null, aptTopic = null
    if (q.category === 'Aptitude') {
      subject = 'Aptitude'
      topic = rawTopic // micro-topic, badge only — the picker splits on aptitude_type
      aptType = q.aptitude_type === 'reasoning' ? 'reasoning' : 'numerics'
      aptTopic = clean(q.aptitude_topic) ?? rawTopic
    } else if (q.category === 'Tamil') {
      subject = 'Tamil'
      topic = classify(TAMIL_HEAD, TAMIL_KEYWORD, rawTopic, 'Tamil GK')
      aptTopic = rawTopic // keep the source micro-topic (badge)
      classLog.Tamil[`${topic}  ←  ${rawTopic}`] = 1
    } else {
      subject = 'General Studies'
      topic = classify(GS_HEAD, GS_KEYWORD, rawTopic, 'Current Affairs & GK')
      aptTopic = rawTopic
      classLog['General Studies'][`${topic}  ←  ${rawTopic}`] = 1
    }

    // Language columns. The Tamil paper is monolingual -> primary columns.
    const oEn = q.options ?? {}
    const oTa = q.options_ta ?? {}
    let qText, oa, ob, oc, od, expl
    let qTextTa = null, oaTa = null, obTa = null, ocTa = null, odTa = null, explTa = null
    let whyWrong = q.why_wrong ?? null
    let whyWrongTa = q.why_wrong_ta ?? null

    if (isTamilPaper) {
      qText = clean(q.question_text_ta)
      oa = clean(oTa.a); ob = clean(oTa.b); oc = clean(oTa.c); od = clean(oTa.d)
      expl = q.expl_kind === 'worked_solution'
        ? flattenWorked(q.explanation_ta ?? q.explanation, letter, 'ta')
        : plainExpl(q.explanation, 'ta')
      whyWrong = q.why_wrong_ta ?? q.why_wrong ?? null
      whyWrongTa = null
    } else {
      qText = clean(q.question_text)
      oa = clean(oEn.a); ob = clean(oEn.b); oc = clean(oEn.c); od = clean(oEn.d)
      qTextTa = clean(q.question_text_ta)
      oaTa = clean(oTa.a); obTa = clean(oTa.b); ocTa = clean(oTa.c); odTa = clean(oTa.d)
      if (q.expl_kind === 'worked_solution') {
        expl = flattenWorked(q.explanation, letter, 'en')
        explTa = flattenWorked(q.explanation_ta, letter, 'ta')
      } else {
        expl = plainExpl(q.explanation, 'en')
        explTa = plainExpl(q.explanation, 'ta')
      }
    }

    // Option (E) is dropped everywhere, so drop its rationale too.
    const dropE = (w) => {
      if (!w || typeof w !== 'object') return null
      const { E, e, ...rest } = w
      return Object.keys(rest).length ? rest : null
    }
    whyWrong = dropE(whyWrong)
    whyWrongTa = dropE(whyWrongTa)

    const imgs = q.image && existsSync(join(ROOT, q.image)) ? [imageUrl(q.image)] : null

    const reason =
      !/^[ABCD]$/.test(letter) ? 'no-answer'
      : !qText ? 'no-stem'
      : !(oa && ob && oc && od) ? 'missing-option'
      : null
    if (reason) {
      skipped++
      if (skipSamples.length < 15) skipSamples.push(`${q.qid} (${reason})`)
      continue
    }

    rows.push({
      category: 'pyq4',
      subject,
      topic,
      aptitude_type: aptType,
      aptitude_topic: aptTopic,
      year,
      external_id: `pyq4-${year}-${q.qnum}`,
      difficulty: 'medium',
      question_type: looksLikeMatch(qText) || looksLikeMatch(qTextTa) ? 'match' : null,
      question_text: qText,
      option_a: oa, option_b: ob, option_c: oc, option_d: od,
      images: imgs ? JSON.stringify(imgs) : null,
      correct_answer: letter,
      explanation: expl,
      explanation_ta: explTa,
      why_wrong: whyWrong ? JSON.stringify(whyWrong) : null,
      why_wrong_ta: whyWrongTa ? JSON.stringify(whyWrongTa) : null,
      question_text_ta: qTextTa,
      option_a_ta: oaTa, option_b_ta: obTa, option_c_ta: ocTa, option_d_ta: odTa,
      expl_status: 'generated',
      source_url: 'tnpsc-official',
      active: true,
    })
    const key = `${subject}${subject === 'Aptitude' ? ' › ' + aptType : ' › ' + topic}`
    summary[key] = (summary[key] ?? 0) + 1
  }
}

console.table(summary)
console.log(
  `Total rows: ${rows.length} | Skipped: ${skipped} [${skipSamples.join(', ')}] | With figures: ${rows.filter((r) => r.images).length} | Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`
)

if (process.env.SHOW_CLASS === '1') {
  for (const [sec, m] of Object.entries(classLog)) {
    console.log(`\n===== ${sec} : source topic -> sub-type =====`)
    console.log(Object.keys(m).sort().join('\n'))
  }
}
if (process.env.SHOW_EXPL === '1') {
  const s = rows.find((r) => r.aptitude_type && r.explanation)
  console.log('\n===== sample flattened worked solution (EN) =====\n' + s.explanation)
  console.log('\n===== sample flattened worked solution (TA) =====\n' + s.explanation_ta)
}

// Guard: every row must satisfy the DB NOT NULLs.
const bad = rows.filter((r) => !r.question_text || !r.option_a || !r.option_b || !r.option_c || !r.option_d || !r.correct_answer)
if (bad.length) {
  console.error(`! ${bad.length} rows missing required content. First:`, bad[0].external_id)
  process.exit(1)
}
// Guard: external_id must be unique within this batch.
const seen = new Set()
const dupes = []
for (const r of rows) {
  if (seen.has(r.external_id)) dupes.push(r.external_id)
  seen.add(r.external_id)
}
if (dupes.length) {
  console.error(`! ${dupes.length} duplicate external_ids. First:`, dupes.slice(0, 5))
  process.exit(1)
}

if (!APPLY) {
  console.log('\nDRY-RUN only. Re-run with APPLY=1 to insert.')
  process.exit(0)
}

const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
})
await c.connect()
console.log('Connected.')

const COLS = [
  'category', 'subject', 'topic', 'aptitude_type', 'aptitude_topic', 'year', 'external_id', 'difficulty',
  'question_type', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
  'images', 'correct_answer', 'explanation', 'explanation_ta', 'why_wrong', 'why_wrong_ta',
  'question_text_ta', 'option_a_ta', 'option_b_ta', 'option_c_ta', 'option_d_ta',
  'expl_status', 'source_url', 'active',
]

try {
  await c.query('begin')
  const ids = rows.map((r) => r.external_id)
  const del = await c.query(
    `delete from questions where category='pyq4' and external_id = any($1::text[])`,
    [ids]
  )
  console.log(`Removed ${del.rowCount} pre-existing pyq4 rows with same external_id.`)

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const values = []
    const params = []
    let p = 1
    for (const r of batch) {
      const ph = COLS.map((col) => {
        params.push(r[col])
        return `$${p++}`
      })
      values.push(`(${ph.join(',')})`)
    }
    const sql = `insert into questions (${COLS.join(',')}) values ${values.join(',')}`
    const res = await c.query(sql, params)
    inserted += res.rowCount
    process.stdout.write(`\r  inserted ${inserted}/${rows.length}`)
  }
  console.log('')
  await c.query('commit')
  console.log('COMMIT ok.')
} catch (e) {
  await c.query('rollback')
  console.error('ROLLBACK —', e.message)
  process.exit(1)
}

console.table(
  (await c.query(
    `select subject, count(*)::int n, min(year) miny, max(year) maxy
     from questions where category='pyq4' group by subject order by subject`
  )).rows
)
await c.end()
