import type { GroupType, MockBlueprint } from '../types'

// ─── Groups for Previous Year Question Papers ───────────────────────────────

export interface GroupDef {
  id: GroupType
  label: string
}

export const GROUPS: GroupDef[] = [
  { id: 'Group1', label: 'GROUP 1' },
  { id: 'Group2_2A', label: 'GROUP 2/2A' },
  { id: 'Group4_VAO', label: 'GROUP 4 & VAO' },
]

// General-Studies subjects (the full TNPSC GS syllabus, shared by all groups).
// Questions are tagged by subject; a question shows under any group whose
// syllabus includes its subject (subject-membership, not a stored group_type).
export const SUBJECTS: string[] = [
  'History and INM',
  'Polity',
  'Geography',
  'History Culture Heritage of TN',
  'Development Administration of TamilNadu',
  'General Science',
  'Biology',
  'Physics',
  'Chemistry',
  'Indian Economy',
  'Current Affairs',
  'Aptitude',
]

// Language papers (qualifying papers for Group 2/2A and Group 4 & VAO).
export const LANGUAGE_SUBJECTS: string[] = ['General Tamil', 'General English']

// Subjects that have actual PYQ data loaded (category='pyq'). No group step needed.
export const PYQ_SUBJECTS: string[] = [
  'History and INM',
  'Polity',
  'Geography',
  'History Culture Heritage of TN',
  'Development Administration of TamilNadu',
  'Biology',
  'Physics',
  'Chemistry',
  'Indian Economy',
]

// Per-group subject availability. Group 1 = full GS; Group 2/4 add the
// General Tamil / General English qualifying papers.
export const GROUP_SUBJECTS: Record<GroupType, string[]> = {
  Group1: [...SUBJECTS],
  Group2_2A: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
  Group4_VAO: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
}

// ─── Outer question bank (subject-wise, Type=outer) ─────────────────────────
// `subject` labels exactly as stored in the DB for category='outer' rows. Drive
// the per-subject chips on the admin Outer-questions view.
export const OUTER_SUBJECTS: string[] = [
  'History',
  'Indian National Movement',
  'Polity',
  'Geography',
  'Economy',
  'History, Culture, Heritage',
  'Tamil Nadu Administration',
  'Botany',
  'Zoology',
  'Physics',
  'Chemistry',
  'Current Affairs',
  'English',
  'தமிழ்',
]

// ─── Subject Practice syllabus order ────────────────────────────────────────
// The Subject Practice picker (category='subject') shows subjects then topics.
// By default the API returns them alphabetically; these structures re-order them
// to follow the official TNPSC syllabus split-up (Unit I → VI) instead. Strings
// must match the DB `subject` / `topic` values exactly. Anything not listed here
// falls to the end alphabetically, so unmapped topics are never hidden.

// Subjects in syllabus sequence: Gen. Science (Phy/Chem/Bio) → Geography →
// History → INM → Polity → Economy → TN Admin → TN History & Culture.
export const SUBJECT_PRACTICE_ORDER: string[] = [
  'Physics',
  'Chemistry',
  'Biology',
  'Geography',
  'History',
  'Indian National Movement',
  'Polity',
  'Economy',
  'Tamil Nadu Administration',
  'History, Culture & Heritage of TN',
]

