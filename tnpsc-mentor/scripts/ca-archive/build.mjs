// Public current-affairs archive: tnpscmentors.in/current-affairs/
//
//   node scripts/ca-archive/build.mjs [--src server/_ca/ca.ndjson] [--out ca-dist]
//
// Same design and gate as the PYQ archive (scripts/qbank): news notes, questions
// and correct answers are public; past the opening line, explanations are not
// in the HTML (a signed-in reader fetches them from /api/questions/archive-explanation).
//
//   /current-affairs/                     hub
//   /current-affairs/2026/11/             month: its days + the monthly question bank
//   /current-affairs/2026-11-17/          day: every news item by section + that day's questions
//   /current-affairs/topic/<slug>/        one section across days, newest first
//   /current-affairs/q/<slug>/            one question
//
// Public = superadmin-approved: a day's notes need an active magazine materials
// row, a day's questions an active daily-questions materials row. The monthly
// bank has no approval step in the app (the CA hub serves every active row), so
// every active row is public. See build-docs/features/public-current-affairs.md.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slugify } from '../qbank/taxonomy.mjs'
import {
  CSS, ORIGIN, BASE, BRAND, CA_PATH,
  esc, plain, excerpt, page, questionJsonLd, promo, pager, mathText, hasMath, n,
  en, ta, both, one, enBlock, taBlock,
  questionCard, answerSection, explanationSection, miniQuestion, inlineFaq, toc, optionsOf,
} from '../qbank/render.mjs'
import {
  SECTIONS, sectionLabels, sectionKeyForTopic, isSectionEcho, sectionRank, parseBullets,
  MONTHS_EN, MONTHS_TA,
} from './sections.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const argOf = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const SRC = resolve(ROOT, argOf('--src', 'server/_ca/ca.ndjson'))
const OUT = resolve(ROOT, argOf('--out', 'ca-dist'))
const CA = CA_PATH.replace(/\/$/, '') // '/current-affairs'
const PER_PAGE = 25
const CSS_HREF = `${CA}/archive.css`
const FOOT_NOTE = [
  'Current affairs notes and questions are written by TNPSC Mentors from each day’s news, for TNPSC exam preparation.',
  'நடப்பு நிகழ்வுக் குறிப்புகளும் வினாக்களும் அன்றாடச் செய்திகளிலிருந்து TNPSC தேர்வுக்காக TNPSC Mentors தயாரித்தவை.',
]
const OG_ALT = `${BRAND} — TNPSC current affairs in Tamil and English`

// ─── Read ────────────────────────────────────────────────────────────────────

const rows = readFileSync(SRC, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
const pubMagazine = new Set(rows.filter((r) => r.k === 'pub' && r.type === 'magazine').map((r) => r.date))
const pubDailyQ = new Set(rows.filter((r) => r.k === 'pub' && r.type === 'daily_q').map((r) => r.date))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const items = rows.filter(
  (r) => r.k === 'item' && DATE_RE.test(r.date) && pubMagazine.has(r.date) && plain(r.content),
)

// ─── Questions ───────────────────────────────────────────────────────────────

const rejected = []
function defect(q) {
  if (!plain(q.question_text)) return 'empty stem'
  const letters = optionsOf(q)
  if (letters.length < 2) return 'fewer than two options'
  const c = String(q.correct_answer ?? '').trim().toUpperCase()
  if (!letters.includes(c)) return `keyed answer "${c}" is not one of the options`
  return null
}

/** 'October 2026' → '2026-10', or null. */
function monthKeyOf(label, year) {
  const [m, y] = String(label ?? '').trim().split(/\s+/)
  const mi = MONTHS_EN.indexOf(m)
  const yy = Number(y) || Number(year)
  return mi >= 0 && yy ? `${yy}-${String(mi + 1).padStart(2, '0')}` : null
}

// Slugs are assigned over EVERY exported row in insertion order — published or
// not, active or not — so approving an older day later, or a new month landing,
// never shifts an existing question's URL.
const allQ = rows
  .filter((r) => r.k === 'dq' || r.k === 'mq')
  .sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.external_id < b.external_id ? -1 : 1,
  )
const takenSlugs = new Set()
for (const q of allQ) {
  const base = slugify(plain(q.question_text), 80) || slugify(`ca-question-${q.external_id}`, 80)
  let slug = base
  for (let i = 2; takenSlugs.has(slug); i++) slug = `${base}-${i}`
  takenSlugs.add(slug)
  q._path = `${CA}/q/${slug}/`
}

