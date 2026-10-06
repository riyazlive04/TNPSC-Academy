// ─── Build the public question archive ───────────────────────────────────────
//   node scripts/qbank/build.mjs             (reads server/_qbank/questions.ndjson)
//   node scripts/qbank/build.mjs --limit 500 (a quick sample to eyeball)
//   node scripts/qbank/build.mjs --out some/dir
//
// Output is a self-contained static tree in qbank-dist/ — nothing in it needs a
// server beyond nginx, and nothing in it needs JavaScript to be readable. See
// scripts/qbank/README.md for how it is served.
//
// Scope: previous-year TNPSC papers only — categories pyq, pyq2 and pyq4.
// Those questions are TNPSC's own published material, so the question and its
// correct answer go out in full. The EXPLANATION does not: it is gated behind a
// free sign-in, which is the whole point — the question earns the search result,
// the explanation earns the account. See lockedExplanation() in render.mjs for
// why the text is withheld rather than merely blurred.
//
// Shape. Papers lead on the hub, because 'tnpsc group 2 2024 question paper' is
// a search people make; the 2026 prelims units are the second axis, so the
// archive and the answer-key pages speak one vocabulary.
//
//   /questions/                             the archive hub, the 8 prelims units
//   /questions/<unit>/                      a unit, its topics, paginated
//   /questions/<unit>/<topic>/              a topic, paginated
//   /questions/past-papers/<group>-<year>/  one past paper, paginated
//   /questions/q/<slug>/                    ONE question — the page meant to win
//                                           an exact-match search for its wording
//
// Only the question pages carry content; the rest exist to get a crawler to
// them and to give a visitor somewhere to go next.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { UNIT_OTHER, ALL_UNITS, resolveUnit, slugify } from './taxonomy.mjs'
import { findRepeats } from './repeats.mjs'
import {
  CSS, ORIGIN, BASE, BRAND,
  esc, plain, page, questionJsonLd, promo, pager, mathText, hasMath, n,
  setFooterUnits, faqSection, en, ta, both, one,
  questionCard, answerSection, explanationSection, detailsSection, questionFaq, miniQuestion,
  insightStrip, repeatNotice,
  APP_REGISTER,
} from './render.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const argv = process.argv.slice(2)
const argOf = (flag, dflt) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const OUT = resolve(ROOT, argOf('--out', 'qbank-dist'))
const LIMIT = Number(argOf('--limit', 0)) || 0
const SRC = resolve(ROOT, argOf('--src', 'server/_qbank/questions.ndjson'))

/**
 * Questions per listing page.
 *
 * A listing used to be one line per question; it now carries each question in
 * full — stem, options and the marked answer — because a page titled "TNPSC
 * Group 1 2026 Question Paper with Answers" should BE that, not an index of
 * links to it. Twenty-five whole questions is about 60 kB; fifty was too much
 * to scroll and too much to download on a phone.
 */
const PER_PAGE = 25
/** Sitemaps cap at 50,000 URLs; stay under it. */
const PER_SITEMAP = 45000
/**
 * Fewest questions a topic needs before it gets a page of its own.
 *
 * `topic` in the bank is very fine-grained — the previous-year banks produce
 * well over a thousand distinct values for five thousand questions, many of
 * them used once. A listing page holding one question is nearly all header,
 * footer and promo: thin content, which Google is right to think little of,
 * and it spends crawl budget that belongs to the question pages.
 *
 * So a small topic keeps grouping the questions (it still decides which
 * siblings a question page links to, and it still shows in the tag list) but
 * gets no URL. Those questions are reachable from their unit page, which lists
 * every question in the unit.
 */
const MIN_TOPIC = 5

/**
 * Largest share of its unit a topic may hold and still get a page.
 *
 * The Group 2 and Group 4 banks file their general-studies rows with the real
 * subject in `topic`, which is how resolveUnit() places them. That leaves a
 * topic called 'Polity' holding 59% of Indian Polity, and one called
 * 'Geography' holding 67% of Geography of India — a page that is a synonym for
 * its own unit and lists most of the same questions. Two near-identical pages
 * compete with each other for the same search and neither wins.
 *
 * A topic that is half its unit is not a subdivision of it. Real subdivisions
 * sit far below this line: Biology is 32% of General Science, Tamil Literature
 * 26% of Tamil, the biggest aptitude topic 6% of Aptitude.
 */
const MAX_TOPIC_SHARE = 0.5

// ─── Load ────────────────────────────────────────────────────────────────────

if (!existsSync(SRC)) {
  console.error(`No export found at ${SRC}
Run the export first:
  STUDIO_USER=tnpscadmin STUDIO_PASSWORD=… node scripts/qbank/export.mjs`)
  process.exit(1)
}

console.log(`Reading ${SRC}…`)
let rows = readFileSync(SRC, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))
if (LIMIT) rows = rows.slice(0, LIMIT)
console.log(`  ${n(rows.length)} rows`)

// ─── Scope guard ─────────────────────────────────────────────────────────────
// export.mjs already selects only these three categories. This repeats the test
// because the NDJSON on disk can outlive a scope decision, and a stale export
// must not quietly put the paid banks on the open web. Two cheap independent
// checks beat one leak.

const ALLOWED_CATEGORIES = new Set(['pyq', 'pyq2', 'pyq4'])
const outOfScope = rows.filter((q) => !ALLOWED_CATEGORIES.has(q.category))
if (outOfScope.length) {
  const byCat = new Map()
  for (const q of outOfScope) byCat.set(String(q.category), (byCat.get(String(q.category)) ?? 0) + 1)
  console.log(`  dropped ${n(outOfScope.length)} row(s) outside the published scope:`)
  for (const [c, k] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`    ${c.padEnd(18)} ${n(k)}`)
  rows = rows.filter((q) => ALLOWED_CATEGORIES.has(q.category))
}

// ─── Reject what should not be published ─────────────────────────────────────
// A question with no answer, a missing option or two identical options is a
// data bug, and one of those on the open web is worse than a gap in the archive.
// (The duplicate-option fault is real and known — supabase notes on the pyq2
// Tamil bank.) These are reported, not silently dropped.

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const rejected = []
const blemished = []

/** The option letters a row has, lower-cased and flattened for comparison. */
function optionMap(q) {
  const opts = {}
  for (const L of LETTERS) {
    const v = q[`option_${L.toLowerCase()}`]
    if (v != null && String(v).trim() !== '') opts[L] = plain(v).toLowerCase()
  }
  return opts
}

/** Finds the first pair of identical options, or null. */
function duplicatePair(opts) {
  const seen = new Map()
  for (const [L, v] of Object.entries(opts)) {
    if (seen.has(v)) return { first: seen.get(v), second: L, text: v }
    seen.set(v, L)
  }
  return null
}

