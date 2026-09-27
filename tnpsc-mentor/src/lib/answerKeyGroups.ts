/**
 * The TNPSC answer-key hub pages: one per exam group (Group 1, Group 2 / 2A,
 * Group 4), each with its own exam timing, release links and search copy.
 *
 * No imports on purpose: lib/shareMeta (which vite.config.ts loads) builds
 * each page's static <title> and JSON-LD from this file.
 *
 * TO PUBLISH after an exam: set a resource's `href` below, bump that group's
 * `updated` date, redeploy. Until a resource has an href the page shows it as
 * "being prepared". Host PDFs under public/downloads/<group>-2026/ (not under
 * a group's answer-key path, which is a route).
 *
 * Group 2 and Group 4 start with no exam date and no resources — TNPSC has
 * not yet notified either 2026 exam. Fill in `examStart`/`examEnd` and the
 * resource/subject hrefs once the notification and papers are out.
 */

export type AnswerKeyGroupKey = 'group1' | 'group2' | 'group4'

export const ANSWER_KEY_ORIGIN = 'https://tnpscmentors.in'

export type ResourceKey = 'paper' | 'key' | 'explanations'

export interface AnswerKeyResource {
  key: ResourceKey
  /** 'pdf' downloads; 'page' opens (a web page or in-app route). */
  kind: 'pdf' | 'page'
  /** The English (or bilingual) edition. */
  href: string | null
  /** The Tamil-explanations edition; when set, the page asks which language
   *  the visitor wants before downloading. */
  hrefTa?: string | null
  /** Overrides the row's default name when the file is more specific than it. */
  label?: { en: string; ta: string }
}

export interface AnswerKeySubject {
  en: string
  ta: string
  /** The English (or only) edition. */
  href: string | null
  /** The Tamil-explanations edition; set = the page asks which language. */
  hrefTa?: string | null
  /** How many of the paper's questions fall under this subject. */
  questions?: number
}

const g1Subject = (en: string, ta: string, slug: string, questions: number): AnswerKeySubject => ({
  en,
  ta,
  href: `/downloads/group1-2026/tnpsc-group-1-2026-${slug}-answer-key.pdf`,
  hrefTa: `/downloads/group1-2026/tnpsc-group-1-2026-${slug}-answer-key-tamil.pdf`,
  questions,
})

export interface AnswerKeyGroupDef {
  key: AnswerKeyGroupKey
  /** The canonical, keyword-first route this group's page is served at. */
  path: string
  /** Extra routes (short links) that render the same page. */
  shortPaths: string[]
  /** How the group is named in copy, e.g. "Group 1", "Group 2 / 2A". */
  examLabel: string
  /** The exam's full bilingual name, e.g. "TNPSC Group 1 — Combined Civil
   *  Services Examination I (Prelims)". */
  examFullName: { en: string; ta: string }

  // CONFIRM against the hall ticket: the phase banner and the switch to the
  // download state run off these two instants. null = not yet notified.
  examStart: string | null
  examEnd: string | null
  totalQuestions: number | null
  totalMarks: number | null
  /** null when TNPSC has not notified the marking scheme for this exam yet. */
  negativeMarking: boolean | null

  published: string
  /** Becomes the JSON-LD dateModified — bump it with every link you fill in. */
  updated: string

  resources: AnswerKeyResource[]
  subjects: AnswerKeySubject[]

  /** The pre-exam status-banner image, under public/; null shows a plain
   *  "exam coming soon" placeholder box instead. */
  bannerImage: string | null

  /** The in-app page this group's test series lives on, for the sidebar CTA
   *  and the JSON-LD breadcrumb; null while the group has no such page yet. */
  seriesLink: { href: string; label: { en: string; ta: string } } | null

  // ─── Search copy — English on purpose in both UI languages: these are the
  // phrases people type. ────────────────────────────────────────────────────
  /** Open Graph / WhatsApp preview title and the Article headline. */
  title: string
  /** The document <title> — keyword first, under ~70 characters. */
  docTitle: string
  description: string
}