const questions = []
for (const q of allQ) {
  if (q.active === false) continue
  if (q.k === 'dq' && !(DATE_RE.test(q.date) && pubDailyQ.has(q.date))) continue
  const why = defect(q)
  if (why) {
    rejected.push({ id: q.id, external_id: q.external_id, why })
    continue
  }
  q._month = q.k === 'dq' ? q.date.slice(0, 7) : monthKeyOf(q.ca_month, q.ca_year)
  if (!q._month) {
    rejected.push({ id: q.id, external_id: q.external_id, why: `unreadable month "${q.ca_month}"` })
    continue
  }
  q._section = sectionKeyForTopic(q.ca_topic || q.topic)
  questions.push(q)
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const dayLabel = (d, lang = 'en') => {
  const [y, m, dd] = d.split('-').map(Number)
  return `${dd} ${(lang === 'ta' ? MONTHS_TA : MONTHS_EN)[m - 1]} ${y}`
}
const monthLabel = (mk, lang = 'en') => {
  const [y, m] = mk.split('-').map(Number)
  return `${(lang === 'ta' ? MONTHS_TA : MONTHS_EN)[m - 1]} ${y}`
}
const dayPath = (d) => `${CA}/${d}/`
const monthPath = (mk) => `${CA}/${mk.replace('-', '/')}/`
const topicSlug = (key) => slugify(sectionLabels(key)[0], 60) || 'general'
const topicPath = (key) => `${CA}/topic/${topicSlug(key)}/`

const KNOW = {
  must: ['Must Know', 'கட்டாயம் அறிய வேண்டியவை'],
  should: ['Should Know', 'அறிந்திருக்க வேண்டியவை'],
  good: ['Good to Know', 'அறிந்தால் நல்லது'],
}

// ─── Model ───────────────────────────────────────────────────────────────────

const days = new Map() // date -> { date, items[], questions[] }
const day = (d) => days.get(d) ?? days.set(d, { date: d, items: [], questions: [] }).get(d)
for (const it of items) day(it.date).items.push(it)
for (const q of questions) if (q.k === 'dq') day(q.date).questions.push(q)
for (const d of days.values()) {
  d.items.sort((a, b) => sectionRank(a.topic) - sectionRank(b.topic) || (a.external_id < b.external_id ? -1 : 1))
  d.items.forEach((it, i) => (it._anchor = `n${i + 1}`))
  d.questions.sort((a, b) => (a.external_id < b.external_id ? -1 : 1))
}
const dayList = [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first

const months = new Map() // 'YYYY-MM' -> { key, days[], questions[] }
const month = (k) => months.get(k) ?? months.set(k, { key: k, days: [], questions: [] }).get(k)
for (const d of dayList) month(d.date.slice(0, 7)).days.push(d)
for (const q of questions) if (q.k === 'mq') month(q._month).questions.push(q)
for (const m of months.values()) m.questions.sort((a, b) => (a.external_id < b.external_id ? -1 : 1))
const monthList = [...months.values()].sort((a, b) => (a.key < b.key ? 1 : -1))

const topics = new Map() // section key -> items[] newest first
for (const d of dayList) {
  for (const it of d.items) (topics.get(it.topic) ?? topics.set(it.topic, []).get(it.topic)).push(it)
}
const topicList = [...topics.keys()].sort((a, b) => sectionRank(a) - sectionRank(b))
const topicQuestionCount = new Map()
for (const q of questions) if (q._section) topicQuestionCount.set(q._section, (topicQuestionCount.get(q._section) ?? 0) + 1)

// ─── Writing ─────────────────────────────────────────────────────────────────

// The output dir is wiped first; never let a typo'd --out wipe the repo.
if (!relative(OUT, ROOT).startsWith('..')) throw new Error(`refusing to wipe ${OUT}: it contains the repo`)
rmSync(OUT, { recursive: true, force: true })
let filesWritten = 0
const sitemap = [] // { path, lastmod }
function writePage(path, html, lastmod) {
  const rel = path.replace(new RegExp(`^${CA}/?`), '').replace(/\/$/, '')
  const full = join(OUT, rel, 'index.html')
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, html)
  filesWritten++
  if (lastmod !== null) sitemap.push({ path, lastmod })
}
const today = new Date().toISOString().slice(0, 10)

// ─── Shared pieces ───────────────────────────────────────────────────────────

const HOME = { name: 'Home', path: '/' }
const HUB = { name: 'Current Affairs', path: `${CA}/` }

/** `**bold**` → <strong>, everything else escaped. */
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

function bullets(md) {
  const lines = parseBullets(md)
  if (!lines.length) return ''
  return `<ul class="ca-pts">${lines.map((l) => `<li class="d${l.depth}">${inline(l.text)}</li>`).join('')}</ul>`
}

function knowBadge(level) {
  return KNOW[level] ? `<span class="know know-${level}">${one(KNOW[level][0], KNOW[level][1])}</span>` : ''
}

/** One news item, whole. `dated` adds the day chip (topic pages mix days). */
function itemHtml(it, { dated = false } = {}) {
  const echo = isSectionEcho(it.title, it.topic)
  const meta = [
    dated
      ? `<a class="chip" href="${esc(dayPath(it.date) + '#' + it._anchor)}">${one(dayLabel(it.date), dayLabel(it.date, 'ta'))}</a>`
      : '',
    knowBadge(it.know_level),
  ].join('')
  const title = echo
    ? ''
    : `<h3>${en(inline(it.title))}${plain(it.title_ta) ? ta(inline(it.title_ta)) : ''}</h3>`
  const bodyTa = plain(it.content_ta) ? taBlock(bullets(it.content_ta)) : ''
  return `<article class="ca-item" id="${it._anchor}">
${meta ? `<p class="ca-meta">${meta}</p>` : ''}${title}
${enBlock(bullets(it.content))}${bodyTa}
</article>`
}

function sectionsHtml(list) {
  const groups = new Map()
  for (const it of list) (groups.get(it.topic) ?? groups.set(it.topic, []).get(it.topic)).push(it)
  return [...groups.entries()]
    .map(([key, its]) => {
      const [e, t] = sectionLabels(key)
      return `<section class="ca-sec" id="${topicSlug(key)}">
<h2>${en(esc(e))}${t ? ta(esc(t)) : ''}</h2>
${its.map((it) => itemHtml(it)).join('\n')}
</section>`
    })
    .join('\n')
}

function hero({ eyebrow, h1, h1Ta, lede, ledeTa, stats = [], suffix = '' }) {
  return `<section class="hero">
<p class="eyebrow">${one(eyebrow[0], eyebrow[1])}</p>
<h1>${en(esc(h1) + esc(suffix))}${h1Ta ? ta(esc(h1Ta) + esc(suffix)) : ''}</h1>
${lede ? `<p class="lede">${both(lede, ledeTa)}</p>` : ''}
${stats.length ? `<ul class="stats">${stats.map((s) => `<li><b>${esc(s[0])}</b>${one(s[1], s[2])}</li>`).join('')}</ul>` : ''}
</section>`
}

function monthsBox(activeKey) {
  return {
    title: one('Months', 'மாதங்கள்'),
    items: monthList.map((m) => ({
      href: monthPath(m.key),
      label: one(monthLabel(m.key), monthLabel(m.key, 'ta')),
      active: m.key === activeKey,
    })),
  }
}

function topicsBox(activeKey) {
  return {
    title: one('Topics', 'தலைப்புகள்'),
    items: topicList.map((k) => ({
      href: topicPath(k),
      label: one(sectionLabels(k)[0], sectionLabels(k)[1] ?? sectionLabels(k)[0]),
      active: k === activeKey,
      count: n(topics.get(k).length),
    })),
  }
}

function recentDaysBox(activeDate) {
  return {
    title: one('Latest days', 'சமீபத்திய நாட்கள்'),
    items: dayList.slice(0, 10).map((d) => ({
      href: dayPath(d.date),
      label: one(dayLabel(d.date), dayLabel(d.date, 'ta')),
      active: d.date === activeDate,
    })),
  }
}

const caPromo = (extra = {}) =>
  promo({
    heading: 'Take today’s current affairs test in the app',
    headingTa: 'இன்றைய நடப்பு நிகழ்வுத் தேர்வை App-ல் எழுதுங்க',
    text:
      'A free account gives you a short timed test on each day’s news, the monthly current affairs tests, ' +
      'the full explanation behind every answer in Tamil and English, and the day’s notes as a PDF.',
    textTa:
      'இலவசக் கணக்கில் ஒவ்வொரு நாளின் செய்திகளுக்கும் ஒரு சிறிய தேர்வு, மாதாந்திர நடப்பு நிகழ்வுத் தேர்வுகள், ' +
      'ஒவ்வொரு விடைக்கும் தமிழிலும் ஆங்கிலத்திலும் முழு விளக்கம் கிடைக்கும்.',
    ...extra,
  })

const common = { css: CSS_HREF, footNote: FOOT_NOTE, ogAlt: OG_ALT }
const STICKY = { href: `${CA}/`, label: 'Current affairs', labelTa: 'நடப்பு நிகழ்வுகள்' }

function minis(list, { numbered = false } = {}) {
  return `<ul class="minis">${list.map((q, i) => miniQuestion(q, { num: numbered ? i + 1 : undefined })).join('')}</ul>`
}

// ─── Day pages ───────────────────────────────────────────────────────────────

dayList.forEach((d, i) => {
  const newer = dayList[i - 1]
  const older = dayList[i + 1]
  const path = dayPath(d.date)
  const sectionKeys = [...new Set(d.items.map((it) => it.topic))]
  const lbl = dayLabel(d.date)
  const lblTa = dayLabel(d.date, 'ta')

  const contents = toc([
    ...sectionKeys.map((k) => ({ id: topicSlug(k), label: one(sectionLabels(k)[0], sectionLabels(k)[1] ?? sectionLabels(k)[0]) })),
    ...(d.questions.length ? [{ id: 'questions', label: one('Questions', 'வினாக்கள்') }] : []),
  ])

  const qHtml = d.questions.length
    ? `<section class="sec-block" id="questions">
<h2>${one(`Current affairs questions — ${lbl}`, `நடப்பு நிகழ்வு வினாக்கள் — ${lblTa}`)}</h2>
<p class="sub">${both(
        `${d.questions.length} questions on this day’s news, with the correct answer marked.`,
        `இன்றைய செய்திகளிலிருந்து ${d.questions.length} வினாக்கள், சரியான விடையுடன்.`,
      )}</p>
${minis(d.questions, { numbered: true })}
</section>`
    : ''

  const nav =
    newer || older
      ? `<nav class="nextprev">
${older ? `<a href="${esc(dayPath(older.date))}"><i>${both('← Previous day', '← முந்தைய நாள்')}</i>${both(dayLabel(older.date), dayLabel(older.date, 'ta'))}</a>` : ''}
${newer ? `<a href="${esc(dayPath(newer.date))}"><i>${both('Next day →', 'அடுத்த நாள் →')}</i>${both(dayLabel(newer.date), dayLabel(newer.date, 'ta'))}</a>` : ''}
</nav>`
      : ''

  const firstTitles = d.items.filter((it) => !isSectionEcho(it.title, it.topic)).slice(0, 3).map((it) => plain(it.title))
  const body = `${hero({
    eyebrow: ['Daily current affairs', 'தினசரி நடப்பு நிகழ்வுகள்'],
    h1: `TNPSC Current Affairs — ${lbl}`,
    h1Ta: `TNPSC நடப்பு நிகழ்வுகள் — ${lblTa}`,
    lede: [
      d.items.length ? `${d.items.length} news notes in ${sectionKeys.length} sections` : '',
      d.questions.length ? `${d.questions.length} practice questions with answers` : '',
    ].filter(Boolean).join(' and ') + ', in Tamil and English.',
    ledeTa: [
      d.items.length ? `${sectionKeys.length} பிரிவுகளில் ${d.items.length} செய்திக் குறிப்புகள்` : '',
      d.questions.length ? `விடையுடன் ${d.questions.length} பயிற்சி வினாக்கள்` : '',
    ].filter(Boolean).join(', ') + ' — தமிழிலும் ஆங்கிலத்திலும்.',
  })}
${contents}
${sectionsHtml(d.items)}
${qHtml}
${nav}
${caPromo()}`

  writePage(
    path,
    page({
      ...common,
      title: `TNPSC Current Affairs ${lbl} — Tamil & English | ${BRAND}`,
      description:
        `TNPSC current affairs for ${lbl} in Tamil and English` +
        (firstTitles.length ? `: ${firstTitles.join('; ')}` : '') +
        (d.questions.length ? `. Plus ${d.questions.length} questions with answers.` : '.'),
      path,
      crumbs: [HOME, HUB, { name: monthLabel(d.date.slice(0, 7)), path: monthPath(d.date.slice(0, 7)) }, { name: lbl, path }],
      body,
      sidebar: [recentDaysBox(d.date), topicsBox(), monthsBox(d.date.slice(0, 7))],
      sticky: STICKY,
      math: d.questions.some((q) => hasMath(q.question_text)),
      prev: older ? dayPath(older.date) : undefined,
      next: newer ? dayPath(newer.date) : undefined,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `TNPSC Current Affairs — ${lbl}`,
          datePublished: d.date,
          inLanguage: ['en', 'ta'],
          about: sectionKeys.map((k) => sectionLabels(k)[0]),
          publisher: { '@type': 'Organization', name: BRAND, url: ORIGIN },
          mainEntityOfPage: ORIGIN + path,
        },
      ],
    }),
    d.date,
  )
})