/** A fault that makes the question unpublishable. */
function defect(q) {
  const text = String(q.question_text ?? '').trim()
  // Not a character count. 'Galena is' is a complete cloze-style question at
  // nine characters, and the bank has a number like it; counting characters
  // threw them away. What separates a terse stem from a truncated one is
  // whether it is a phrase at all.
  if (text.length < 8 || text.split(/\s+/).filter(Boolean).length < 2) {
    return 'stem missing or truncated'
  }

  const correct = String(q.correct_answer ?? '').trim().toUpperCase()
  if (!LETTERS.includes(correct)) return `correct_answer is ${JSON.stringify(q.correct_answer)}`

  const opts = optionMap(q)
  if (Object.keys(opts).length < 2) return 'fewer than two options'
  if (!opts[correct]) return `correct_answer ${correct} has no option`

  // Two identical options are a transcription fault, and TNPSC's own printed
  // papers carry a few of them. That only makes a question unanswerable when
  // the keyed answer is one of the pair — then two options are both right and
  // nobody can be told which to pick. A duplicate between two distractors
  // leaves the answer unambiguous, so the question still goes out; it is
  // recorded as a blemish instead.
  const dup = duplicatePair(opts)
  if (dup && (dup.first === correct || dup.second === correct)) {
    return `options ${dup.first} and ${dup.second} are identical and ${correct} is the keyed answer ` +
      `("${plain(dup.text, 40)}")`
  }
  return null
}

const clean = []
for (const q of rows) {
  const why = defect(q)
  if (why) {
    rejected.push({ id: q.id, external_id: q.external_id, category: q.category, why })
    continue
  }
  clean.push(q)
  const dup = duplicatePair(optionMap(q))
  if (dup) {
    blemished.push({
      id: q.id,
      external_id: q.external_id,
      category: q.category,
      why: `options ${dup.first} and ${dup.second} are identical ("${plain(dup.text, 40)}") — ` +
        `both distractors, so the answer is still unambiguous`,
    })
  }
}
console.log(`  ${n(clean.length)} publishable, ${n(rejected.length)} held back as unanswerable`)
if (blemished.length) console.log(`  ${n(blemished.length)} published with a duplicated distractor`)

// Stable order so a rebuild assigns the same slug to the same question and no
// URL ever moves.
clean.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

// ─── Slugs ───────────────────────────────────────────────────────────────────
// Keyword-first, from the question's own wording — that is the string people
// search. A Tamil-only stem slugifies to '' (no transliteration), so those fall
// back to the row id.

const takenSlugs = new Set()
for (const q of clean) {
  let base = slugify(plain(q.question_text), 80)
  if (!base) base = `tnpsc-question-${String(q.id).slice(0, 8)}`
  let slug = base
  let i = 2
  while (takenSlugs.has(slug)) slug = `${base}-${i++}`
  takenSlugs.add(slug)
  q._slug = slug
  q._path = `${BASE}/q/${slug}/`
}

// ─── Group into units and topics ─────────────────────────────────────────────

function topicOf(q) {
  return (
    plain(q.topic) ||
    plain(q.aptitude_topic) ||
    plain(q.ca_topic) ||
    plain(q.subject) ||
    'General'
  )
}

const units = new Map() // unitKey -> { def, questions, topics: Map<name,{slug,questions}> }
for (const def of ALL_UNITS) {
  units.set(def.key, { def, questions: [], topics: new Map() })
}

for (const q of clean) {
  const def = resolveUnit(q)
  const u = units.get(def.key)
  q._unit = def
  u.questions.push(q)

  const name = topicOf(q)
  let t = u.topics.get(name)
  if (!t) {
    // Topic slugs are unique within their unit only, which is all the URL needs.
    let base = slugify(name, 60) || 'general'
    let slug = base
    let i = 2
    const used = new Set([...u.topics.values()].map((x) => x.slug))
    while (used.has(slug)) slug = `${base}-${i++}`
    t = { name, slug, questions: [] }
    u.topics.set(name, t)
  }
  t.questions.push(q)
  q._topic = t
}

// Drop units with nothing in them, and order topics biggest-first.
const liveUnits = ALL_UNITS.map((d) => units.get(d.key)).filter((u) => u.questions.length > 0)
let smallTopics = 0
let orphanQuestions = 0
for (const u of liveUnits) {
  u.path = `${BASE}/${u.def.key}/`
  const all = [...u.topics.values()].sort((a, b) => b.questions.length - a.questions.length)

  const worthAPage = (t) =>
    t.questions.length >= MIN_TOPIC && t.questions.length < u.questions.length * MAX_TOPIC_SHARE

  u.topicList = all.filter(worthAPage)
  for (const t of u.topicList) t.path = `${u.path}${t.slug}/`

  // The rest keep their grouping but lose their URL, so a question in one links
  // its topic's siblings and then points at the unit rather than a dead path.
  const small = all.filter((t) => !worthAPage(t))
  smallTopics += small.length
  for (const t of small) {
    t.path = u.path
    t.listed = false
    orphanQuestions += t.questions.length
  }

  // Sibling sets, in the order the question pages walk them: every topic that
  // has a page, then everything else in the unit as one pool.
  u.groups = [
    ...u.topicList.map((t) => ({ topic: t, questions: t.questions })),
    ...(small.length ? [{ topic: null, questions: small.flatMap((t) => t.questions) }] : []),
  ]
}
console.log(
  `  ${n(liveUnits.reduce((a, u) => a + u.topicList.length, 0))} topics get a page; ` +
    `${n(smallTopics)} others (${n(orphanQuestions)} questions) stay on their unit page`,
)

// ─── Past papers, by group and year ──────────────────────────────────────────
// 'tnpsc group 1 2019 question paper with answers' is a search people actually
// make, so each past paper gets its own listing.

const GROUP_LABELS = {
  pyq: { label: 'Group 1', labelTa: 'குரூப் 1', slug: 'group-1' },
  pyq2: { label: 'Group 2 / 2A', labelTa: 'குரூப் 2 / 2A', slug: 'group-2' },
  pyq4: { label: 'Group 4 / VAO', labelTa: 'குரூப் 4 / VAO', slug: 'group-4' },
}

/**
 * The answer-key pages that are already live (src/App.tsx). A paper page here
 * and its answer-key page there both answer 'tnpsc group 1 2024 answer key', so
 * they are linked rather than left to split the same query between them: this
 * page is the paper question by question, that one is the key and the PDF.
 */