export const ANSWER_KEY_GROUPS: Record<AnswerKeyGroupKey, AnswerKeyGroupDef> = {
  group1: {
    key: 'group1',
    path: '/tnpsc-group-1-answer-key-2026',
    shortPaths: ['/group-1-answer-key', '/answer-key'],
    examLabel: 'Group 1',
    examFullName: {
      en: 'TNPSC Group 1 — Combined Civil Services Examination I (Prelims)',
      ta: 'TNPSC குரூப் 1 — Combined Civil Services Examination I (முதல்நிலை)',
    },
    examStart: '2026-09-27T09:30:00+05:30',
    examEnd: '2026-09-27T12:30:00+05:30',
    totalQuestions: 200,
    totalMarks: 300,
    negativeMarking: false,
    published: '2026-09-23',
    updated: '2026-09-27',
    // No separate 'explanations' row: the detailed key carries them, per question.
    resources: [
      {
        key: 'paper',
        kind: 'pdf',
        href: '/downloads/group1-2026/tnpsc-group-1-question-paper-2026-with-answers.pdf',
        label: {
          en: 'Question Paper 2026 with Answers Marked (Tamil + English)',
          ta: 'வினாத்தாள் 2026 — சரியான விடைகள் குறிக்கப்பட்டது (தமிழ் + English)',
        },
      },
      {
        key: 'key',
        kind: 'pdf',
        href: '/downloads/group1-2026/tnpsc-group-1-answer-key-2026.pdf',
        hrefTa: '/downloads/group1-2026/tnpsc-group-1-answer-key-2026-tamil.pdf',
        label: {
          en: 'Answer Key 2026 with Detailed Explanations (Tamil / English)',
          ta: 'விரிவான விளக்கங்களுடன் விடைக்குறிப்பு 2026 (தமிழ் / English)',
        },
      },
    ],
    // Syllabus unit order; question counts add up to the paper's 200.
    subjects: [
      g1Subject('General Science', 'பொது அறிவியல்', 'general-science', 13),
      g1Subject('Geography of India', 'இந்தியப் புவியியல்', 'geography', 11),
      g1Subject('Indian History & National Movement', 'இந்திய வரலாறு & தேசிய இயக்கம்', 'indian-history', 26),
      g1Subject('Indian Polity', 'இந்திய அரசியலமைப்பு', 'indian-polity', 44),
      g1Subject('Indian Economy & Development Administration in TN', 'இந்தியப் பொருளாதாரம் & தமிழக வளர்ச்சி நிர்வாகம்', 'economy', 36),
      g1Subject('Tamil Nadu History, Culture & Socio-Political Movements', 'தமிழ்நாட்டின் வரலாறு, பண்பாடு & சமூக-அரசியல் இயக்கங்கள்', 'tamil-nadu-history', 44),
      g1Subject('Aptitude', 'திறனறிவு', 'aptitude', 19),
      g1Subject('Reasoning', 'தருக்க அறிவு', 'reasoning', 7),
    ],
    bannerImage: '/group1-answer-key-banner-2026.jpg',
    seriesLink: { href: '/group-1', label: { en: 'Group 1 Test Series', ta: 'குரூப் 1 தேர்வுத் தொடர்' } },
    title: 'TNPSC Group 1 Answer Key 2026 & Question Paper with Explanations',
    docTitle: 'TNPSC Group 1 Answer Key 2026 & Question Paper with Explanations',
    description:
      'TNPSC Group 1 Answer Key 2026: download the prelims question paper PDF, a detailed answer key and subject-wise explanations in Tamil & English. Free.',
  },

  group2: {
    key: 'group2',
    path: '/tnpsc-group-2-answer-key-2026',
    shortPaths: ['/group-2-answer-key'],
    examLabel: 'Group 2 / 2A',
    examFullName: {
      en: 'TNPSC Group 2 / 2A — Combined Civil Services Examination II / IIA (Prelims)',
      ta: 'TNPSC குரூப் 2 / 2A — Combined Civil Services Examination II / IIA (முதல்நிலை)',
    },
    examStart: null,
    examEnd: null,
    totalQuestions: null,
    totalMarks: null,
    negativeMarking: null,
    published: '2026-09-24',
    updated: '2026-09-24',
    resources: [
      { key: 'paper', kind: 'pdf', href: null },
      { key: 'key', kind: 'pdf', href: null },
      { key: 'explanations', kind: 'pdf', href: null },
    ],
    subjects: [
      { en: 'Aptitude', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு', href: null },
      { en: 'General English', ta: 'பொது ஆங்கிலம்', href: null },
      { en: 'General Tamil', ta: 'பொதுத் தமிழ்', href: null },
      { en: 'General Studies', ta: 'பொது அறிவு', href: null },
    ],
    bannerImage: null,
    seriesLink: { href: '/group-2-test-series', label: { en: 'Group 2 Test Series', ta: 'குரூப் 2 தேர்வுத் தொடர்' } },
    title: 'TNPSC Group 2 & 2A Answer Key 2026 & Question Paper with Explanations',
    docTitle: 'TNPSC Group 2 Answer Key 2026 & Question Paper with Explanations',
    description:
      'TNPSC Group 2 / 2A Answer Key 2026: download the prelims question paper PDF, a detailed answer key and subject-wise explanations in Tamil & English. Free.',
  },

  group4: {
    key: 'group4',
    path: '/tnpsc-group-4-answer-key-2026',
    shortPaths: ['/group-4-answer-key'],
    examLabel: 'Group 4',
    examFullName: {
      en: 'TNPSC Group 4 — Combined Civil Services Examination IV',
      ta: 'TNPSC குரூப் 4 — Combined Civil Services Examination IV',
    },
    examStart: null,
    examEnd: null,
    totalQuestions: null,
    totalMarks: null,
    negativeMarking: null,
    published: '2026-09-24',
    updated: '2026-09-24',
    resources: [
      { key: 'paper', kind: 'pdf', href: null },
      { key: 'key', kind: 'pdf', href: null },
      { key: 'explanations', kind: 'pdf', href: null },
    ],
    subjects: [
      { en: 'General Tamil', ta: 'பொதுத் தமிழ்', href: null },
      { en: 'General Studies', ta: 'பொது அறிவு', href: null },
      { en: 'Aptitude', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு', href: null },
    ],
    bannerImage: null,
    seriesLink: null,
    title: 'TNPSC Group 4 Answer Key 2026 & Question Paper with Explanations',
    docTitle: 'TNPSC Group 4 Answer Key 2026 & Question Paper with Explanations',
    description:
      'TNPSC Group 4 Answer Key 2026: download the question paper PDF, a detailed answer key and subject-wise explanations in Tamil & English. Free.',
  },
}

export const ANSWER_KEY_GROUP_ORDER: AnswerKeyGroupKey[] = ['group1', 'group2', 'group4']

/**
 * Past exams already conducted — unlike ANSWER_KEY_GROUPS above, there is no
 * live PDF pipeline for these: the real question paper, answer key and
 * bilingual explanations already live in the app's PYQ banks (category
 * 'pyq'/'pyq2'/'pyq4'), so the page's call to action sends the visitor
 * straight into that bank pre-filtered to the year (`practiceHref`) instead
 * of promising a download.
 *
 * `questionCount` is the count actually in our bank for that year (verified
 * against the DB), which can be a few short of the official paper's total —
 * a handful of rows are disabled as defective/duplicate (see
 * pyq-explanation-rewrite / pyq2-tamil-duplicate-options in memory). Never
 * word it as "the official total".
 */
export interface PastAnswerKeyPageDef {
  key: string
  group: AnswerKeyGroupKey
  year: number
  path: string
  bannerImage: string
  /** The official answer-key PDF under public/downloads/<group>-<year>/, or
   *  null while it hasn't been prepared for that year yet. */
  pdfHref: string | null
  /** The same key with Tamil explanations, or null while only English exists. */
  pdfHrefTa: string | null
  practiceHref: string
  questionCount: number
  title: string
  docTitle: string
  description: string
  published: string
  updated: string
}

const practiceHref = (group: AnswerKeyGroupKey, year: number) => `/test-arena/pyq/${group}?year=${year}`

export const PAST_ANSWER_KEY_PAGES: PastAnswerKeyPageDef[] = [
  {
    key: 'group1-2025',
    group: 'group1',
    year: 2025,
    path: '/tnpsc-group-1-answer-key-2025',
    bannerImage: '/group1-answer-key-banner-2025.jpg',
    pdfHref: '/downloads/group1-2025/tnpsc-group-1-answer-key-2025.pdf',
    pdfHrefTa: null,
    practiceHref: practiceHref('group1', 2025),
    questionCount: 197,
    title: 'TNPSC Group 1 Answer Key 2025 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 1 Answer Key 2025 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 1 2025 Prelims: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group1-2024',
    group: 'group1',
    year: 2024,
    path: '/tnpsc-group-1-answer-key-2024',
    bannerImage: '/group1-answer-key-banner-2024.jpg',
    pdfHref: '/downloads/group1-2024/tnpsc-group-1-answer-key-2024.pdf',
    pdfHrefTa: null,
    practiceHref: practiceHref('group1', 2024),
    questionCount: 195,
    title: 'TNPSC Group 1 Answer Key 2024 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 1 Answer Key 2024 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 1 2024 Prelims: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group1-2022',
    group: 'group1',
    year: 2022,
    path: '/tnpsc-group-1-answer-key-2022',
    bannerImage: '/group1-answer-key-banner-2022.jpg',
    pdfHref: '/downloads/group1-2022/tnpsc-group-1-answer-key-2022.pdf',
    pdfHrefTa: null,
    practiceHref: practiceHref('group1', 2022),
    questionCount: 195,
    title: 'TNPSC Group 1 Answer Key 2022 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 1 Answer Key 2022 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 1 2022 Prelims: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group2-2025',
    group: 'group2',
    year: 2025,
    path: '/tnpsc-group-2-answer-key-2025',
    bannerImage: '/group2-answer-key-banner-2025.jpg',
    pdfHref: '/downloads/group2-2025/tnpsc-group-2-answer-key-2025.pdf',
    pdfHrefTa: null,
    practiceHref: practiceHref('group2', 2025),
    questionCount: 296,
    title: 'TNPSC Group 2 & 2A Answer Key 2025 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 2 Answer Key 2025 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 2 / 2A 2025 Prelims: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group2-2024',
    group: 'group2',
    year: 2024,
    path: '/tnpsc-group-2-answer-key-2024',
    bannerImage: '/group2-answer-key-banner-2024.jpg',
    pdfHref: '/downloads/group2-2024/tnpsc-group-2-answer-key-2024.pdf',
    pdfHrefTa: null,
    practiceHref: practiceHref('group2', 2024),
    questionCount: 298,
    title: 'TNPSC Group 2 & 2A Answer Key 2024 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 2 Answer Key 2024 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 2 / 2A 2024 Prelims: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group4-2025',
    group: 'group4',
    year: 2025,
    path: '/tnpsc-group-4-answer-key-2025',
    bannerImage: '/group4-answer-key-banner-2025.jpg',
    pdfHref: '/downloads/group4-2025/tnpsc-group-4-answer-key-2025.pdf',
    pdfHrefTa: '/downloads/group4-2025/tnpsc-group-4-answer-key-2025-tamil.pdf',
    practiceHref: practiceHref('group4', 2025),
    questionCount: 200,
    title: 'TNPSC Group 4 Answer Key 2025 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 4 Answer Key 2025 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 4 2025 exam: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
  {
    key: 'group4-2024',
    group: 'group4',
    year: 2024,
    path: '/tnpsc-group-4-answer-key-2024',
    bannerImage: '/group4-answer-key-banner-2024.jpg',
    pdfHref: '/downloads/group4-2024/tnpsc-group-4-answer-key-2024.pdf',
    pdfHrefTa: '/downloads/group4-2024/tnpsc-group-4-answer-key-2024-tamil.pdf',
    practiceHref: practiceHref('group4', 2024),
    questionCount: 200,
    title: 'TNPSC Group 4 Answer Key 2024 & Previous Year Question Paper with Explanations',
    docTitle: 'TNPSC Group 4 Answer Key 2024 & Previous Year Question Paper with Explanations',
    description:
      'TNPSC Group 4 2024 exam: practice the full previous year question paper against our answer key, with subject-wise explanations in Tamil & English. Free.',
    published: '2026-09-24',
    updated: '2026-09-27',
  },
]

/** A group's past-year pages, newest first (array declaration order). */
export function pastPagesForGroup(group: AnswerKeyGroupKey): PastAnswerKeyPageDef[] {
  return PAST_ANSWER_KEY_PAGES.filter((p) => p.group === group)
}

export type ExamPhase = 'before' | 'during' | 'after'

export function examPhase(group: Pick<AnswerKeyGroupDef, 'examStart' | 'examEnd'>, now: number): ExamPhase {
  if (!group.examStart || now < Date.parse(group.examStart)) return 'before'
  if (!group.examEnd || now < Date.parse(group.examEnd)) return 'during'
  return 'after'
}

const absolute = (href: string) => (/^https?:\/\//.test(href) ? href : ANSWER_KEY_ORIGIN + href)

const RESOURCE_SEO_NAME = (group: AnswerKeyGroupDef): Record<ResourceKey, string> => ({
  paper: `TNPSC ${group.examLabel} Question Paper 2026 (PDF)`,
  key: `TNPSC ${group.examLabel} Answer Key 2026`,
  explanations: `TNPSC ${group.examLabel} 2026 Subject-wise Explanations`,
})

/**
 * Structured data for one group's page, baked into its static HTML at build
 * time. The @ids for the organisation and website point at the graph
 * index.html already declares, so every group's block describes one publisher.
 */
export function answerKeyJsonLd(group: AnswerKeyGroupDef): object {
  const url = ANSWER_KEY_ORIGIN + group.path
  const published = group.resources.filter((r): r is AnswerKeyResource & { href: string } => r.href !== null)
  const resourceSeoName = RESOURCE_SEO_NAME(group)

  const breadcrumb = [{ '@type': 'ListItem', position: 1, name: 'TNPSC Mentors', item: `${ANSWER_KEY_ORIGIN}/` }]
  if (group.seriesLink) {
    breadcrumb.push({
      '@type': 'ListItem',
      position: 2,
      name: `TNPSC ${group.examLabel}`,
      item: ANSWER_KEY_ORIGIN + group.seriesLink.href,
    })
  }
  breadcrumb.push({
    '@type': 'ListItem',
    position: breadcrumb.length + 1,
    name: `${group.examLabel} Answer Key 2026`,
    item: url,
  })

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: group.title,
        description: group.description,
        inLanguage: ['en-IN', 'ta-IN'],
        isPartOf: { '@id': `${ANSWER_KEY_ORIGIN}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        datePublished: group.published,
        dateModified: group.updated,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: breadcrumb,
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: group.title,
        description: group.description,
        image: [`${ANSWER_KEY_ORIGIN}/brand-logo.png`],
        inLanguage: 'en-IN',
        datePublished: group.published,
        dateModified: group.updated,
        author: { '@type': 'Organization', name: 'TNPSC Mentors', url: `${ANSWER_KEY_ORIGIN}/` },
        publisher: { '@id': `${ANSWER_KEY_ORIGIN}/#org` },
        mainEntityOfPage: { '@id': `${url}#webpage` },
        ...(group.examStart ? { about: { '@id': `${url}#exam` } } : {}),
        keywords: [
          `TNPSC ${group.examLabel} Answer Key 2026`,
          `TNPSC ${group.examLabel} Question Paper 2026`,
          `TNPSC ${group.examLabel} Question Paper with Explanations`,
          `TNPSC ${group.examLabel} Prelims Answer Key`,
          'TNPSC Mentors',
        ],
        ...(published.length
          ? {
              hasPart: published.flatMap((r) => [
                {
                  '@type': 'DigitalDocument',
                  name: resourceSeoName[r.key],
                  url: absolute(r.href),
                },
                ...(r.hrefTa
                  ? [
                      {
                        '@type': 'DigitalDocument',
                        name: `${resourceSeoName[r.key]} (Tamil)`,
                        url: absolute(r.hrefTa),
                        inLanguage: 'ta-IN',
                      },
                    ]
                  : []),
              ]),
            }
          : {}),
      },
      // Only a notified exam gets an Event node — schema.org requires a startDate.
      ...(group.examStart
        ? [
            {
              '@type': 'Event',
              '@id': `${url}#exam`,
              name: `TNPSC ${group.examLabel} Preliminary Examination 2026`,
              startDate: group.examStart,
              ...(group.examEnd ? { endDate: group.examEnd } : {}),
              eventStatus: 'https://schema.org/EventScheduled',
              eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
              location: {
                '@type': 'Place',
                name: 'TNPSC examination centres, Tamil Nadu',
                address: { '@type': 'PostalAddress', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
              },
              organizer: {
                '@type': 'Organization',
                name: 'Tamil Nadu Public Service Commission',
                url: 'https://www.tnpsc.gov.in/',
              },
            },
          ]
        : []),
    ],
  }
}

/** Structured data for one past-year page — an Article + breadcrumb nested
 *  under that group's current answer-key hub. No Event node: the exam is
 *  long over, and this page is about practising it, not attending it. */
export function pastAnswerKeyJsonLd(def: PastAnswerKeyPageDef): object {
  const url = ANSWER_KEY_ORIGIN + def.path
  const hub = ANSWER_KEY_GROUPS[def.group]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: def.title,
        description: def.description,
        inLanguage: ['en-IN', 'ta-IN'],
        isPartOf: { '@id': `${ANSWER_KEY_ORIGIN}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        datePublished: def.published,
        dateModified: def.updated,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TNPSC Mentors', item: `${ANSWER_KEY_ORIGIN}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: `TNPSC ${hub.examLabel} Answer Key`,
            item: ANSWER_KEY_ORIGIN + hub.path,
          },
          { '@type': 'ListItem', position: 3, name: `${hub.examLabel} Answer Key ${def.year}`, item: url },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: def.title,
        description: def.description,
        image: [`${ANSWER_KEY_ORIGIN}/brand-logo.png`],
        inLanguage: 'en-IN',
        datePublished: def.published,
        dateModified: def.updated,
        author: { '@type': 'Organization', name: 'TNPSC Mentors', url: `${ANSWER_KEY_ORIGIN}/` },
        publisher: { '@id': `${ANSWER_KEY_ORIGIN}/#org` },
        mainEntityOfPage: { '@id': `${url}#webpage` },
        keywords: [
          `TNPSC ${hub.examLabel} Answer Key ${def.year}`,
          `TNPSC ${hub.examLabel} Question Paper ${def.year}`,
          `TNPSC ${hub.examLabel} Previous Year Question Paper with Explanations`,
          `TNPSC ${hub.examLabel} ${def.year} Answer Key with Explanations`,
          'TNPSC Mentors',
        ],
        ...(def.pdfHref
          ? {
              hasPart: [
                {
                  '@type': 'DigitalDocument',
                  name: `TNPSC ${hub.examLabel} Answer Key ${def.year} (PDF)`,
                  url: absolute(def.pdfHref),
                },
                ...(def.pdfHrefTa
                  ? [
                      {
                        '@type': 'DigitalDocument',
                        name: `TNPSC ${hub.examLabel} Answer Key ${def.year} with Tamil Explanations (PDF)`,
                        url: absolute(def.pdfHrefTa),
                        inLanguage: 'ta-IN',
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
    ],
  }
}