// Per-subject topic order, following each unit's syllabus listing (History &
// INM are chronological; others follow the PDF's sub-point sequence).
export const SUBJECT_TOPIC_ORDER: Record<string, string[]> = {
  Physics: [
    'Nature of Universe',
    'General Scientific Laws',
    'Mechanics and Properties of Matter',
    'Force, Motion and Energy',
    'Everyday application of the basic principles of Mechanics',
    'Electricity and Magnetism',
    'Light, Sound and Heat',
    'Nuclear Physics and Laser',
    'Electronics and Communications',
  ],
  Chemistry: [
    'Elements and Compounds',
    'Acids, Base and Salts',
    'Petroleum Products',
    'Fertilizers and Pesticides',
  ],
  Biology: [
    'Main Concepts of Life Science',
    'Classification of Living Organism',
    'Evolution',
    'Genetics',
    'Physiology',
    'Nutrition',
    'Health and Hygiene',
    'Human Diseases',
    'Environment and Ecology',
  ],
  Geography: [
    'Location',
    'Physical Features',
    'Monsoon, Rainfall, Weather and Climate',
    'Water Resources',
    'Rivers in India',
    'Soil, Minerals and Natural Resources',
    'Forest and Wildlife',
    'Agricultural Pattern',
    'Transport and Communication',
    'Population Density and Distribution',
    'Social Geography',
    'Natural Calamity',
    'Other Topics',
  ],
  History: [
    'The Pre-Historic Period',
    'Indus Valley Civilization (2500 - 1800 BC)',
    'The Vedic Period- the Aryans',
    'Growth of Jainism and Buddhism',
    'The Mauryan Empire (321 - 289 BC)',
    'Post - Mauryan Period',
    'The Gupta Dynasty (AD 320 - 550)',
    'The Vardhanas (AD 550 - 647)',
    'The Southern Dynasties',
    'The Coming of Islam',
    'Regional Powers during Mughal Period',
    'The Mughal Dynasty (1526 - 1540 and 1555 - 1857)',
    'The Coming of The Europeans',
    'British East India Company And The British Rule',
    'Social And Religious Movements In The Nineteenth Century',
    'Viceroys of India',
    'Indian Freedom Struggle',
    'Other Topics',
  ],
  'Indian National Movement': [
    'Revolution of 1857',
    'Political Institution Established before Congress',
    'Indian National Congress',
    'Social and Religious Movement',
    'Development of Press in Modern India',
    'Gandhi & Early Movements',
    'Revolutionary Movement in India',
    'Quit India Movement',
    'Evolution of Indian Constitution',
    'Partition of India and Independence',
  ],
  Polity: [
    'Constitution of India',
    'Preamble to the Constitution',
    'Union, State and Union Territory',
    'Citizenship',
    'Fundamental Rights',
    'Directive Principles of State Policy',
    'Union Legislature',
    'Union Executive',
    'State Legislature',
    'State Executive',
    'Local Governments',
    'Election',
    'Judiciary in India',
    'Rule of Law',
    'Human rights charter',
    'Other Topics',
  ],
  Economy: [
    'Nature of Indian Economy',
    'Five Year Plan Models-An Assessment',
    'Planning Commission and Niti Ayog',
    'Sources of revenue',
    'Reserve Bank of India',
    'Fiscal Policy and Monetary Policy',
    'Finance Commission',
    'Structure of Indian Economy and Employment Generation',
    'Land reforms and Agriculture',
    'Industrial growth',
    'Rural welfare oriented programmes',
    'Social problems',
    'Budget',
    'Public Finance',
    'Economic Reforms',
    'Economic Committees',
    'Government Schemes',
    'Other Topics',
  ],
  'Tamil Nadu Administration': [
    'Human Development Indicators',
    'Political Parties & Welfare Schemes',
    'Social Justice & Harmony',
    'Education & Health Systems',
    'Geography of TN & its Impact on Economic Growth',
    'e-Governance in TN',
  ],
  'History, Culture & Heritage of TN': [
    'Pre Historic Tamilagam & Archaeological',
    'History of Tamil society',
    'Tamil Literature Sangam Age to Contemporary Times',
    'Thirukkural',
    'Role of Tamilnadu in freedom struggle',
    'Socio Political movements in Tamil Nadu',
  ],
}

// Optional sub-grouping for the topic step. Subjects listed here render their
// topics under labelled sub-headings (the syllabus splits Geography into Physical
// and Human Geography); subjects not listed stay a flat syllabus-ordered list.
export interface TopicGroup {
  heading: string
  topics: string[]
}

export const SUBJECT_TOPIC_GROUPS: Record<string, TopicGroup[]> = {
  Economy: [
    {
      heading: 'Core Economics',
      topics: [
        'Nature of Indian Economy',
        'Five Year Plan Models-An Assessment',
        'Planning Commission and Niti Ayog',
        'Sources of revenue',
        'Reserve Bank of India',
        'Fiscal Policy and Monetary Policy',
        'Finance Commission',
        'Budget',
        'Public Finance',
        'Economic Reforms',
        'Economic Committees',
      ],
    },
    {
      heading: 'Economic Development',
      topics: [
        'Structure of Indian Economy and Employment Generation',
        'Land reforms and Agriculture',
        'Industrial growth',
        'Rural welfare oriented programmes',
        'Social problems',
        'Government Schemes',
      ],
    },
  ],
  Geography: [
    {
      heading: 'Physical Geography',
      topics: [
        'Location',
        'Physical Features',
        'Monsoon, Rainfall, Weather and Climate',
        'Water Resources',
        'Rivers in India',
        'Soil, Minerals and Natural Resources',
        'Forest and Wildlife',
        'Agricultural Pattern',
      ],
    },
    {
      heading: 'Human Geography',
      topics: [
        'Transport and Communication',
        'Social Geography',
        'Population Density and Distribution',
        'Natural Calamity',
        'Other Topics',
      ],
    },
  ],
}