// ─── Month pages ─────────────────────────────────────────────────────────────

for (const m of monthList) {
  const path = monthPath(m.key)
  const lbl = monthLabel(m.key)
  const lblTa = monthLabel(m.key, 'ta')
  const pages = Math.max(1, Math.ceil(m.questions.length / PER_PAGE))
  const hrefFor = (p) => (p === 1 ? path : `${path}page-${p}/`)

  const daysHtml = m.days.length
    ? `<h2 class="sec">${one(`Daily current affairs — ${lbl}`, `தினசரி நடப்பு நிகழ்வுகள் — ${lblTa}`)}</h2>
<ul class="grid ca-days">${m.days
        .map(
          (d) => `<li class="tile">
<a class="t" href="${esc(dayPath(d.date))}">${one(dayLabel(d.date), dayLabel(d.date, 'ta'))}</a>
<span class="meta">${d.items.length ? `<b>${d.items.length}</b> ${one('notes', 'குறிப்புகள்')}` : ''}${
            d.questions.length ? ` <b>${d.questions.length}</b> ${one('questions', 'வினாக்கள்')}` : ''
          }</span>
</li>`,
        )
        .join('')}</ul>`
    : ''

  for (let p = 1; p <= pages; p++) {
    const thisPath = hrefFor(p)
    const suffix = pages > 1 && p > 1 ? ` — page ${p} of ${pages}` : ''
    const slice = m.questions.slice((p - 1) * PER_PAGE, p * PER_PAGE)
    const qHtml = slice.length
      ? `<section class="sec-block" id="questions">
<h2>${one(`Monthly current affairs questions — ${lbl}`, `மாதாந்திர நடப்பு நிகழ்வு வினாக்கள் — ${lblTa}`)}</h2>
<p class="sub">${both(
          `${n(m.questions.length)} questions on the month’s news, with the correct answer marked.`,
          `இந்த மாதச் செய்திகளிலிருந்து ${n(m.questions.length)} வினாக்கள், சரியான விடையுடன்.`,
        )}</p>
<ul class="minis">${slice.map((q, i) => miniQuestion(q, { num: (p - 1) * PER_PAGE + i + 1 })).join('')}</ul>
${pager(p, pages, hrefFor)}
</section>`
      : ''

    const body = `${hero({
      eyebrow: ['Monthly current affairs', 'மாதாந்திர நடப்பு நிகழ்வுகள்'],
      h1: `TNPSC Current Affairs — ${lbl}`,
      h1Ta: `TNPSC நடப்பு நிகழ்வுகள் — ${lblTa}`,
      suffix,
      lede: `${lbl} current affairs for TNPSC Group 1, 2 and 4, in Tamil and English.`,
      ledeTa: `${lblTa} — TNPSC குரூப் 1, 2, 4 தேர்வுகளுக்கான நடப்பு நிகழ்வுகள், தமிழிலும் ஆங்கிலத்திலும்.`,
      stats: [
        ...(m.days.length ? [[n(m.days.length), 'days', 'நாட்கள்']] : []),
        ...(m.questions.length ? [[n(m.questions.length), 'monthly questions', 'மாதாந்திர வினாக்கள்']] : []),
      ],
    })}
${p === 1 ? daysHtml : ''}
${qHtml}
${caPromo()}`

    writePage(
      thisPath,
      page({
        ...common,
        title: `TNPSC Current Affairs ${lbl}${suffix} — Questions & Notes | ${BRAND}`,
        description:
          `TNPSC current affairs for ${lbl} in Tamil and English` +
          (m.days.length ? ` — ${m.days.length} days of news notes` : '') +
          (m.questions.length ? `, ${n(m.questions.length)} questions with answers` : '') +
          '. Free to read.',
        path: thisPath,
        crumbs: [HOME, HUB, { name: lbl, path }, ...(p > 1 ? [{ name: `Page ${p}`, path: thisPath }] : [])],
        body,
        sidebar: [monthsBox(m.key), topicsBox()],
        sticky: STICKY,
        math: slice.some((q) => hasMath(q.question_text)),
        prev: p > 1 ? hrefFor(p - 1) : undefined,
        next: p < pages ? hrefFor(p + 1) : undefined,
      }),
      p === 1 ? (m.days[0]?.date ?? today) : null,
    )
  }
}

