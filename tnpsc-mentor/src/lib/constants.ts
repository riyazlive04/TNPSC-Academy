import type { GroupType } from '../types'

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

// Per-group subject availability. Group 1 = full GS; Group 2/4 add the
// General Tamil / General English qualifying papers.
export const GROUP_SUBJECTS: Record<GroupType, string[]> = {
  Group1: [...SUBJECTS],
  Group2_2A: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
  Group4_VAO: [...SUBJECTS, ...LANGUAGE_SUBJECTS],
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
