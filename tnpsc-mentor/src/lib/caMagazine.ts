import type { CaMagazineItem, CaMagazineType } from './api'
import { TOPIC_NAME_TA } from './constants'

// ─── Sections ────────────────────────────────────────────────────────────────
// Canonical magazine section order (the pipeline pushes UPPERCASE labels; see
// work/TNPSC/APP_INTEGRATION.md). TNPSC BITS always leads.
export const MAGAZINE_SECTION_ORDER = [
  'TNPSC BITS',
  'TAMIL NADU',
  'NATIONAL',
  'INTERNATIONAL',
  'ECONOMY',
  'SCIENCE AND TECHNOLOGY',
  'ENVIRONMENT',
  'REPORTS AND INDICES',
  'STATES',
  'PERSONALITIES, AWARDS, AND EVENTS',
  'SPORTS',
  'IMPORTANT DAYS',
  'MISCELLANEOUS',
]

// Uppercase magazine label → the Title-Case CA topic name (which already has a
// Tamil twin in TOPIC_NAME_TA, shared with the CA question bank).
//
// These are DISPLAY names only. The keys are what the pipeline pushes into
// ca_magazine.topic and must not change: renaming a section here re-labels it
// everywhere students see it (reader, editor, PDF, slides) while every existing
// row and every future push keeps matching.
const SECTION_EN: Record<string, string> = {
  'TNPSC BITS': 'TNPSC CABITS',
  'TAMIL NADU': 'Tamil Nadu',
  NATIONAL: 'National',
  INTERNATIONAL: 'International',
  ECONOMY: 'Economy',
  'SCIENCE AND TECHNOLOGY': 'Science and Technology',
  ENVIRONMENT: 'Environment',
  'REPORTS AND INDICES': 'Reports and Indices',
  STATES: 'States',
  'PERSONALITIES, AWARDS, AND EVENTS': 'Personalities, Awards and Events',
  SPORTS: 'Sports',
  'IMPORTANT DAYS': 'Important Days',
  MISCELLANEOUS: 'Miscellaneous',
}
const SECTION_TA_EXTRA: Record<string, string> = {
  'TNPSC BITS': 'TNPSC துளிகள்',
  STATES: 'மாநிலங்கள்',
}

/** Display label for a magazine section in the chosen language. */
export function sectionLabel(topic: string, lang: 'en' | 'ta' | 'both'): string {
  const en = SECTION_EN[topic] ?? topic
  const ta = SECTION_TA_EXTRA[topic] ?? TOPIC_NAME_TA[en]
  if (!ta) return en
  if (lang === 'ta') return ta
  if (lang === 'both') return `${en} / ${ta}`
  return en
}

// ─── Section-echo titles ─────────────────────────────────────────────────────
// The round-up row of a section (TNPSC CABITS) is pushed titled after its own
// section, so its title is redundant with the heading above it and is hidden
// everywhere it renders. The match has to accept EVERY name the section has
// gone by — the pipeline still pushes the key ('TNPSC BITS') while the app now
// shows 'TNPSC CABITS' — otherwise a rename resurrects the duplicate heading.

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')

/** Every name this section is known by: its stored key and its display labels. */
function sectionAliases(topic: string): string[] {
  const en = SECTION_EN[topic]
  return [topic, en, SECTION_TA_EXTRA[topic], en ? TOPIC_NAME_TA[en] : undefined].filter(
    (v): v is string => !!v
  )
}

/** True when an item's title merely repeats its section's name. */
export function isSectionEcho(title: string, topic: string): boolean {
  const t = norm(title)
  return sectionAliases(topic).some((alias) => norm(alias) === t)
}

/**
 * What an item's title should READ as. An echo is shown under the section's
 * current name, so a renamed section is never contradicted by stale data the
 * pipeline keeps pushing; every other title is its own.
 */
export function displayItemTitle(title: string, topic: string, lang: 'en' | 'ta' | 'both' = 'en'): string {
  return isSectionEcho(title, topic) ? sectionLabel(topic, lang) : title
}

/** Items grouped into sections, in canonical order (unknown topics last). */
export function groupBySection(items: CaMagazineItem[]): { topic: string; items: CaMagazineItem[] }[] {
  const groups = new Map<string, CaMagazineItem[]>()
  for (const item of items) {
    const list = groups.get(item.topic)
    if (list) list.push(item)
    else groups.set(item.topic, [item])
  }
  const rank = (topic: string) => {
    const i = MAGAZINE_SECTION_ORDER.indexOf(topic)
    return i === -1 ? MAGAZINE_SECTION_ORDER.length : i
  }
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([topic, list]) => ({ topic, items: list }))
}

// ─── Know levels (superadmin triage) ─────────────────────────────────────────
// A superadmin marks each item by how essential it is. Set in the issue editor;
// students see it as a badge and can filter a whole issue down to one level.
//
// The keys are what lives in ca_magazine.know_level and must not change — the
// labels below are display-only, so re-wording them never touches a row. NULL
// (unmarked) is a first-class state: the pipeline pushes items with no level,
// and an unreviewed item renders exactly as it always has.

export type KnowLevel = 'must' | 'should' | 'good'

/** Most-essential first — the order used by pickers, filters and any sorting. */
export const KNOW_LEVELS: KnowLevel[] = ['must', 'should', 'good']

export function isKnowLevel(v: unknown): v is KnowLevel {
  return v === 'must' || v === 'should' || v === 'good'
}