// ─── Topic pages ─────────────────────────────────────────────────────────────

for (const key of topicList) {
  const list = topics.get(key)
  const [e, t] = sectionLabels(key)
  const path = topicPath(key)
  const pages = Math.ceil(list.length / PER_PAGE)
  const hrefFor = (p) => (p === 1 ? path : `${path}page-${p}/`)
  for (let p = 1; p <= pages; p++) {
    const thisPath = hrefFor(p)
    const suffix = p > 1 ? ` — page ${p} of ${pages}` : ''
    const body = `${hero({
      eyebrow: ['Current affairs by topic', 'தலைப்பு வாரியாக'],
      h1: `${e} Current Affairs for TNPSC`,
      h1Ta: t ? `${t} — TNPSC நடப்பு நிகழ்வுகள்` : null,
      suffix,
      lede: `Every ${e} news note we have published, newest first, in Tamil and English.`,
      ledeTa: t ? `நாங்கள் வெளியிட்ட ${t} செய்திக் குறிப்புகள் அனைத்தும், புதியவை முதலில்.` : null,
      stats: [
        [n(list.length), 'news notes', 'செய்திக் குறிப்புகள்'],
        ...(topicQuestionCount.get(key) ? [[n(topicQuestionCount.get(key)), 'questions', 'வினாக்கள்']] : []),
      ],
    })}
<div class="ca-list">${list.slice((p - 1) * PER_PAGE, p * PER_PAGE).map((it) => itemHtml(it, { dated: true })).join('\n')}</div>
${pager(p, pages, hrefFor)}
${caPromo()}`
    writePage(
      thisPath,
      page({
        ...common,
        title: `${e} Current Affairs for TNPSC${suffix} | ${BRAND}`,
        description: `${e} current affairs for TNPSC Group 1, 2 and 4 — ${n(list.length)} news notes in Tamil and English, newest first.`,
        path: thisPath,
        crumbs: [HOME, HUB, { name: e, path }, ...(p > 1 ? [{ name: `Page ${p}`, path: thisPath }] : [])],
        body,
        sidebar: [topicsBox(key), monthsBox()],
        sticky: STICKY,
        prev: p > 1 ? hrefFor(p - 1) : undefined,
        next: p < pages ? hrefFor(p + 1) : undefined,
      }),
      p === 1 ? list[0].date : null,
    )
  }
}

