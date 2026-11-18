// Magazine section names, echo detection and bullet parsing for the public CA
// archive. A plain-JS twin of the same functions in src/lib/caMagazine.ts (that
// file imports the app's constants and cannot load outside Vite).
// src/__tests__/caArchiveSections.test.ts asserts the two agree — change both.

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

/** Stored key → [English, Tamil] display label. Keys are what the pipeline pushes. */
export const SECTIONS = {
  'TNPSC BITS': ['TNPSC CABITS', 'TNPSC துளிகள்'],
  'TAMIL NADU': ['Tamil Nadu', 'தமிழ்நாடு'],
  NATIONAL: ['National', 'தேசியம்'],
  INTERNATIONAL: ['International', 'சர்வதேசம்'],
  ECONOMY: ['Economy', 'பொருளாதாரம்'],
  'SCIENCE AND TECHNOLOGY': ['Science and Technology', 'அறிவியல் மற்றும் தொழில்நுட்பம்'],
  ENVIRONMENT: ['Environment', 'சுற்றுச்சூழல்'],
  'REPORTS AND INDICES': ['Reports and Indices', 'அறிக்கைகள் மற்றும் குறியீடுகள்'],
  STATES: ['States', 'மாநிலங்கள்'],
  'PERSONALITIES, AWARDS, AND EVENTS': ['Personalities, Awards and Events', 'பிரபலங்கள், விருதுகள் மற்றும் நிகழ்வுகள்'],
  SPORTS: ['Sports', 'விளையாட்டு'],
  'IMPORTANT DAYS': ['Important Days', 'முக்கிய நாட்கள்'],
  MISCELLANEOUS: ['Miscellaneous', 'இதர'],
}

/** [en, ta] for a stored key; an unknown key shows as itself. */
export function sectionLabels(topic) {
  return SECTIONS[topic] ?? [topic, null]
}

/**
 * The magazine key for a question's Title-Case topic ('Tamil Nadu' → 'TAMIL NADU'),
 * so a question links to the same topic page as the news items. null if unknown.
 */
export function sectionKeyForTopic(name) {
  const t = norm(name ?? '')
  for (const [key, [en]] of Object.entries(SECTIONS)) if (norm(en) === t || key === t) return key
  return null
}

const norm = (s) => String(s).trim().toUpperCase().replace(/\s+/g, ' ')

/** True when an item's title merely repeats its section's name (any alias). */
export function isSectionEcho(title, topic) {
  const t = norm(title ?? '')
  return [topic, ...(SECTIONS[topic] ?? [])].filter(Boolean).some((a) => norm(a) === t)
}

/** Canonical section rank; unknown sections sort last. */
export function sectionRank(topic) {
  const i = MAGAZINE_SECTION_ORDER.indexOf(topic)
  return i === -1 ? MAGAZINE_SECTION_ORDER.length : i
}

/** Markdown bullets → [{depth, text}], same rules as caMagazine.ts parseBullets. */
export function parseBullets(md) {
  const lines = []
  for (const raw of String(md ?? '').split('\n')) {
    if (!raw.trim()) continue
    const m = raw.match(/^(\s*)-\s+(.*)$/)
    if (m) lines.push({ depth: Math.min(2, Math.floor(m[1].length / 2)), text: m[2] })
    else lines.push({ depth: 0, text: raw.trim() })
  }
  return lines
}

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_TA = [
  'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
  'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்',
]