const KNOW_LEVEL_EN: Record<KnowLevel, string> = {
  must: 'Must Know',
  should: 'Should Know',
  good: 'Good to Know',
}
const KNOW_LEVEL_TA: Record<KnowLevel, string> = {
  must: 'கட்டாயம் அறிய வேண்டியவை',
  should: 'அறிந்திருக்க வேண்டியவை',
  good: 'அறிந்தால் நல்லது',
}

/** Display label for a level. `both` stacks EN / TA the way sectionLabel does. */
export function knowLevelLabel(level: KnowLevel, lang: 'en' | 'ta' | 'both'): string {
  if (lang === 'ta') return KNOW_LEVEL_TA[level]
  if (lang === 'both') return `${KNOW_LEVEL_EN[level]} / ${KNOW_LEVEL_TA[level]}`
  return KNOW_LEVEL_EN[level]
}

/** Short label — for the badge on a card and for chips, where the bilingual
 *  form would wrap onto three lines. Tamil-only stays Tamil; `both` shrinks to
 *  English rather than truncating a Tamil phrase mid-word. */
export function knowLevelShort(level: KnowLevel, lang: 'en' | 'ta' | 'both'): string {
  return lang === 'ta' ? KNOW_LEVEL_TA[level] : KNOW_LEVEL_EN[level]
}

/** Tailwind classes for the badge/chip, warmest for the most essential. */
export const KNOW_LEVEL_TONE: Record<KnowLevel, string> = {
  must: 'bg-coralsoft text-coral',
  should: 'bg-goldsoft text-gold',
  good: 'bg-mintsoft text-mint',
}

/**
 * Hex twins of KNOW_LEVEL_TONE, for the renderers that never see a stylesheet:
 * the magazine PDF (html2canvas snapshots inline styles) and the slide decks
 * (PptxGenJS/jsPDF want raw hex). One definition so a colour change can't drift
 * between what a student reads on screen and what they download.
 */
export const KNOW_LEVEL_HEX: Record<KnowLevel, { bg: string; fg: string }> = {
  must: { bg: '#FDE7E7', fg: '#C0392B' },
  should: { bg: '#FDF3DC', fg: '#9A6B00' },
  good: { bg: '#E4F6EC', fg: '#1E7B4D' },
}

// ─── Issue identity ──────────────────────────────────────────────────────────
// Every issue — daily or monthly — carries the same name on one line and its
// date on the next. No source/publication credit is ever shown to students.
const MAGAZINE_NAME_EN = 'Current Affair'
const MAGAZINE_NAME_TA = 'நடப்பு நிகழ்வுகள்'

/** The magazine's name in the chosen language. */
export function magazineName(lang: 'en' | 'ta' | 'both'): string {
  if (lang === 'ta') return MAGAZINE_NAME_TA
  if (lang === 'both') return `${MAGAZINE_NAME_EN} / ${MAGAZINE_NAME_TA}`
  return MAGAZINE_NAME_EN
}

// ─── Dates ───────────────────────────────────────────────────────────────────
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_TA: Record<string, string> = {
  January: 'ஜனவரி', February: 'பிப்ரவரி', March: 'மார்ச்', April: 'ஏப்ரல்',
  May: 'மே', June: 'ஜூன்', July: 'ஜூலை', August: 'ஆகஸ்ட்',
  September: 'செப்டம்பர்', October: 'அக்டோபர்', November: 'நவம்பர்', December: 'டிசம்பர்',
}

/**
 * Sort key for a CA set's `questions_key`, newest-first when sorted descending.
 * Daily keys ('2026-08-04') already sort lexicographically; month labels
 * ('July 2026') do not — 'April' would beat 'July' — so they're mapped to
 * year*12+month. Anything unrecognised sorts last.
 */
export function setKeyOrder(source: 'daily' | 'monthly' | null, key: string | null): number {
  if (!key) return -1
  if (source === 'daily') {
    const [y, m, d] = key.split('-').map(Number)
    return Number.isFinite(y) ? y * 10000 + (m ?? 0) * 100 + (d ?? 0) : -1
  }
  const [monthEn, year] = key.split(' ')
  const mi = MONTHS_EN.indexOf(monthEn)
  const y = Number(year)
  return mi >= 0 && Number.isFinite(y) ? y * 12 + mi : -1
}

/** '2026-07-09' → '9 July 2026' (day issues) / 'July 2026' (month issues). */
export function issueDateLabel(caType: CaMagazineType, date: string, lang: 'en' | 'ta' | 'both' = 'en'): string {
  const [y, mo, d] = date.split('-').map(Number)
  const monthEn = MONTHS_EN[(mo ?? 1) - 1] ?? ''
  const month = lang === 'ta' ? (MONTHS_TA[monthEn] ?? monthEn) : monthEn
  return caType === 'day_wise' ? `${d} ${month} ${y}` : `${month} ${y}`
}

// ─── Markdown bullets ────────────────────────────────────────────────────────
/** One parsed content line: nesting depth (0 = top bullet) + inline text. */
export interface MagazineLine {
  depth: number
  text: string
}

/**
 * Parse an item's `content` (markdown bullets: `- ` lines, 2-space sub-bullets,
 * `**bold**` spans handled at render time) into flat lines with depth.
 */
export function parseBullets(md: string): MagazineLine[] {
  const lines: MagazineLine[] = []
  for (const raw of (md ?? '').split('\n')) {
    if (!raw.trim()) continue
    const m = raw.match(/^(\s*)-\s+(.*)$/)
    if (m) lines.push({ depth: Math.min(2, Math.floor(m[1].length / 2)), text: m[2] })
    else lines.push({ depth: 0, text: raw.trim() })
  }
  return lines
}