// ─── Question pages ──────────────────────────────────────────────────────────

const byGroup = new Map() // the list a question sits in: its day, or its month's bank
for (const q of questions) {
  const g = q.k === 'dq' ? `d:${q.date}` : `m:${q._month}`
  ;(byGroup.get(g) ?? byGroup.set(g, []).get(g)).push(q)
}
for (const list of byGroup.values()) list.sort((a, b) => (a.external_id < b.external_id ? -1 : 1))

for (const list of byGroup.values()) {
  list.forEach((q, i) => {
    const prev = list[i - 1]
    const next = list[i + 1]
    const url = ORIGIN + q._path
    const correct = String(q.correct_answer).trim().toUpperCase()
    const answerText = plain(q[`option_${correct.toLowerCase()}`] ?? '')
    const stem = plain(q.question_text)
    const isDay = q.k === 'dq'
    const when = isDay ? dayLabel(q.date) : monthLabel(q._month)
    const whenTa = isDay ? dayLabel(q.date, 'ta') : monthLabel(q._month, 'ta')
    const listPath = isDay ? `${dayPath(q.date)}#questions` : monthPath(q._month)
    const [secEn, secTa] = q._section ? sectionLabels(q._section) : [plain(q.ca_topic || q.topic) || null, null]

    const siblings = list.filter((o) => o !== q).slice(0, 3)
    const relHtml = siblings.length
      ? `<section class="sec-block" id="more">
<h2>${one(`More current affairs questions — ${when}`, `மேலும் நடப்பு நிகழ்வு வினாக்கள் — ${whenTa}`)}</h2>
${minis(siblings)}
<p class="mini-go"><a href="${esc(listPath)}">${one(`All ${list.length} questions from ${when}`, `${whenTa} — அனைத்து ${list.length} வினாக்களும்`)} →</a></p>
</section>`
      : ''

    const details = `<section class="sec-block" id="details">
<h2>${one('About this question', 'இந்த வினா பற்றி')}</h2>
<dl class="facts">
<dt>${one(isDay ? 'News of' : 'Month', isDay ? 'செய்தி நாள்' : 'மாதம்')}</dt><dd><a href="${esc(isDay ? dayPath(q.date) : monthPath(q._month))}">${both(when, whenTa)}</a></dd>
${secEn ? `<dt>${one('Topic', 'தலைப்பு')}</dt><dd>${q._section && topics.has(q._section) ? `<a href="${esc(topicPath(q._section))}">${both(secEn, secTa)}</a>` : both(secEn, secTa)}</dd>` : ''}
<dt>${one('Set', 'தொகுப்பு')}</dt><dd>${isDay ? both('Daily current affairs test', 'தினசரி நடப்பு நிகழ்வுத் தேர்வு') : both('Monthly current affairs test', 'மாதாந்திர நடப்பு நிகழ்வுத் தேர்வு')}</dd>
</dl>
</section>`

    const faq = inlineFaq([
      {
        q: `What is the answer to "${plain(stem, 120)}"?`,
        qTa: 'இந்த வினாவின் சரியான விடை என்ன?',
        a: `The correct answer is <b>(${esc(correct)})${answerText ? ` ${esc(answerText)}` : ''}</b>.`,
        aTa: `சரியான விடை <b>(${esc(correct)})</b>.`,
      },
      {
        q: 'Which current affairs is this question from?',
        qTa: 'இந்த வினா எந்த நடப்பு நிகழ்வுகளிலிருந்து?',
        a: `From the <a href="${esc(isDay ? dayPath(q.date) : monthPath(q._month))}">${esc(when)}</a> current affairs` +
          (secEn ? `, under ${esc(secEn)}` : '') + '.',
        aTa: `<a href="${esc(isDay ? dayPath(q.date) : monthPath(q._month))}">${esc(whenTa)}</a> நடப்பு நிகழ்வுகளிலிருந்து.`,
      },
      {
        q: 'Where can I see why this answer is correct?',
        qTa: 'இந்த விடை ஏன் சரி என்று எங்கே பார்ப்பது?',
        a: `Create a free ${BRAND} account. The full explanation then shows on this question and on every other ` +
          'current affairs question, in Tamil and English, including why each wrong option is wrong.',
        aTa: `இலவச ${BRAND} கணக்கு தொடங்குங்க. அதன் பிறகு இந்த வினாவுக்கும் மற்ற எல்லா நடப்பு நிகழ்வு ` +
          'வினாக்களுக்கும் தமிழிலும் ஆங்கிலத்திலும் முழு விளக்கம் தெரியும்.',
      },
    ])

    const answerHtml = answerSection(q)
    const explanationHtml = explanationSection(q)
    const contents = toc([
      { id: 'answer', label: one('Answer', 'விடை') },
      ...(explanationHtml ? [{ id: 'explanation', label: one('Explanation', 'விளக்கம்') }] : []),
      ...(relHtml ? [{ id: 'more', label: one('More questions', 'மேலும் வினாக்கள்') }] : []),
    ])
    const nav =
      prev || next
        ? `<nav class="nextprev">
${prev ? `<a href="${esc(prev._path)}"><i>${both('← Previous question', '← முந்தைய வினா')}</i>${en(mathText(plain(prev.question_text, 90)))}</a>` : ''}
${next ? `<a href="${esc(next._path)}"><i>${both('Next question →', 'அடுத்த வினா →')}</i>${en(mathText(plain(next.question_text, 90)))}</a>` : ''}
</nav>`
        : ''

    const body = `${questionCard(q)}
${contents}
${answerHtml}
${explanationHtml}
${details}
${relHtml}
${faq.html}
${nav}
${caPromo()}`

    const stemTa = plain(q.question_text_ta ?? '')
    writePage(
      q._path,
      page({
        ...common,
        title: `${plain(stem, 95)} — ${BRAND}`,
        description:
          `${plain(stem, 130)} Ans: (${correct})${answerText ? ` ${plain(answerText, 60)}` : ''}. ` +
          `TNPSC current affairs, ${when}. ` +
          (stemTa ? `${plain(stemTa, 110)} ` : '') +
          (excerpt(q.explanation, { max: 120, whole: 0 }).text || `Full explanation free with a ${BRAND} account.`),
        path: q._path,
        crumbs: [
          HUB,
          { name: monthLabel(q._month), path: monthPath(q._month) },
          ...(isDay ? [{ name: dayLabel(q.date), path: dayPath(q.date) }] : []),
          { name: plain(stem, 60), path: q._path },
        ],
        jsonLd: [
          questionJsonLd(q, url, { level: 'TNPSC Group 1, 2 & 4', about: `Current Affairs${secEn ? ` — ${secEn}` : ''}` }),
          faq.jsonLd,
        ],
        body,
        sidebar: [
          {
            title: one('Where this is from', 'இது எங்கிருந்து'),
            items: [
              ...(isDay ? [{ href: dayPath(q.date), label: one(dayLabel(q.date), dayLabel(q.date, 'ta')) }] : []),
              { href: monthPath(q._month), label: one(monthLabel(q._month), monthLabel(q._month, 'ta')) },
              ...(q._section && topics.has(q._section)
                ? [{ href: topicPath(q._section), label: one(secEn, secTa ?? secEn) }]
                : []),
            ],
          },
          monthsBox(q._month),
        ],
        sticky: { href: '#explanation', label: 'See the explanation', labelTa: 'விளக்கம் பார்க்க' },
        math: hasMath(q.question_text, q.option_a, q.option_b, q.option_c, q.option_d),
        prev: prev?._path,
        next: next?._path,
      }),
      isDay ? q.date : `${q._month}-01`,
    )
  })
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

const totalItems = items.length
const totalQ = questions.length
const latest = dayList[0]
const hubBody = `${hero({
  eyebrow: ['Free · Tamil & English', 'இலவசம் · தமிழ் & ஆங்கிலம்'],
  h1: 'TNPSC Current Affairs — Daily, in Tamil and English',
  h1Ta: 'TNPSC நடப்பு நிகழ்வுகள் — தினமும், தமிழிலும் ஆங்கிலத்திலும்',
  lede: 'Each day’s news, cut down to what TNPSC Group 1, 2 and 4 ask — sorted by topic, with practice questions and answers.',
  ledeTa: 'TNPSC குரூப் 1, 2, 4 தேர்வுகளுக்குத் தேவையான அன்றாடச் செய்திகள் — தலைப்பு வாரியாக, பயிற்சி வினாக்கள் மற்றும் விடைகளுடன்.',
  stats: [
    [n(dayList.length), 'days', 'நாட்கள்'],
    [n(totalItems), 'news notes', 'செய்திக் குறிப்புகள்'],
    [n(totalQ), 'questions with answers', 'வினாக்கள் + விடைகள்'],
  ],
})}
${latest ? `<div class="hero-cta"><a class="btn btn-brand btn-lg" href="${esc(dayPath(latest.date))}">${one(
  `Read ${dayLabel(latest.date)}`,
  `${dayLabel(latest.date, 'ta')} — படிக்க`,
)} →</a></div>` : ''}
${dayList.length ? `<h2 class="sec">${one('Latest daily current affairs', 'சமீபத்திய தினசரி நடப்பு நிகழ்வுகள்')}</h2>
<ul class="grid ca-days">${dayList
  .slice(0, 12)
  .map(
    (d) => `<li class="tile">
<a class="t" href="${esc(dayPath(d.date))}">${one(dayLabel(d.date), dayLabel(d.date, 'ta'))}</a>
<span class="meta">${d.items.length ? `<b>${d.items.length}</b> ${one('notes', 'குறிப்புகள்')}` : ''}${
      d.questions.length ? ` <b>${d.questions.length}</b> ${one('questions', 'வினாக்கள்')}` : ''
    }</span>
</li>`,
  )
  .join('')}</ul>` : ''}
<h2 class="sec">${one('By month', 'மாத வாரியாக')}</h2>
<ul class="grid">${monthList
  .map(
    (m) => `<li class="tile">
<a class="t" href="${esc(monthPath(m.key))}">${one(monthLabel(m.key), monthLabel(m.key, 'ta'))}</a>
<span class="meta">${m.days.length ? `<b>${m.days.length}</b> ${one('days', 'நாட்கள்')}` : ''}${
      m.questions.length ? ` <b>${n(m.questions.length)}</b> ${one('questions', 'வினாக்கள்')}` : ''
    }</span>
</li>`,
  )
  .join('')}</ul>
${topicList.length ? `<h2 class="sec">${one('By topic', 'தலைப்பு வாரியாக')}</h2>
<ul class="grid">${topicList
  .map(
    (k) => `<li class="tile">
<a class="t" href="${esc(topicPath(k))}">${en(esc(sectionLabels(k)[0]))}${sectionLabels(k)[1] ? ta(esc(sectionLabels(k)[1])) : ''}</a>
<span class="meta"><b>${n(topics.get(k).length)}</b> ${one('news notes', 'செய்திக் குறிப்புகள்')}</span>
</li>`,
  )
  .join('')}</ul>` : ''}
${caPromo()}`

writePage(
  `${CA}/`,
  page({
    ...common,
    title: `TNPSC Current Affairs in Tamil & English — Daily & Monthly | ${BRAND}`,
    description:
      `Free TNPSC current affairs in Tamil and English: ${n(dayList.length)} days of news notes sorted by topic ` +
      `and ${n(totalQ)} questions with answers, for Group 1, 2 and 4.`,
    path: `${CA}/`,
    crumbs: [HOME, HUB],
    body: hubBody,
    sidebar: [recentDaysBox(), topicsBox(), monthsBox()],
    sticky: latest ? { href: dayPath(latest.date), label: 'Latest day', labelTa: 'சமீபத்திய நாள்' } : STICKY,
  }),
  latest?.date ?? today,
)

// ─── Stylesheet, sitemap, report ─────────────────────────────────────────────

const CA_CSS = `
/* ── Current affairs ── */
.ca-sec{margin:28px 0 0}
.ca-sec>h2{font-size:20px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--brand-soft)}
.ca-item{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);
  padding:16px 18px;margin:0 0 12px;box-shadow:var(--shadow-soft);scroll-margin-top:84px}
.ca-item h3{font-size:16.5px;line-height:1.4;margin:0 0 8px}
.ca-meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.ca-pts{margin:0;padding-left:20px}
.ca-pts li{margin:4px 0;line-height:1.6;font-size:15px}
.ca-pts li.d1{margin-left:18px;list-style:circle}
.ca-pts li.d2{margin-left:36px;list-style:square}
.ca-item .l-ta .ca-pts{margin-top:8px}
.ca-list{margin:18px 0 0}
.know{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;
  font-family:'Plus Jakarta Sans','Anek Tamil',sans-serif}
.know-must{background:#FDE7E7;color:#C0392B}
.know-should{background:#FDF3DC;color:#9A6B00}
.know-good{background:#E4F6EC;color:#1E7B4D}
.ca-days{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:8px 18px;margin:0;font-size:15px}
dl.facts dt{color:var(--ink2);font-weight:600}
dl.facts dd{margin:0}
`
writeFileSync(join(OUT, 'archive.css'), CSS + CA_CSS)
filesWritten++

writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `<url><loc>${esc(ORIGIN + u.path)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`,
)
filesWritten++