const ANSWER_KEY_PAGES = {
  'group-1-2025': '/tnpsc-group-1-answer-key-2025',
  'group-1-2024': '/tnpsc-group-1-answer-key-2024',
  'group-1-2022': '/tnpsc-group-1-answer-key-2022',
  'group-2-2025': '/tnpsc-group-2-answer-key-2025',
  'group-2-2024': '/tnpsc-group-2-answer-key-2024',
  'group-4-2025': '/tnpsc-group-4-answer-key-2025',
  'group-4-2024': '/tnpsc-group-4-answer-key-2024',
}

/**
 * The paper's own question number, recovered from external_id (`…_Q37`).
 *
 * Only about a fifth of the bank carries it: all of Group 1 2026, most of the
 * other Group 1 papers, none of Group 2 or Group 4. So it is used strictly
 * all-or-nothing per paper — a paper whose every question has a number is shown
 * in the paper's own order WITH those numbers, and any other paper is shown in
 * its stable id order with no numbers at all. Numbering questions 1..200 in an
 * order we cannot vouch for would be a plain lie on a page that calls itself a
 * question paper.
 */
function paperQno(q) {
  const m = String(q.external_id ?? '').match(/_Q(\d+)$/)
  return m ? Number(m[1]) : null
}

const papers = new Map() // slug -> { label, year, slug, questions }
for (const q of clean) {
  const g = GROUP_LABELS[q.category]
  if (!g || !q.year) continue
  const slug = `${g.slug}-${q.year}`
  let p = papers.get(slug)
  if (!p) {
    p = {
      slug,
      label: g.label,
      labelTa: g.labelTa,
      year: Number(q.year),
      questions: [],
      path: `${BASE}/past-papers/${slug}/`,
    }
    papers.set(slug, p)
  }
  p.questions.push(q)
  q._paper = p
}
for (const p of papers.values()) {
  p.numbered = p.questions.every((q) => paperQno(q) !== null)
  if (p.numbered) p.questions.sort((a, b) => paperQno(a) - paperQno(b))
}
// Questions that genuinely come round again. Rare by design — see repeats.mjs.
const repeats = findRepeats(clean)
const repeatGroups = new Set(
  [...repeats.values()].map((g) => g.map((q) => q.id).sort().join('|')),
)
console.log(
  `  ${n(repeatGroups.size)} question(s) asked in more than one paper ` +
    `(${n(repeats.size)} pages carry a repeat notice)`,
)

const paperList = [...papers.values()].sort((a, b) => b.year - a.year || a.label.localeCompare(b.label))
console.log(
  `  ${paperList.filter((p) => p.numbered).length} of ${paperList.length} papers keep their own question numbers`,
)

// ─── Writing ─────────────────────────────────────────────────────────────────

