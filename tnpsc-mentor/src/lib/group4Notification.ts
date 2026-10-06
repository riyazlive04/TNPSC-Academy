/**
 * The TNPSC Group 4 (Combined Civil Services Examination - IV) 2026
 * notification, as a data module.
 *
 * The numbers come from the official PDF (Advertisement No. 747, Notification
 * No. 11/2026, dated 06.10.2026) and live in data/group4Notification2026.json
 * so the same rows can be loaded into the question/search database without
 * being retyped. This module adds the types, the derived figures the page
 * shows, and the two build-time outputs (JSON-LD and the crawler HTML) that
 * lib/shareMeta bakes into dist/group-4-notification-2026/index.html.
 *
 * Standalone on purpose, exactly like lib/answerKeyGroups: vite.config.ts
 * reaches this file through shareMeta, so it must not import app code.
 */

import raw from '../data/group4Notification2026.json'

export const GROUP4_ORIGIN = 'https://tnpscmentors.in'

/** The canonical, keyword-first route. */
export const GROUP4_NOTIFICATION_PATH = '/group-4-notification-2026'
/** Short links that render the same page; each gets the canonical above. */
export const GROUP4_NOTIFICATION_SHORT_PATHS = ['/group-4-notification', '/group-4-vacancy-2026']

export interface Group4Post {
  sNo: number
  name: string
  postCode: string
  service: string
  vacancies: number
  payLevel: string
  qualification: string
  note?: string
  includesBacklog?: boolean
  backlogOnly?: boolean
  includesSportspersonsQuota?: boolean
  requiresEnduranceTest?: boolean
}

export interface Group4PostGroup {
  group: string
  vacancies: number
  postCodes: string[]
}

export interface Group4Date {
  event: string
  date: string
  displayDate: string
  time: string | null
}

export const GROUP4 = raw
export const GROUP4_POSTS: Group4Post[] = raw.posts
export const GROUP4_POST_GROUPS: Group4PostGroup[] = raw.postGroups
export const GROUP4_DATES: Group4Date[] = raw.importantDates

/** Keyword-first <title>, kept under ~60 characters. */
export const GROUP4_DOC_TITLE = 'TNPSC Group 4 Notification 2026: 6574 Vacancies, Apply Now'
/** Open Graph / WhatsApp preview title. The group is named first. */
export const GROUP4_SHARE_TITLE = 'TNPSC Group 4 Notification 2026 — 6,574 Vacancies'
export const GROUP4_DESCRIPTION =
  'TNPSC Group 4 2026 notification out: 6,574 vacancies across 46 posts. Apply by 5 Nov 2026, exam 10 Jan 2027. Check eligibility, pattern & free mock tests.'

/** Bump with every edit — it becomes the JSON-LD dateModified and the byline. */
export const GROUP4_PUBLISHED = '2026-10-06'
export const GROUP4_UPDATED = '2026-10-06'

/**
 * The hero banner under the H1, from public/. Every figure on it is checked
 * against this module's data (6,574 vacancies, 46 posts, the five largest
 * post counts, and all five dates) — if the notification is corrected, the
 * artwork has to be regenerated with it, not just the JSON. null drops the
 * frame. 1400px wide, which covers the main column at 2x.
 */
export const GROUP4_HERO_IMAGE: string | null = '/group-4-notification-2026-hero.jpg'

const dateOf = (event: string) => GROUP4_DATES.find((d) => d.event === event) ?? null

export const GROUP4_LAST_DATE = dateOf('Last date to apply online')!
export const GROUP4_EXAM_DATE = dateOf('Written Examination')!

/** IST instants, for the countdown and the JSON-LD Event node. */
export const GROUP4_APPLY_DEADLINE_ISO = '2026-11-05T23:59:00+05:30'
export const GROUP4_EXAM_START_ISO = '2027-01-10T09:30:00+05:30'
export const GROUP4_EXAM_END_ISO = '2027-01-10T12:30:00+05:30'

/** Whole days left to apply, floored at 0 once the window shuts. */
export function daysToApply(now: number): number {
  const ms = Date.parse(GROUP4_APPLY_DEADLINE_ISO) - now
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}

export const applyWindowOpen = (now: number) => now < Date.parse(GROUP4_APPLY_DEADLINE_ISO)

/** Posts ordered by vacancy count, for the "biggest openings" table. */
export function topPosts(n: number): Group4Post[] {
  return [...GROUP4_POSTS].sort((a, b) => b.vacancies - a.vacancies).slice(0, n)
}

/** The three qualification bands the vacancy table filters by. */
export type QualBand = 'all' | 'sslc' | 'hsc' | 'degree'