const report = {
  builtAt: new Date().toISOString(),
  source: SRC,
  out: OUT,
  publishedDays: { magazine: pubMagazine.size, questions: pubDailyQ.size, pages: dayList.length },
  items: totalItems,
  questions: { daily: questions.filter((q) => q.k === 'dq').length, monthly: questions.filter((q) => q.k === 'mq').length },
  months: monthList.length,
  topics: topicList.length,
  pages: filesWritten,
  sitemapUrls: sitemap.length,
  rejected,
}
mkdirSync(dirname(SRC), { recursive: true })
writeFileSync(join(dirname(SRC), 'build-report.json'), JSON.stringify(report, null, 2))

console.log(`ca-archive: ${n(dayList.length)} days, ${n(totalItems)} notes, ${n(totalQ)} questions, ` +
  `${monthList.length} months, ${topicList.length} topics → ${n(filesWritten)} files in ${OUT}`)
if (rejected.length) console.log(`  ${rejected.length} question(s) held back as unanswerable — see build-report.json`)
const remoteImgs = questions.filter((q) => (Array.isArray(q.images) && q.images.length) || (q.option_images && Object.keys(q.option_images).length))
if (remoteImgs.length) console.log(`  !! ${remoteImgs.length} question(s) carry figures served from the DB host (not crawlable)`)