let filesWritten = 0
function write(relPath, body) {
  const full = join(OUT, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
  filesWritten++
}

/** A page at a path like '/questions/foo/' lands at 'foo/index.html'. */
function writePage(path, html) {
  const rel = path.replace(new RegExp(`^${BASE}/?`), '').replace(/\/$/, '')
  write(rel ? join(rel, 'index.html') : 'index.html', html)
}

// Every page carries the footer, so it must only name units that exist in this
// build — with the scope narrowed to past papers, several of the eight units can
// come out empty.
setFooterUnits(liveUnits.map((u) => u.def).filter((d) => d.key !== UNIT_OTHER.key))

console.log(`\nWriting to ${OUT}`)
rmSync(OUT, { recursive: true, force: true })
write('archive.css', CSS)
for (const f of [
  'logo-mark.png',
  'social.png',
  // The hub's hero banner: a 1x WebP, a 2x WebP, and a JPEG for browsers
  // without image-set(). Only ever fetched above 700px — see .herobanner.
  'hero-1200.webp',
  'hero-1774.webp',
  'hero-1200.jpg',
]) {
  write(f, readFileSync(resolve(ROOT, 'scripts/qbank/assets', f)))
}

const HUB = { name: 'Previous year questions', path: `${BASE}/` }
const PAPERS = { name: 'Past papers', path: `${BASE}/past-papers/` }
const sitemapUrls = []
const track = (path, priority, changefreq) => sitemapUrls.push({ path, priority, changefreq })

// ─── Sidebar boxes ───────────────────────────────────────────────────────────
// The answer-key pages put their switchers in a boxed sidebar rather than in a
// row of pills competing with the H1, and for the same reason: somebody who
// landed on the wrong paper or the wrong subject is then one tap from the right
// one, on every page, without having to understand the URL.

function papersBox(activeSlug) {
  return {
    title: one('Question papers', 'வினாத்தாள்கள்'),
    items: paperList.map((p) => ({
      href: p.path,
      label: `TNPSC ${esc(p.label)} ${p.year}`,
      active: p.slug === activeSlug,
    })),
  }
}

function subjectsBox(activeKey) {
  return {
    title: one('Subjects', 'பாடங்கள்'),
    items: liveUnits.map((u) => ({
      href: u.path,
      label: esc(u.def.en),
      count: n(u.questions.length),
      active: u.def.key === activeKey,
    })),
  }
}

function topicsBox(u, activeSlug) {
  if (!u.topicList.length) return { items: [] }
  return {
    title: one(`In ${u.def.en}`, 'இந்தப் பாடத்தில்'),
    items: u.topicList.map((t) => ({
      href: t.path,
      label: esc(t.name),
      count: n(t.questions.length),
      active: t.slug === activeSlug,
    })),
  }
}

// ─── The FAQ ─────────────────────────────────────────────────────────────────
// Written for somebody who has just arrived from a search and does not know us:
// whether these are the real questions, what costs money, and how to read them
// in Tamil. It carries FAQPage markup, so it goes only on the two hub pages —
// the same block repeated across five thousand pages reads as boilerplate.

const FAQ_ITEMS = [
  {
    q: 'Are these the real TNPSC questions?',
    qTa: 'இவை உண்மையான TNPSC வினாக்களா?',
    a:
      'Yes. Every question here comes from a TNPSC previous-year paper, and each one shows the exam and the ' +
      'year it was asked in. The marked answer is the keyed answer from that paper. The explanations are ' +
      'written by our team and are not official.',
    aTa:
      'ஆம். இங்குள்ள ஒவ்வொரு வினாவும் TNPSC-ன் முந்தைய ஆண்டு வினாத்தாளில் இருந்து எடுக்கப்பட்டது; எந்தத் ' +
      'தேர்வு, எந்த ஆண்டு என்பதும் ஒவ்வொன்றிலும் காட்டப்படுகிறது. குறிக்கப்பட்ட விடை அந்த வினாத்தாளின் ' +
      'அதிகாரப்பூர்வ விடை. விளக்கங்கள் எங்கள் குழு எழுதியவை — அவை அதிகாரப்பூர்வமானவை அல்ல.',
  },
  {
    q: 'Does it cost anything?',
    qTa: 'இதற்குக் கட்டணம் உண்டா?',
    a:
      'The questions and the correct answers are free to read, with no account and no sign-in. A free ' +
      'account adds the explanation behind each answer, and lets you write these papers as timed tests. ' +
      'No card is needed for that.',
    aTa:
      'வினாக்களையும் சரியான விடைகளையும் கணக்கு இல்லாமல், உள்நுழையாமல் இலவசமாகப் படிக்கலாம். இலவசக் ' +
      'கணக்கு தொடங்கினால் ஒவ்வொரு விடைக்குமான விளக்கமும் கிடைக்கும்; இந்த வினாத்தாள்களை நேரக் ' +
      'கட்டுப்பாட்டுத் தேர்வாகவும் எழுதலாம். அதற்கு Card தேவையில்லை.',
  },
  {
    q: 'How do I see why an answer is correct?',
    qTa: 'ஒரு விடை ஏன் சரி என்று எப்படிப் பார்ப்பது?',
    a:
      'Open any question and tap <b>Create a free account</b> under the explanation. It takes a minute. ' +
      'After that the full explanation shows on every previous-year question, in Tamil and English, ' +
      'including why each wrong option is wrong.',
    aTa:
      'எந்த வினாவையும் திறந்து, விளக்கத்தின் கீழ் உள்ள <b>இலவசக் கணக்கு தொடங்குங்க</b> என்பதை அழுத்துங்க. ' +
      'ஒரு நிமிடம் போதும். அதன் பிறகு ஒவ்வொரு முந்தைய ஆண்டு வினாவுக்கும் தமிழிலும் ஆங்கிலத்திலும் முழு ' +
      'விளக்கம், தவறான விடைகள் ஏன் தவறு என்பதுடன் தெரியும்.',
  },
  {
    q: 'Can I read everything in Tamil?',
    qTa: 'எல்லாவற்றையும் தமிழில் படிக்க முடியுமா?',
    a:
      'Use the <b>Both / English / தமிழ்</b> switch at the top of any page; your choice is remembered. ' +
      'The Group 1 papers are fully bilingual. Some Group 2 and Group 4 questions exist only in English ' +
      'so far — those stay in English even on the Tamil setting.',
    aTa:
      'எந்தப் பக்கத்திலும் மேலே உள்ள <b>Both / English / தமிழ்</b> என்ற தேர்வைப் பயன்படுத்துங்க; உங்கள் ' +
      'தேர்வு நினைவில் வைக்கப்படும். குரூப் 1 வினாத்தாள்கள் முழுமையாக இருமொழியில் உள்ளன. குரூப் 2, ' +
      'குரூப் 4-ல் சில வினாக்கள் இதுவரை ஆங்கிலத்தில் மட்டுமே உள்ளன.',
  },
  {
    q: 'Which exams and years are here?',
    qTa: 'எந்தத் தேர்வுகள், எந்த ஆண்டுகள் உள்ளன?',
    a: '', // filled in below, once the papers are known
    aTa: '',
  },
]

// ─── Listing helper ──────────────────────────────────────────────────────────
// Splits a question list into pages and writes each one. Page 1 lives at the
// bare path; page 2+ at /page-2/ etc., each rel=prev/next linked so a crawler
// walks the whole set, and each canonical to itself.

function writeListing({
  path, questions, crumbs, title, description,
  h1, h1Ta, lede, ledeTa, eyebrow, eyebrowTa,
  extraBody = '', stats = [], sidebar = [], sticky, numbered = false,
  // A paper page is one paper, so stamping each of its 200 questions with the
  // same name would be noise. Every other listing mixes papers.
  showSource = true,
}) {
  const pages = Math.max(1, Math.ceil(questions.length / PER_PAGE))
  const hrefFor = (p) => (p === 1 ? path : `${path}page-${p}/`)

  for (let p = 1; p <= pages; p++) {
    const slice = questions.slice((p - 1) * PER_PAGE, p * PER_PAGE)
    const thisPath = hrefFor(p)
    const suffix = pages > 1 ? ` — page ${p} of ${pages}` : ''

    const rowsHtml = `<ul class="minis">${slice
      .map((q) => miniQuestion(q, { num: numbered ? paperQno(q) : undefined, source: showSource }))
      .join('')}</ul>`

    const statsHtml = stats.length
      ? `<ul class="stats">${stats
          .map((s) => `<li><b>${esc(s.value)}</b>${one(s.label, s.labelTa)}</li>`)
          .join('')}</ul>`
      : ''

    const body = `<section class="hero">
${eyebrow ? `<p class="eyebrow">${one(eyebrow, eyebrowTa)}</p>` : ''}
<h1>${en(esc(h1) + esc(suffix))}${h1Ta ? ta(esc(h1Ta) + esc(suffix)) : ''}</h1>
${lede ? `<p class="lede">${both(lede, ledeTa)}</p>` : ''}
${statsHtml}
</section>
${p === 1 ? extraBody : ''}
${rowsHtml}
${pager(p, pages, hrefFor)}
${promo()}`

    writePage(
      thisPath,
      page({
        title: `${title}${suffix} | ${BRAND}`,
        description: description || lede || title,
        path: thisPath,
        crumbs: [...crumbs, ...(p > 1 ? [{ name: `Page ${p}`, path: thisPath }] : [])],
        body,
        sidebar,
        sticky,
        math: slice.some((q) => hasMath(q.question_text)),
        prev: p > 1 ? hrefFor(p - 1) : undefined,
        next: p < pages ? hrefFor(p + 1) : undefined,
      }),
    )
    // Only page 1 of a listing is worth a sitemap entry; the rest are reachable
    // and indexable but they are navigation, not destinations.
    track(thisPath, p === 1 ? 0.6 : 0.3, 'weekly')
  }
  return pages
}

// ─── Papers, grouped by exam ─────────────────────────────────────────────────
// Twenty-three papers in one flat list is a wall. Grouped under the three exams,
// with the years as tiles, it is the "Choose Your Exam" shape the answer-key
// pages use — and the first question a visitor actually has is which exam they
// are sitting.

const GROUP_ORDER = ['Group 1', 'Group 2 / 2A', 'Group 4 / VAO']
const GROUP_TA = Object.fromEntries(
  Object.values(GROUP_LABELS).map((g) => [g.label, g.labelTa]),
)

function papersByGroup() {
  const byGroup = new Map()
  for (const p of paperList) {
    if (!byGroup.has(p.label)) byGroup.set(p.label, [])
    byGroup.get(p.label).push(p)
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    label: g,
    labelTa: GROUP_TA[g] ?? g,
    papers: byGroup.get(g),
  }))
}

