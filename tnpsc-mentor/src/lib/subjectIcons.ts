// ─── Subject / topic / question-type icon resolver ──────────────────────────
// Maps a canonical bank string (subject, topic, aptitude topic, question type,
// PYQ group…) to a PNG illustration served from /public/subject-icons. The art
// lives in `public/subject-icons/<slug>.png`; this module is the single source
// of truth for turning a name into that URL.
//
// The bank stores names with spellings that don't always match the artwork
// filenames (e.g. "Ratio And Proportion" vs the file "ratio-and-propotion", or
// "Development Administration of TamilNadu" vs "development-administration-of-tn").
// We reconcile that in three passes: an explicit ALIAS table for the odd ones, a
// normalised exact match for the rest, then a loose keyword fallback so an
// unmapped-but-recognisable subject still gets a sensible icon. Anything truly
// unknown returns null and the caller falls back to its Lucide glyph.

const BASE = '/subject-icons'

// Every slug that has artwork on disk (see public/subject-icons). Keep in sync
// with the files; a slug not in this set is never returned.
const ICON_SLUGS = [
  // ── Samacheer standards ──
  '6th', '7th', '8th', '9th', '10th',
  // ── Aptitude ──
  'ap-gp', 'alphabet-series', 'analogy', 'aptitude', 'area-and-volume-2d3d-shapes',
  'average-mean-media-mode', 'clock', 'coding-decoding', 'date', 'direction-based',
  'lcm-hcf', 'mathematical-operators', 'number-of-figures', 'number-series',
  'numerics', 'percentage', 'probability', 'profit-and-loss', 'puzzles',
  'ratio-and-propotion', 'reasoning', 'seating-arrangements', 'simple-compoun-interest',
  'simplification', 'surds-and-indices', 'time-work-speed-distance',
  // Area & Volume drill-down: sections, then shapes (Frustum has no art yet)
  '2d-area', '3d-volumeandsurface-area', 'perimeter-circumference-diameter',
  'circle', 'square', 'rectangle', 'triangle', 'parallelogram', 'rhombus',
  'trapezium', 'quadrilateral', 'cube', 'cuboid', 'sphere', 'hemisphere',
  'cylinder', 'cone', 'combined-solids',
  // ── Question types ──
  'assertion-and-reason', 'chronological', 'direct', 'match-the-following',
  'mixed', 'statements',
  // ── Subjects ──
  'biology', 'chemistry', 'current-affairs', 'development-administration-of-tn',
  'economy', 'english', 'general-english', 'general-science', 'general-studies',
  'general-tamil', 'geography', 'history', 'history-and-inm',
  'history-culture-heritage-of-tn', 'indian-economy', 'indian-national-movement',
  'physics', 'polity', 'tamil',
  // ── Syllabus topics ──
  'automic-structure', 'fundamental-rights', 'genetics', 'geography-of-india',
  'government-schemes', 'indus-valley-civillization', 'photosynthesis',
  'reserve-bank-of-india',
  // ── PYQ ──
  'pyq-group-1', 'pyq-group-2', 'pyq-group-4', 'year-filter-group-2',
  'year-filter-group-4', 'authorandwork', 'comprehension', 'grammar', 'literature',
  'vocabulary',
  // ── Current-affairs themes ──
  'appointments', 'awards-and-honours', 'defence', 'environment',
  'international-affairs', 'sports',
  // ── Section / hub tiles ──
  'ca-questions', 'current-affairs-hub', 'insights', 'materials', 'mock-test',
  'revision', 'samacheer', 'thirukkural', 'vettri',
] as const

/** Strip everything but a–z0–9 so "Profit And Loss" and "profit-and-loss" collide.
 *  `&` becomes "and" first, matching how the artwork filenames were slugified —
 *  otherwise "Author & Work" would never meet `authorandwork`. */
const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

// normalised(slug) → slug, for the exact-match pass.
const NORM_TO_SLUG = new Map(ICON_SLUGS.map((s) => [norm(s), s]))

