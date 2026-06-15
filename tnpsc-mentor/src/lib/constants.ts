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
    id: 'Group4_VAO',
    title: 'Group 4 & VAO',
    totalQuestions: 100,
    durationMinutes: 90,
    negativeMark: 0,
    slots: [
      { label: 'General Tamil', count: 20 },
      { label: 'History & INM', count: 15 },
      { label: 'Geography', count: 10 },
      { label: 'Polity', count: 10 },
      { label: 'General Science', count: 20 },
      { label: 'Economy', count: 10 },
      { label: 'Current Affairs', count: 10 },
      { label: 'Aptitude', count: 5 },
    ],
  },
  {
    id: 'Group2_2A',
    title: 'Group 2 / 2A',
    totalQuestions: 100,
    durationMinutes: 90,
    negativeMark: 0,
    slots: [
      { label: 'History & INM', count: 10 },
      { label: 'Polity', count: 8 },
      { label: 'Geography', count: 8 },
      { label: 'General Science', count: 10 },
      { label: 'Economy', count: 4 },
      { label: 'TN History & Culture', count: 10 },
      { label: 'TN Administration', count: 5 },
      { label: 'General Tamil', count: 15 },
      { label: 'Current Affairs', count: 15 },
      { label: 'Aptitude', count: 15 },
    ],
  },
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