export function qualBandOf(post: Group4Post): Exclude<QualBand, 'all'> {
  const q = post.qualification.toLowerCase()
  if (q.includes('degree') || q.includes('graduate') || q.includes('b.com')) return 'degree'
  if (q.includes('higher secondary') || q.includes('intermediate')) return 'hsc'
  return 'sslc'
}

export function postsInBand(band: QualBand): Group4Post[] {
  return band === 'all' ? GROUP4_POSTS : GROUP4_POSTS.filter((p) => qualBandOf(p) === band)
}

export function vacanciesInBand(band: QualBand): number {
  return postsInBand(band).reduce((sum, p) => sum + p.vacancies, 0)
}

export interface Group4Faq {
  q: string
  a: string
}

/** English on purpose: these are the phrases aspirants type into Google. */
export const GROUP4_FAQS: Group4Faq[] = [
  {
    q: 'How many vacancies are there in the TNPSC Group 4 2026 notification?',
    a:
      'The TNPSC Group 4 2026 notification announces 6,574 vacancies across 46 posts in 26 services, corporations and boards. The largest single allotment is 2,610 Junior Assistant (Non Security) posts in the Tamil Nadu Ministerial Service, followed by 856 Typist posts and 422 Junior Assistant (Accounts) posts in the Tamil Nadu Power Distribution Corporation.',
  },
  {
    q: 'What is the last date to apply for TNPSC Group 4 2026, and when is the exam?',
    a:
      'Online applications close on 5 November 2026 at 11.59 PM at apply.tnpscexams.in. A three-day correction window follows from 9 to 11 November 2026, after which no edits are allowed. The written examination is on 10 January 2027, from 9.30 A.M. to 12.30 P.M.',
  },
  {
    q: 'What is the minimum qualification and age limit for TNPSC Group 4 2026?',
    a:
      'Most posts require only a pass in SSLC (10th standard), held as on 6 October 2026. The usual age range is 18 to 30 years as on 1 July 2026 for candidates not belonging to the reserved communities, and up to 32 or 35 years for BC(OBCM)s, BCMs, MBCs/DCs, SCs, SC(A)s and STs. VAO and the Forest posts have a minimum age of 21, Executive Officer 25, and eleven corporation and board posts carry no maximum age limit.',
  },
  {
    q: 'What is the TNPSC Group 4 exam pattern, and how are the Tamil marks counted?',
    a:
      'It is a single OMR paper of 200 questions and 300 marks in 3 hours: Part A Tamil Eligibility-cum-Scoring Test (100 questions, 150 marks), Part B General Studies (75 questions) and Part C Aptitude and Mental Ability (25 questions), with Part B and Part C together carrying 150 marks. Part B and Part C are evaluated only if you score at least 60 marks — 40% — in Part A. Marks from all three parts are then added for ranking.',
  },
  {
    q: 'Can I apply for Group 4 if I have not passed Typewriting or Shorthand?',
    a:
      'Yes. Typewriting and Shorthand qualifications are required only for Typist, Steno Typist, Shorthand Typist and Personal Clerk posts. The large Junior Assistant, VAO, Bill Collector, Tax Collector and Revenue Assistant cadres — well over 4,000 vacancies — need only an SSLC pass. For most Typist and Steno Typist posts, candidates who lack the Certificate Course in Computer on Office Automation may still apply and acquire it within two years of appointment.',
  },
  {
    q: 'Where will the TNPSC Group 4 2027 exam be held?',
    a:
      'At centres in all 38 districts of Tamil Nadu. You may choose two preferred districts in the online application and will be allotted a venue in one of them. Requests to change the centre after allotment are not accepted.',
  },
]

// ─── Build-time SEO output ───────────────────────────────────────────────────