function paperSections() {
  return papersByGroup()
    .map(
      (g) => `<h2 class="sec reveal">${both(`TNPSC ${g.label}`, `TNPSC ${g.labelTa}`)}</h2>
<p class="sub">${both(
        `${g.papers.length} papers · ${n(g.papers.reduce((a, p) => a + p.questions.length, 0))} questions`,
        `${g.papers.length} வினாத்தாள்கள் · ${n(g.papers.reduce((a, p) => a + p.questions.length, 0))} வினாக்கள்`,
      )}</p>
<ul class="grid reveal">${g.papers
        .map(
          (p) => `<li class="tile">
<a class="t" href="${esc(p.path)}">${esc(p.label)} ${p.year}</a>
<span class="meta"><b>${n(p.questions.length)}</b> ${one('questions with answers', 'வினாக்கள் + விடைகள்')}</span>
</li>`,
        )
        .join('')}</ul>`,
    )
    .join('\n')
}

// Now that the papers are known, finish the last FAQ answer.
{
  const years = paperList.map((p) => p.year)
  const span = `${Math.min(...years)} to ${Math.max(...years)}`
  const summary = papersByGroup()
    .map((g) => `${g.label} (${g.papers.map((p) => p.year).join(', ')})`)
    .join('; ')
  const last = FAQ_ITEMS[FAQ_ITEMS.length - 1]
  last.a = `${n(paperList.length)} papers from ${span}: ${summary}. That is ${n(clean.length)} questions in all. We add a paper whenever TNPSC releases one.`
  last.aTa = `${span} ஆண்டுகளுக்கிடையேயான ${n(paperList.length)} வினாத்தாள்கள் — மொத்தம் ${n(clean.length)} வினாக்கள். TNPSC புதிய வினாத்தாள் வெளியிடும்போது அதையும் சேர்ப்போம்.`
}
const FAQ = faqSection(FAQ_ITEMS)

// ─── The hub ─────────────────────────────────────────────────────────────────

const totalQ = clean.length
const unitTiles = liveUnits
  .map(
    (u) => `<li class="tile">
<a class="t" href="${esc(u.path)}">${en(esc(u.def.en))}${ta(esc(u.def.ta))}</a>
<span class="meta">${
      u.def.weight ? `<span class="chip">${u.def.weight} ${one('marks in 2026', 'மதிப்பெண் 2026')}</span>` : ''
    }<b>${n(u.questions.length)}</b> ${one('questions', 'வினாக்கள்')}</span>
</li>`,
  )
  .join('\n')

writePage(
  `${BASE}/`,
  page({
    title: `TNPSC Previous Year Question Papers with Answers — Group 1, 2, 4 | ${BRAND}`,
    description:
      `${n(totalQ)} questions from the real TNPSC Group 1, Group 2 / 2A and Group 4 papers, each with its ` +
      `correct answer, in Tamil and English. Free to read — ${n(paperList.length)} papers, no sign-up needed.`,
    path: `${BASE}/`,
    crumbs: [HUB],
    sidebar: [papersBox(), subjectsBox()],
    sticky: { href: `${BASE}/past-papers/`, label: 'Browse papers', labelTa: 'வினாத்தாள்கள்' },
    faq: FAQ.html,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'TNPSC Previous Year Question Papers with Answers',
        url: ORIGIN + BASE + '/',
        description: `${n(totalQ)} questions from past TNPSC papers, each with its correct answer.`,
        inLanguage: ['en', 'ta'],
        publisher: { '@type': 'Organization', name: BRAND, url: ORIGIN },
        isPartOf: { '@type': 'WebSite', name: BRAND, url: ORIGIN },
      },
      FAQ.jsonLd,
    ],
    body: `<div class="herobanner" role="img" aria-label="${esc(
      `${BRAND} — TNPSC previous year question papers with answers, detailed explanations and insights. ` +
        `${n(totalQ)} questions, ${n(paperList.length)} papers, ${n(liveUnits.length)} subjects, in Tamil and English.`,
    )}"></div>
<section class="hero">
<div class="hero-text">
<p class="eyebrow">${both('Free · No sign-up to read', 'இலவசம் · படிக்க கணக்கு தேவையில்லை')}</p>
<h1>${en('TNPSC previous year question papers, with answers')}${ta(
      'TNPSC முந்தைய ஆண்டு வினாத்தாள்கள், விடைகளுடன்',
    )}</h1>
<p class="lede">${en(
      `Every question from ${n(paperList.length)} real TNPSC papers, in Tamil and English, with the correct ` +
        `answer marked. Free to read — pick your exam below, or jump straight to a subject.`,
    )}${ta(
      `${n(paperList.length)} உண்மையான TNPSC வினாத்தாள்களின் ஒவ்வொரு வினாவும், தமிழிலும் ஆங்கிலத்திலும், ` +
        `சரியான விடை குறிக்கப்பட்டு. படிக்க இலவசம் — கீழே உங்கள் தேர்வைத் தேர்ந்தெடுங்க, அல்லது நேரடியாக ஒரு பாடத்துக்குச் செல்லுங்க.`,
    )}</p>
<ul class="stats">
<li><b>${n(totalQ)}</b>${one('questions', 'வினாக்கள்')}</li>
<li><b>${n(paperList.length)}</b>${one('papers', 'வினாத்தாள்கள்')}</li>
<li><b>${n(liveUnits.length)}</b>${one('subjects', 'பாடங்கள்')}</li>
<li><b>2</b>${one('languages', 'மொழிகள்')}</li>
</ul>
</div>
<div class="hero-cta">
<a class="btn btn-brand btn-lg" href="#papers">${one('Browse the papers', 'வினாத்தாள்களைப் பாருங்க')}</a>
<a class="btn btn-ghost btn-lg" href="${esc(APP_REGISTER)}">${one('Create a free account', 'இலவசக் கணக்கு தொடங்குங்க')}</a>
</div>
</section>
<h2 class="sec reveal" id="papers">${both('Choose your exam', 'உங்கள் தேர்வைத் தேர்ந்தெடுங்க')}</h2>
<p class="sub">${both(
      'Each paper opens question by question, with the answer on every one.',
      'ஒவ்வொரு வினாத்தாளும் வினா வினாவாகத் திறக்கும் — ஒவ்வொன்றிலும் விடையுடன்.',
    )}</p>
${paperSections()}
<h2 class="sec reveal">${both('Or pick a subject', 'அல்லது ஒரு பாடத்தைத் தேர்ந்தெடுங்க')}</h2>
<p class="sub">${both(
      'Questions from every paper, sorted the way the Group 1 2026 preliminary syllabus is built.',
      'எல்லா வினாத்தாள்களிலிருந்தும் வினாக்கள், குரூப் 1 2026 முதல்நிலைப் பாடத்திட்டப்படி வரிசைப்படுத்தப்பட்டவை.',
    )}</p>
<ul class="grid reveal">${unitTiles}</ul>
<div class="reveal">${promo()}</div>`,
  }),
)
track(`${BASE}/`, 1.0, 'daily')