// Explicit overrides, keyed by norm(canonical bank string) → slug. These are the
// pairs the normalised match can't bridge (spelling drift, abbreviations, or one
// artwork standing in for several closely-related bank labels).
const ALIASES: Record<string, string> = {
  // ── Subjects ──
  [norm('Development Administration of TamilNadu')]: 'development-administration-of-tn',
  [norm('Development Administration in Tamil Nadu')]: 'development-administration-of-tn',
  [norm('Development Administration')]: 'development-administration-of-tn',
  [norm('Tamil Nadu Administration')]: 'development-administration-of-tn',
  [norm('History, Culture & Heritage of TN')]: 'history-culture-heritage-of-tn',
  [norm('History, Culture, Heritage')]: 'history-culture-heritage-of-tn',
  [norm('Culture')]: 'history-culture-heritage-of-tn',
  // ── Aptitude · numerics ──
  [norm('Ratio And Proportion')]: 'ratio-and-propotion',
  [norm('LCM and HCF')]: 'lcm-hcf',
  [norm('Area and Volume')]: 'area-and-volume-2d3d-shapes',
  [norm('Simple Interest')]: 'simple-compoun-interest',
  [norm('Compound Interest')]: 'simple-compoun-interest',
  [norm('Simple and Compound Interest')]: 'simple-compoun-interest',
  [norm('Simple Interest & Compound Interest')]: 'simple-compoun-interest',
  [norm('Time and Work')]: 'time-work-speed-distance',
  [norm('Time, Work , Speed And Distance')]: 'time-work-speed-distance',
  [norm('AP, GP and Special Series')]: 'ap-gp',
  [norm('Average, Mean Median Mode')]: 'average-mean-media-mode',
  [norm('Surds')]: 'surds-and-indices',
  // Legacy "&" spellings from the older aptitude topic lists.
  [norm('LCM & HCF')]: 'lcm-hcf',
  [norm('A.P & G.P')]: 'ap-gp',
  // ── Aptitude · reasoning ──
  [norm('No Of Figures')]: 'number-of-figures',
  [norm('No of Figures')]: 'number-of-figures',
  [norm('Seating Arrangement')]: 'seating-arrangements',
  [norm('Clock Problems')]: 'clock',
  [norm('Date Problems')]: 'date',
  [norm('Logical Number Series')]: 'number-series',
  [norm('Logical Alphabet Series')]: 'alphabet-series',
  // The dice artwork doubles for the dice-based reasoning topic.
  [norm('Dice Problems')]: 'probability',
  [norm('Dice')]: 'probability',
  // ── Area & Volume drill-down sections ──
  [norm('Perimeter, Circumference & Diameter')]: 'perimeter-circumference-diameter',
  [norm('2D - Area')]: '2d-area',
  [norm('3D - Volume & Surface Area')]: '3d-volumeandsurface-area',
  // ── Syllabus topics whose bank string differs from the artwork filename ──
  [norm('Indus Valley Civilization (2500 - 1800 BC)')]: 'indus-valley-civillization',
  [norm('Atomic Structure')]: 'automic-structure',
  [norm('Welfare-oriented Government Schemes')]: 'government-schemes',
  [norm('Environment and Ecology')]: 'environment',
  // ── Samacheer standards (rendered as "6TH" … "10TH") ──
  [norm('6TH')]: '6th',
  [norm('7TH')]: '7th',
  [norm('8TH')]: '8th',
  [norm('9TH')]: '9th',
  [norm('10TH')]: '10th',
  // ── Question types (Subject Practice) — matched by the SubjectQType key ──
  // Keys MUST be normalised (norm strips the underscore in `assertion_reason`).
  [norm('match')]: 'match-the-following',
  [norm('assertion_reason')]: 'assertion-and-reason',
  [norm('chronological')]: 'chronological',
  [norm('statements')]: 'statements',
  [norm('direct')]: 'direct',
  [norm('mixed')]: 'mixed',
}

// Loose keyword fallback for names none of the above resolve — mirrors the old
// per-page `subjectIcon()` so a bank subject with a slightly different spelling
// still lands on the right art. Order matters (first hit wins).
const KEYWORDS: [test: (n: string) => boolean, slug: string][] = [
  [(n) => n.includes('physics'), 'physics'],
  [(n) => n.includes('chemistry'), 'chemistry'],
  [(n) => n.includes('biology'), 'biology'],
  [(n) => n.includes('generalscience') || n.includes('science'), 'general-science'],
  [(n) => n.includes('geograph'), 'geography'],
  [(n) => n.includes('nationalmovement') || n.includes('inm') || n.includes('freedom'), 'indian-national-movement'],
  [(n) => n.includes('cultur') || n.includes('heritage'), 'history-culture-heritage-of-tn'],
  [(n) => n.includes('history'), 'history'],
  [(n) => n.includes('polity') || n.includes('constitution'), 'polity'],
  [(n) => n.includes('administration'), 'development-administration-of-tn'],
  [(n) => n.includes('econom'), 'economy'],
  [(n) => n.includes('currentaffairs'), 'current-affairs'],
  [(n) => n.includes('aptitude'), 'aptitude'],
  [(n) => n.includes('tamil'), 'tamil'],
  [(n) => n.includes('english'), 'english'],
]

/** Absolute URL for a subject-icon slug (no existence check). */
export const iconUrl = (slug: string) => `${BASE}/${slug}.png`

/**
 * Resolve a bank string to an icon URL, or null when nothing sensible matches.
 * `name` may be a subject, topic, aptitude topic, question-type key, or any label.
 */
export function iconFor(name: string | null | undefined): string | null {
  if (!name) return null
  const key = norm(name)
  if (!key) return null
  const slug = ALIASES[key] ?? NORM_TO_SLUG.get(key) ?? KEYWORDS.find(([test]) => test(key))?.[1]
  return slug ? iconUrl(slug) : null
}

/** True when `name` has a real (non-fallback) icon on disk. */
export function hasIcon(name: string | null | undefined): boolean {
  if (!name) return false
  const key = norm(name)
  return Boolean(ALIASES[key] ?? NORM_TO_SLUG.get(key))
}