const absolute = (href: string) => (/^https?:\/\//.test(href) ? href : GROUP4_ORIGIN + href)

/**
 * Structured data for the page, baked into its static HTML at build time. The
 * organisation and website @ids point at the graph index.html already
 * declares, so the whole site still describes one publisher.
 *
 * One JobPosting per post GROUP rather than per post: 46 nodes would bloat the
 * head for no extra coverage, and the six groups are what the page's H3s are.
 */
export function group4NotificationJsonLd(): object {
  const url = GROUP4_ORIGIN + GROUP4_NOTIFICATION_PATH

  const jobPostings = GROUP4_POST_GROUPS.map((g, i) => ({
    '@type': 'JobPosting',
    '@id': `${url}#job-${i + 1}`,
    title: `TNPSC Group 4 2026 — ${g.group}`,
    description: `${g.vacancies} vacancies for ${g.group} under the Tamil Nadu Public Service Commission Combined Civil Services Examination - IV (Group IV Services) 2026, Advertisement No. 747.`,
    identifier: {
      '@type': 'PropertyValue',
      name: 'TNPSC Post Codes',
      value: g.postCodes.join(', '),
    },
    datePosted: GROUP4_PUBLISHED,
    validThrough: GROUP4_APPLY_DEADLINE_ISO,
    employmentType: 'FULL_TIME',
    totalJobOpenings: g.vacancies,
    hiringOrganization: {
      '@type': 'GovernmentOrganization',
      name: 'Tamil Nadu Public Service Commission',
      sameAs: 'https://www.tnpsc.gov.in/',
    },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    },
    educationRequirements: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'SSLC (10th standard) or higher, depending on the post',
    },
    directApply: false,
    url: raw.notification.applyUrl,
  }))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: GROUP4_SHARE_TITLE,
        description: GROUP4_DESCRIPTION,
        inLanguage: ['en-IN', 'ta-IN'],
        isPartOf: { '@id': `${GROUP4_ORIGIN}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        datePublished: GROUP4_PUBLISHED,
        dateModified: GROUP4_UPDATED,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TNPSC Mentors', item: `${GROUP4_ORIGIN}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'TNPSC Group 4',
            item: absolute('/test-arena/pyq/group4'),
          },
          { '@type': 'ListItem', position: 3, name: 'Group 4 Notification 2026', item: url },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: GROUP4_SHARE_TITLE,
        description: GROUP4_DESCRIPTION,
        image: [absolute(GROUP4_HERO_IMAGE ?? '/brand-logo.png')],
        inLanguage: 'en-IN',
        datePublished: GROUP4_PUBLISHED,
        dateModified: GROUP4_UPDATED,
        author: { '@type': 'Organization', name: 'TNPSC Mentors', url: `${GROUP4_ORIGIN}/` },
        publisher: { '@id': `${GROUP4_ORIGIN}/#org` },
        mainEntityOfPage: { '@id': `${url}#webpage` },
        about: { '@id': `${url}#exam` },
        keywords: [
          'TNPSC Group 4 Notification 2026',
          'TNPSC Group 4 Vacancy 2026',
          'Group 4 Notification',
          'Group 4 Vacancies',
          'TNPSC Group 4 Apply Online',
          'TNPSC Group 4 Exam Date 2027',
          'TNPSC Group 4 Eligibility',
        ].join(', '),
      },
      {
        '@type': 'Event',
        '@id': `${url}#exam`,
        name: 'TNPSC Group 4 (CCSE-IV) Written Examination 2027',
        description:
          'Combined Civil Services Examination - IV (Group IV Services) written examination — a single OMR paper of 200 questions and 300 marks.',
        startDate: GROUP4_EXAM_START_ISO,
        endDate: GROUP4_EXAM_END_ISO,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        organizer: {
          '@type': 'GovernmentOrganization',
          name: 'Tamil Nadu Public Service Commission',
          url: 'https://www.tnpsc.gov.in/',
        },
        location: {
          '@type': 'Place',
          name: 'Examination centres across all 38 districts of Tamil Nadu',
          address: { '@type': 'PostalAddress', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
        },
      },
      ...jobPostings,
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: GROUP4_FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`

const STATIC_STYLE =
  'max-width:960px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2a44;line-height:1.6'

/**
 * The page as plain HTML, written into <div id="root"> at build time so
 * crawlers that do not run JavaScript still read the vacancy table, the dates
 * and the FAQs. React replaces it on mount.
 */
export function group4NotificationStaticHtml(): string {
  const n = raw.notification
  const s = raw.summary
  const p: string[] = [
    `<h1>${esc(GROUP4_SHARE_TITLE)}</h1>`,
    `<p>TNPSC Mentors · Updated ${esc(GROUP4_UPDATED)}</p>`,
    `<p>The Tamil Nadu Public Service Commission has released the TNPSC Group 4 notification 2026 (Advertisement No. ${esc(n.advertisementNo)}, Notification No. ${esc(n.notificationNo)}) on 6 October 2026, announcing <strong>${s.totalVacancies.toLocaleString('en-IN')} vacancies</strong> across <strong>${s.totalPosts} posts</strong> in ${s.numberOfOrganizations} services, corporations and boards. Applications are open online only, from 6 October 2026 to 5 November 2026. Most posts need only a pass in SSLC (10th standard). The written examination is a single-stage OMR paper of 200 questions and 300 marks on 10 January 2027.</p>`,
  ]

  p.push(`<h2>TNPSC Group 4 important dates 2026-27</h2><ul>`)
  for (const d of GROUP4_DATES) {
    p.push(`<li>${esc(d.event)}: ${esc(d.displayDate)}${d.time ? `, ${esc(d.time)}` : ''}</li>`)
  }
  p.push(`</ul>`)

  p.push(
    `<h2>TNPSC Group 4 vacancy 2026: post-wise list</h2>`,
    `<table><thead><tr><th>S.No</th><th>Post</th><th>Post Code</th><th>Service / Organisation</th><th>Vacancies</th><th>Pay Level</th></tr></thead><tbody>`,
  )
  for (const post of GROUP4_POSTS) {
    p.push(
      `<tr><td>${post.sNo}</td><td>${esc(post.name)}</td><td>${esc(post.postCode)}</td><td>${esc(post.service)}</td><td>${post.vacancies}</td><td>${esc(post.payLevel)}</td></tr>`,
    )
  }
  p.push(
    `</tbody><tfoot><tr><td colspan="4">Total</td><td>${s.totalVacancies}</td><td></td></tr></tfoot></table>`,
    `<p>The number of vacancies notified is tentative and is liable for modification before the start of counselling. The department- and unit-wise distribution will be announced later by the Commission.</p>`,
  )

  p.push(`<h2>TNPSC Group 4 exam pattern 2026</h2><ul>`)
  for (const part of raw.examPattern.parts) {
    p.push(
      `<li>${esc(part.part)} — ${esc(part.subject)}: ${part.questions} questions, ${part.marks} marks${part.standard ? ` (${esc(part.standard)} standard)` : ''}</li>`,
    )
  }
  p.push(
    `</ul><p>Total 200 questions and 300 marks in 3 hours, in OMR mode. Part B and Part C are evaluated only if the candidate secures 60 marks (40%) in Part A, the Tamil Eligibility-cum-Scoring Test. Marks from all three parts are added for ranking.</p>`,
  )

  p.push(
    `<h2>TNPSC Group 4 eligibility 2026</h2>`,
    `<p>Minimum general educational qualification: ${esc(raw.eligibility.minimumGeneralEducationalQualification)}, held as on the notification date. Age is reckoned as on 1 July 2026 — usually 18 to 30 years for candidates not belonging to the reserved communities, and up to 32 or 35 years for BC(OBCM)s, BCMs, MBCs/DCs, SCs, SC(A)s and STs. Candidates must also possess adequate knowledge of Tamil.</p>`,
    `<h2>TNPSC Group 4 selection process</h2><ol>`,
  )
  for (const step of raw.selectionProcess.steps) p.push(`<li>${esc(step)}</li>`)
  p.push(`</ol>`)

  p.push(
    `<h2>TNPSC Group 4 exam centres</h2>`,
    `<p>The examination will be held at centres across all ${raw.examCentres.districtCount} districts of Tamil Nadu: ${esc(raw.examCentres.districts.join(', '))}. Candidates choose two preferred centres and are allotted a venue in one of them; requests to change the centre are not permitted.</p>`,
    `<h2>How to apply for TNPSC Group 4 2026</h2><ol>`,
  )
  for (const step of raw.applicationProcess.steps) p.push(`<li>${esc(step)}</li>`)
  p.push(
    `</ol><p>The examination fee is Rs.${raw.fee.examinationFee}, payable online only. Apply at ${link(n.applyUrl, n.applyUrl)}.</p>`,
  )

  p.push(
    `<h2>Start your Group 4 preparation today</h2>`,
    `<p>Practise TNPSC Group 4 previous year questions, take full-length mock tests in the real 200-question OMR pattern, and revise daily current affairs in Tamil and English on TNPSC Mentors.</p><ul>`,
    `<li>${link('/test-arena/pyq/group4', 'TNPSC Group 4 previous year question papers')}</li>`,
    `<li>${link('/tnpsc-group-4-answer-key-2026', 'TNPSC Group 4 answer key 2026')}</li>`,
    `<li>${link('/register', 'Create a free account and start practising')}</li>`,
    `</ul>`,
  )

  p.push(`<h2>Frequently asked questions</h2>`)
  for (const f of GROUP4_FAQS) p.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`)

  p.push(
    `<p>Source: TNPSC Advertisement No. ${esc(n.advertisementNo)}, Notification No. ${esc(n.notificationNo)} dated 06.10.2026. Where this page and the official notification differ, the notification on ${link(n.officialWebsite, n.officialWebsite)} is final.</p>`,
  )

  return `<main style="${STATIC_STYLE}">${p.join('')}</main>`
}