// ─── The past-papers hub ─────────────────────────────────────────────────────

writePage(
  `${BASE}/past-papers/`,
  page({
    title: `TNPSC Previous Year Question Papers — Group 1, Group 2 / 2A, Group 4 | ${BRAND}`,
    description:
      `All ${n(paperList.length)} TNPSC previous-year papers we hold, question by question, each with its ` +
      `correct answer in Tamil and English. Free to read.`,
    path: `${BASE}/past-papers/`,
    crumbs: [HUB, PAPERS],
    sidebar: [papersBox(), subjectsBox()],
    faq: FAQ.html,
    jsonLd: [FAQ.jsonLd],
    body: `<section class="hero">
<p class="eyebrow">${both('All papers', 'அனைத்து வினாத்தாள்கள்')}</p>
<h1>${en('TNPSC previous-year question papers')}${ta('TNPSC முந்தைய ஆண்டு வினாத்தாள்கள்')}</h1>
<p class="lede">${both(
      `The real papers, question by question, each with its correct answer marked in Tamil and English. ` +
        `${n(paperList.reduce((a, p) => a + p.questions.length, 0))} questions across ${n(paperList.length)} papers, free to read.`,
      `உண்மையான வினாத்தாள்கள், வினா வினாவாக, ஒவ்வொன்றிலும் சரியான விடை குறிக்கப்பட்டு. ` +
        `${n(paperList.length)} வினாத்தாள்களில் ${n(paperList.reduce((a, p) => a + p.questions.length, 0))} வினாக்கள் — படிக்க இலவசம்.`,
    )}</p>
</section>
${paperSections()}
${promo()}`,
  }),
)
track(`${BASE}/past-papers/`, 0.8, 'weekly')

// ─── Unit and topic pages ────────────────────────────────────────────────────

for (const u of liveUnits) {
  const topicRows = u.topicList.length
    ? `<h2 class="sec">${both(`Topics in ${u.def.en}`, 'இந்தப் பாடத்தின் பிரிவுகள்')}</h2>
<ul class="rows">${u.topicList
        .map(
          (t) =>
            `<li><a class="r" href="${esc(t.path)}"><span class="q">${esc(t.name)}</span>` +
            `<span class="n">${n(t.questions.length)}</span>` +
            `<span class="go" aria-hidden="true">→</span></a></li>`,
        )
        .join('')}</ul>
<h2 class="sec">${both(`Every ${u.def.en} question`, 'அனைத்து வினாக்களும்')}</h2>`
    : ''

  writeListing({
    path: u.path,
    questions: u.questions,
    crumbs: [HUB, { name: u.def.en, path: u.path }],
    title: `TNPSC ${u.def.en} Previous Year Questions with Answers`,
    h1: `${u.def.en} — ${n(u.questions.length)} previous-year questions`,
    h1Ta: `${u.def.ta} — ${n(u.questions.length)} முந்தைய ஆண்டு வினாக்கள்`,
    lede:
      `${u.def.en} questions taken from the real TNPSC papers, each with its correct answer in Tamil and ` +
      `English and the exam and year it was asked in.` +
      (u.def.weight
        ? ` This subject carries ${u.def.weight} of the 200 questions in the Group 1 2026 preliminary paper.`
        : ''),
    ledeTa:
      `உண்மையான TNPSC வினாத்தாள்களிலிருந்து எடுக்கப்பட்ட வினாக்கள், ஒவ்வொன்றிலும் சரியான விடையுடன், ` +
      `எந்தத் தேர்வில் எந்த ஆண்டு கேட்கப்பட்டது என்பதுடன்.` +
      (u.def.weight ? ` குரூப் 1 2026 முதல்நிலைத் தேர்வின் 200 வினாக்களில் ${u.def.weight} இந்தப் பாடத்திலிருந்து.` : ''),
    eyebrow: u.def.weight ? `${u.def.weight} marks · Group 1 2026 Prelims` : 'Previous year questions',
    eyebrowTa: u.def.weight ? `${u.def.weight} மதிப்பெண் · குரூப் 1 2026` : 'முந்தைய ஆண்டு வினாக்கள்',
    stats: [
      { value: n(u.questions.length), label: 'questions', labelTa: 'வினாக்கள்' },
      ...(u.topicList.length ? [{ value: n(u.topicList.length), label: 'topics', labelTa: 'பிரிவுகள்' }] : []),
      ...(u.def.weight ? [{ value: String(u.def.weight), label: 'marks in 2026', labelTa: 'மதிப்பெண் 2026' }] : []),
    ],
    extraBody: topicRows,
    sidebar: [subjectsBox(u.def.key), topicsBox(u), papersBox()],
  })

  for (const t of u.topicList) {
    writeListing({
      path: t.path,
      questions: t.questions,
      crumbs: [HUB, { name: u.def.en, path: u.path }, { name: t.name, path: t.path }],
      title: `${t.name} — TNPSC Previous Year Questions with Answers`,
      h1: `${t.name} — ${n(t.questions.length)} previous-year questions`,
      lede:
        `Every ${t.name} question TNPSC has asked in the papers we hold, under ${u.def.en}, with the ` +
        `correct answer marked in Tamil and English and the exam and year each one comes from. ` +
        `Explanations are free with an account.`,
      ledeTa:
        `${u.def.ta} பாடத்தின் கீழ், எங்களிடம் உள்ள வினாத்தாள்களில் TNPSC கேட்ட அனைத்து வினாக்களும், ` +
        `சரியான விடை குறிக்கப்பட்டு. விளக்கங்கள் இலவசக் கணக்கில் கிடைக்கும்.`,
      eyebrow: u.def.en,
      eyebrowTa: u.def.ta,
      stats: [{ value: n(t.questions.length), label: 'questions', labelTa: 'வினாக்கள்' }],
      sidebar: [topicsBox(u, t.slug), subjectsBox(u.def.key), papersBox()],
    })
  }
}

// ─── One paper ───────────────────────────────────────────────────────────────