// Split `topics` into the configured sub-groups (preserving the incoming order
// within each group). Topics not in any group are collected under a trailing
// "More" heading so nothing is ever dropped. Returns a single null-headed group
// when `groups` is undefined (the flat, ungrouped case).
export function groupTopics(
  topics: string[],
  groups: TopicGroup[] | undefined
): { heading: string | null; topics: string[] }[] {
  if (!groups || groups.length === 0) return [{ heading: null, topics }]
  const present = new Set(topics)
  const used = new Set<string>()
  const out: { heading: string | null; topics: string[] }[] = []
  for (const g of groups) {
    const ts = g.topics.filter((t) => present.has(t))
    ts.forEach((t) => used.add(t))
    if (ts.length) out.push({ heading: g.heading, topics: ts })
  }
  const leftover = topics.filter((t) => !used.has(t))
  if (leftover.length) out.push({ heading: 'More', topics: leftover })
  return out
}

// Sort `items` by their position in `order`; entries not in `order` sink to the
// end and are sorted alphabetically among themselves. Pure (returns a new array).
export function bySyllabusOrder(items: string[], order: string[] | undefined): string[] {
  if (!order || order.length === 0) return [...items].sort((a, b) => a.localeCompare(b))
  const rank = new Map(order.map((s, i) => [s, i]))
  return [...items].sort((a, b) => {
    const ra = rank.has(a) ? (rank.get(a) as number) : Number.MAX_SAFE_INTEGER
    const rb = rank.has(b) ? (rank.get(b) as number) : Number.MAX_SAFE_INTEGER
    return ra !== rb ? ra - rb : a.localeCompare(b)
  })
}

// ─── Samacheer standards ────────────────────────────────────────────────────

export const STANDARDS = [6, 7, 8, 9, 10]
export const standardLabel = (n: number) => `${n}TH`

// ─── Aptitude ───────────────────────────────────────────────────────────────

export const NUMERICS_TOPICS: string[] = [
  'Simplification',
  'Profit and Loss',
  'Percentage',
  'Ratio and Proportion',
  'LCM & HCF',
  'Area and Volume',
  'Simple Interest & Compound Interest',
  'Time and Work',
  'A.P & G.P',
  'Square Root & Cube Root',
  'Surds',
  'Logs and Exponents',
]

export const REASONING_TOPICS: string[] = [
  'Logical Number Series',
  'Logical Alphabet Series',
  'Alpha-Numeric Reasoning',
  'Analogy',
  'Dice',
  'Puzzles',
  'No of Figures',
  'Mathematical Operators',
]

// ─── Current Affairs ────────────────────────────────────────────────────────

export interface MonthDef {
  slug: string
  label: string
  year: number
}

export const CA_MONTHS: MonthDef[] = [
  { slug: 'july-2025', label: 'July 2025', year: 2025 },
  { slug: 'august-2025', label: 'August 2025', year: 2025 },
  { slug: 'september-2025', label: 'September 2025', year: 2025 },
  { slug: 'october-2025', label: 'October 2025', year: 2025 },
  { slug: 'november-2025', label: 'November 2025', year: 2025 },
  { slug: 'december-2025', label: 'December 2025', year: 2025 },
  { slug: 'january-2026', label: 'January 2026', year: 2026 },
  { slug: 'february-2026', label: 'February 2026', year: 2026 },
  { slug: 'march-2026', label: 'March 2026', year: 2026 },
  { slug: 'april-2026', label: 'April 2026', year: 2026 },
  { slug: 'may-2026', label: 'May 2026', year: 2026 },
  { slug: 'june-2026', label: 'June 2026', year: 2026 },
]

// Default topic categories shown when the DB has no curated topics yet.
export const CA_TOPIC_CATEGORIES: string[] = [
  'Science & Technology',
  'Sports',
  'Economy & Finance',
  'Government Schemes',
  'International Affairs',
  'Awards & Honours',
  'Appointments',
  'Environment',
  'Defence',
  'Tamil Nadu',
]

// Human-friendly label for a group id.
export function groupLabel(id?: string): string {
  return GROUPS.find((g) => g.id === id)?.label ?? id ?? ''
}

// ─── Mock-test blueprints (TNPSC 2024 / 2025 group patterns) ─────────────────
// Subject-wise question distribution per group exam. The `slots` counts here
// MUST match the GROUP_SLOTS table in server/src/routes/questions.ts — the UI
// renders these for the pre-test breakdown; the server pulls the real questions.

export const MOCK_BLUEPRINTS: MockBlueprint[] = [
  {
    id: 'Group1',
    title: 'Group 1 Prelims',
    totalQuestions: 100,
    durationMinutes: 90,
    negativeMark: 0,
    slots: [
      { label: 'History & INM', count: 15 },
      { label: 'Polity', count: 12 },
      { label: 'Geography', count: 12 },
      { label: 'General Science', count: 15 },
      { label: 'Economy', count: 10 },
      { label: 'TN History & Culture', count: 10 },
      { label: 'TN Administration', count: 6 },
      { label: 'Current Affairs', count: 10 },
      { label: 'Aptitude', count: 10 },
    ],
  },
]

export function mockBlueprint(id?: string): MockBlueprint | undefined {
  return MOCK_BLUEPRINTS.find((b) => b.id === id)
}
