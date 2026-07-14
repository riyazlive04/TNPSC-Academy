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
const SECTION_EN: Record<string, string> = {
  'TNPSC BITS': 'TNPSC Bits',
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