for (const p of paperList) {
  const key = ANSWER_KEY_PAGES[p.slug]
  writeListing({
    path: p.path,
    questions: p.questions,
    numbered: p.numbered,
    showSource: false,
    crumbs: [HUB, PAPERS, { name: `${p.label} ${p.year}`, path: p.path }],
    title: `TNPSC ${p.label} ${p.year} Question Paper with Answers`,
    h1: `TNPSC ${p.label} ${p.year} — question paper with answers`,
    h1Ta: `TNPSC ${GROUP_TA[p.label] ?? p.label} ${p.year} — வினாத்தாளும் விடைகளும்`,
    lede:
      `All ${n(p.questions.length)} questions from the TNPSC ${p.label} ${p.year} paper we hold, in Tamil ` +
      `and English, each with its correct answer marked. Open any question for the full explanation.`,
    ledeTa:
      `எங்களிடம் உள்ள TNPSC ${GROUP_TA[p.label] ?? p.label} ${p.year} வினாத்தாளின் ${n(p.questions.length)} ` +
      `வினாக்களும், தமிழிலும் ஆங்கிலத்திலும், சரியான விடை குறிக்கப்பட்டு. முழு விளக்கத்துக்கு எந்த வினாவையும் திறங்க.`,
    eyebrow: `${p.label} · ${p.year}`,
    eyebrowTa: `${GROUP_TA[p.label] ?? p.label} · ${p.year}`,
    stats: [
      { value: n(p.questions.length), label: 'questions', labelTa: 'வினாக்கள்' },
      { value: String(p.year), label: 'exam year', labelTa: 'தேர்வு ஆண்டு' },
    ],
    extraBody: key
      ? `<p class="sub">${en(
          `Looking for the key on its own? The <a href="${esc(key)}">TNPSC ${esc(p.label)} ${p.year} answer key</a> ` +
            `lists every answer in order, with a PDF to download.`,
        )}${ta(
          `விடைகள் மட்டும் வேண்டுமா? <a href="${esc(key)}">TNPSC ${esc(p.label)} ${p.year} விடைக்குறிப்பு</a> ` +
            `பக்கத்தில் எல்லா விடைகளும் வரிசையாக, PDF-உடன்.`,
        )}</p>`
      : '',
    sidebar: [papersBox(p.slug), subjectsBox()],
  })
}

// ─── One page per question ───────────────────────────────────────────────────
// This is the page the whole archive exists for. The title is the question's own
// wording, because that is the string somebody pastes into Google.

console.log('Writing question pages…')
let done = 0
for (const u of liveUnits) {
  for (const g of u.groups) {
    const list = g.questions
    // What this group is called and where it points: its own topic page when it
    // has one, otherwise the unit it belongs to.
    const groupName = g.topic ? g.topic.name : u.def.en
    const groupPath = g.topic ? g.topic.path : u.path
    for (let i = 0; i < list.length; i++) {
      const q = list[i]
      const prev = list[i - 1]
      const next = list[i + 1]
      const url = ORIGIN + q._path
      const stem = plain(q.question_text)
      const stemTa = plain(q.question_text_ta ?? '')
      const correct = String(q.correct_answer ?? '').toUpperCase()
      const answerText = plain(q[`option_${correct.toLowerCase()}`] ?? '')

      // Six siblings, taken from around this question so neighbouring pages link
      // to overlapping-but-different sets — that is what gets a tree this size
      // crawled rather than only its first few hundred pages.
      const RELATED = 3
      const related = []
      for (let k = 1; related.length < RELATED && k < list.length; k++) {
        for (const j of [i + k, i - k]) {
          if (j >= 0 && j < list.length && j !== i && related.length < RELATED) related.push(list[j])
        }
      }

      const relHtml = related.length
        ? `<section class="sec-block" id="more">
<h2>${one(
            `More ${groupName} questions`,
            'மேலும் வினாக்கள்',
          )}</h2>
<p class="sub">${one(
            'Each one with its options, the correct answer marked, and the exam and year it was asked in.',
            'ஒவ்வொன்றும் விடைத் தேர்வுகளுடன், சரியான விடை குறிக்கப்பட்டு, எந்தத் தேர்வில் எந்த ஆண்டு கேட்கப்பட்டது என்பதுடன்.',
          )}</p>
<ul class="minis">${related.map((r) => miniQuestion(r, { source: true })).join('')}</ul>
<p class="mini-go"><a href="${esc(groupPath)}">${one(
            `All ${n(list.length)} ${groupName} questions`,
            'இந்தப் பிரிவின் அனைத்து வினாக்களும்',
          )} →</a></p>
</section>`
        : ''

      const nav =
        prev || next
          ? `<nav class="nextprev">
${prev ? `<a href="${esc(prev._path)}"><i>${both('← Previous question', '← முந்தைய வினா')}</i>${en(mathText(plain(prev.question_text, 90)))}</a>` : ''}
${next ? `<a href="${esc(next._path)}"><i>${both('Next question →', 'அடுத்த வினா →')}</i>${en(mathText(plain(next.question_text, 90)))}</a>` : ''}
</nav>`
          : ''

      const where = []
      if (q._paper) {
        where.push({
          href: q._paper.path,
          label: `TNPSC ${esc(q._paper.label)} ${q._paper.year}`,
        })
      }
      where.push({ href: u.path, label: esc(u.def.en) })
      if (g.topic) where.push({ href: g.topic.path, label: esc(g.topic.name) })

      // The page is a run of named sections rather than one block, so the
      // contents box at the top can list them, each has a heading that matches
      // how the question gets typed into a search box, and a result can link
      // straight to the part somebody wanted.
      const unitForSections = { ...u.def, path: u.path }
      const faq = questionFaq(q, { paper: q._paper, unit: unitForSections })
      const answerHtml = answerSection(q)
      const explanationHtml = explanationSection(q)
      const detailsHtml = detailsSection(q, {
        paper: q._paper,
        unit: unitForSections,
        topic: g.topic?.name,
      })

      // What used to sit here was a table of contents — Answer / Explanation /
      // Question details / More questions / FAQ. On a page this short it was
      // noise, and its "Explanation" link pointed at a section the reader
      // cannot read until they sign in. The slot now carries what the question
      // IS: its subject, its topic, and how often that topic is actually
      // examined, each one a link to the page that backs the number up.
      //
      // The headline count is the TOPIC's, not this question's. Only ~1.6% of
      // the archive is a genuine cross-paper repeat, so a per-question counter
      // would read "1" on almost every page; topic frequency is the real and
      // useful answer to "how much does this matter". See insightStrip().
      const insight = insightStrip({
        unit: {
          name: u.def.en,
          path: u.path,
          count: u.questions.length,
          marks: u.def.weight,
        },
        topic: g.topic
          ? { name: g.topic.name, path: g.topic.path, count: g.topic.questions.length }
          : undefined,
        paper: q._paper,
        papers: paperList.length,
      })
      const repeatHtml = repeatNotice(repeats.get(q.id) ?? [], q)

      const body = `${questionCard(q)}
${insight}
${repeatHtml}
${answerHtml}
${explanationHtml}
${detailsHtml}
${relHtml}
${faq.html}
${nav}
${promo({
        heading: 'See why — then try thirty more',
        headingTa: 'ஏன் என்று பாருங்க — பிறகு இன்னும் முப்பது',
        text:
          `A free account opens the full explanation for this question in Tamil and English, including why ` +
          `each wrong option is wrong. It also unlocks the other ${n(Math.max(0, list.length - 1))} ` +
          `previous-year questions we hold on ${groupName}, as a timed test in the 2026 Group 1 pattern.`,
        textTa:
          `இலவசக் கணக்கு இந்த வினாவின் முழு விளக்கத்தைத் தமிழிலும் ஆங்கிலத்திலும் திறக்கும் — தவறான ` +
          `விடைகள் ஏன் தவறு என்பதுடன். இதே பிரிவில் உள்ள மற்ற ${n(Math.max(0, list.length - 1))} வினாக்களையும் ` +
          `நேரக் கட்டுப்பாட்டுத் தேர்வாக எழுதலாம்.`,
        cta: 'Create a free account',
        ctaTa: 'இலவசக் கணக்கு தொடங்குங்க',
      })}`

      writePage(
        q._path,
        page({
          // The question's own wording first, brand last: a verbatim search has
          // to match the front of the title.
          title: `${plain(stem, 95)} — ${BRAND}`,
          // The answer goes in the meta description because it is public and it
          // is what the searcher wanted. The explanation is not promised as
          // visible — only as available.
          // The answer goes in the description because it is public and it is
          // what the searcher wanted. The Tamil wording follows it, so a search
          // in Tamil has something in its own script to match and to show —
          // the <title> can only be one language without growing too long to
          // display, and that one is English.
          description:
            `${plain(stem, 130)} Ans: (${correct})${answerText ? ` ${plain(answerText, 60)}` : ''}. ` +
            `${q._paper ? `TNPSC ${q._paper.label} ${q._paper.year}. ` : ''}` +
            `${stemTa ? `${plain(stemTa, 110)} ` : ''}` +
            `Full explanation free with a ${BRAND} account.`,
          path: q._path,
          crumbs: [
            HUB,
            { name: u.def.en, path: u.path },
            ...(g.topic ? [{ name: g.topic.name, path: g.topic.path }] : []),
            { name: plain(stem, 60), path: q._path },
          ],
          jsonLd: [questionJsonLd(q, url), faq.jsonLd],
          body,
          sidebar: [
            { title: one('Where this is from', 'இது எங்கிருந்து'), items: where },
            papersBox(q._paper?.slug),
          ],
          sticky: { href: '#explanation', label: 'See the explanation', labelTa: 'விளக்கம் பார்க்க' },
          math: hasMath(
            q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            ...related.map((r) => r.question_text),
          ),
          prev: prev?._path,
          next: next?._path,
        }),
      )
      track(q._path, 0.7, 'monthly')
      if (++done % 2000 === 0) console.log(`  ${n(done)} / ${n(clean.length)}`)
    }
  }
}
console.log(`  ${n(done)} question pages`)

// ─── Sitemaps ────────────────────────────────────────────────────────────────
// A sitemap index plus chunks, because one file cannot hold 47,000 URLs.

const today = new Date().toISOString().slice(0, 10)
const chunks = []
for (let i = 0; i < sitemapUrls.length; i += PER_SITEMAP) {
  chunks.push(sitemapUrls.slice(i, i + PER_SITEMAP))
}
chunks.forEach((chunk, i) => {
  const name = `sitemap-questions-${i + 1}.xml`
  write(
    name,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk
      .map(
        (u) =>
          `<url><loc>${esc(ORIGIN + u.path)}</loc><lastmod>${today}</lastmod>` +
          `<changefreq>${u.changefreq}</changefreq><priority>${u.priority.toFixed(1)}</priority></url>`,
      )
      .join('\n')}
</urlset>
`,
  )
})
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunks
    .map(
      (_, i) =>
        `<sitemap><loc>${ORIGIN}${BASE}/sitemap-questions-${i + 1}.xml</loc><lastmod>${today}</lastmod></sitemap>`,
    )
    .join('\n')}
</sitemapindex>
`,
)

// ─── Report ──────────────────────────────────────────────────────────────────

const unmappedCount = units.get(UNIT_OTHER.key).questions.length
const report = {
  builtAt: new Date().toISOString(),
  out: OUT,
  source: SRC,
  rowsRead: rows.length,
  published: clean.length,
  rejected: rejected.length,
  blemished: blemished.length,
  pages: filesWritten,
  urlsInSitemap: sitemapUrls.length,
  sitemapChunks: chunks.length,
  units: liveUnits.map((u) => ({
    key: u.def.key,
    name: u.def.en,
    weight2026: u.def.weight,
    questions: u.questions.length,
    topics: u.topicList.length,
  })),
  pastPapers: paperList.map((p) => ({ paper: `${p.label} ${p.year}`, questions: p.questions.length })),
  rejectedDetail: rejected,
  blemishedDetail: blemished,
}
mkdirSync(resolve(ROOT, 'server/_qbank'), { recursive: true })
writeFileSync(resolve(ROOT, 'server/_qbank/build-report.json'), JSON.stringify(report, null, 2))

console.log(`\n── built ──────────────────────────────────────────────`)
console.log(`  files           ${n(filesWritten)}`)
console.log(`  questions       ${n(clean.length)} published, ${n(rejected.length)} held back`)
console.log(`  sitemap URLs    ${n(sitemapUrls.length)} in ${chunks.length} chunk(s)`)
for (const u of report.units) {
  console.log(
    `  ${u.key.padEnd(20)} ${String(u.questions).padStart(7)} in ${String(u.topics).padStart(4)} topics` +
      (u.weight2026 ? `  (${u.weight2026} marks)` : ''),
  )
}
if (unmappedCount) {
  console.log(`\n!! ${n(unmappedCount)} questions fell into "${UNIT_OTHER.en}" — add their subject to taxonomy.mjs`)
}
if (blemished.length) {
  console.log(
    `\n   ${n(blemished.length)} published question(s) have two identical distractors — a fault in the` +
      `\n   printed paper rather than a reason to withhold them. See server/_qbank/build-report.json`,
  )
}
if (rejected.length) {
  console.log(`\n!! ${n(rejected.length)} questions were held back as unanswerable. See server/_qbank/build-report.json`)
  const bywhy = new Map()
  for (const r of rejected) {
    const k = r.why.replace(/".*"/, '"…"').replace(/[A-E] and [A-E]/, 'X and Y')
    bywhy.set(k, (bywhy.get(k) ?? 0) + 1)
  }
  for (const [k, c] of [...bywhy].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(5)}  ${k}`)
}
console.log(`\n  report          server/_qbank/build-report.json`)
console.log(`  next            see scripts/qbank/README.md to serve it`)
