/**
 * Link-preview titles for the links we hand out (WhatsApp, Telegram, Facebook).
 *
 * Those apps build a link's preview card from the <meta> tags in the HTML they
 * download. They never run the React bundle, so the document.title each landing
 * page sets at runtime is invisible to them. Every route used to be served the
 * one index.html, whose tags described Group 2 — so a Group 1 pay link went out
 * previewed as "TNPSC Test Series, Group 2 & Previous…".
 *
 * The build (sharePreviewPages in vite.config.ts) now writes a copy of
 * index.html to dist/<path>/index.html for every path below, with that path's
 * title and description swapped into the tags. Nginx's
 * `try_files $uri $uri/ /index.html` already serves a directory's index.html
 * ahead of the fallback, so no server change is needed. A path that is not
 * listed gets index.html's own tags, which name no single group.
 *
 * Standalone on purpose: vite.config.ts imports this file, so it must not pull
 * in app code (lib/authRouting, which owns the pay-link path lists, imports the
 * stores). shareMeta.test.ts checks these paths against App.tsx and PYQ_GROUPS
 * instead, so a new public route cannot quietly fall back to the default.
 */

export type ShareGroup = 'group1' | 'group2' | 'group4'

/** How each exam group is named in a preview title. */
export const SHARE_GROUP_LABEL: Record<ShareGroup, string> = {
  group1: 'Group 1',
  group2: 'Group 2 / 2A',
  group4: 'Group 4',
}

export interface ShareMeta {
  /** Preview title. The group is named first: WhatsApp cuts titles at ~40 characters. */
  title: string
  description: string
}

export interface ShareRoute extends ShareMeta {
  /** The exam group the link sells or opens; null for a page covering several. */
  group: ShareGroup | null
  paths: string[]
}

const groupTitle = (group: ShareGroup, what: string) =>
  `TNPSC Test Series ${SHARE_GROUP_LABEL[group]} – ${what}`

/** Section slugs as the PYQ section route spells them (pyqSectionSlug over
 *  PYQ_GROUPS[group].sections — the test holds these two in step). */
const PYQ_SECTIONS: Record<'group2' | 'group4', { slug: string; name: string }[]> = {
  group2: [
    { slug: 'aptitude', name: 'Aptitude' },
    { slug: 'english', name: 'General English' },
    { slug: 'tamil', name: 'General Tamil' },
    { slug: 'general-studies', name: 'General Studies' },
  ],
  group4: [
    { slug: 'tamil', name: 'General Tamil' },
    { slug: 'general-studies', name: 'General Studies' },
    { slug: 'aptitude', name: 'Aptitude' },
  ],
}

const PYQ_DESCRIPTION: Record<'group2' | 'group4', string> = {
  group2:
    'TNPSC Group 2 / 2A prelims previous year questions — Aptitude, General English, General Tamil and General Studies — with bilingual (Tamil & English) explanations.',
  group4:
    'TNPSC Group 4 / VAO previous year questions — General Tamil, General Studies and Aptitude — with bilingual (Tamil & English) explanations.',
}

const pyqSectionRoutes = (group: 'group2' | 'group4'): ShareRoute[] =>
  PYQ_SECTIONS[group].map((s) => ({
    group,
    paths: [`/test-arena/pyq/${group}/${s.slug}`],
    title: groupTitle(group, `${s.name} Previous Year Questions`),
    description: PYQ_DESCRIPTION[group],
  }))

export const SHARE_ROUTES: ShareRoute[] = [
  // ─── Group 1 ──────────────────────────────────────────────────────────────
  {
    group: 'group1',
    paths: ['/group-1'],
    title: groupTitle('group1', 'Test Marathon & Mock Tests 2026'),
    description:
      'Two ways to prepare for TNPSC Group 1: the 13-test Test Marathon on a unit-by-unit schedule, or 6 full-length mock papers. Real exam pattern, bilingual explanations.',
  },
  {
    group: 'group1',
    paths: ['/group-1-test-series', '/group-1/test-series'],
    title: groupTitle('group1', 'Test Marathon 2026'),
    description:
      '10 unit-wise tests and 3 full-length mocks in the real TNPSC Group 1 exam pattern, with a bilingual (Tamil & English) explanation for every question.',
  },
  {
    // The ₹399 Group 1 Mock Test Pack under every name it is handed out by.
    // /mock-test-pack and /rank-booster/mock-test-pack render the Group II/IIA
    // landing page behind the Group 1 sheet, but what the link sells is the
    // Group 1 pack, so that is what the preview names.
    group: 'group1',
    paths: [
      '/mock-test-pack',
      '/rank-booster/mock-test-pack',
      '/group-1-mock-test',
      '/group-1/mock-test',
      '/group-1-mock-pack',
      '/mock-399',
      '/399',
    ],
    title: groupTitle('group1', 'Mock Tests & Previous Year Question Papers'),
    description:
      '6 full-length TNPSC Group 1 mock papers plus unlimited Group 1 previous year questions for 80 days, with bilingual explanations. One-time payment.',
  },
  {
    // /history and /aptitude are sub-pages of the Group 1 PYQ page.
    group: 'group1',
    paths: ['/test-arena/pyq/group1', '/test-arena/pyq/history', '/test-arena/pyq/aptitude'],
    title: groupTitle('group1', 'Previous Year Question Papers'),
    description:
      'TNPSC Group 1 previous year questions, General Studies subject-wise (2019–2025), with bilingual (Tamil & English) explanations.',
  },

  // ─── Group 2 / 2A ─────────────────────────────────────────────────────────
  {
    group: 'group2',
    paths: ['/rank-booster', '/group-2-test-series', '/rank-booster/group-2-test-series'],
    title: groupTitle('group2', 'Prelims 2026'),
    description:
      '23 complete tests in the real TNPSC Group II / IIA prelims pattern — GS + Aptitude, Language and 3 Grand Mocks — on a systematic schedule, with bilingual explanations.',
  },
  {
    group: 'group2',
    paths: ['/test-arena/pyq/group2'],
    title: groupTitle('group2', 'Previous Year Question Papers'),
    description: PYQ_DESCRIPTION.group2,
  },
  ...pyqSectionRoutes('group2'),

  // ─── Group 4 ──────────────────────────────────────────────────────────────
  {
    group: 'group4',
    paths: ['/test-arena/pyq/group4'],
    title: groupTitle('group4', 'Previous Year Question Papers'),
    description: PYQ_DESCRIPTION.group4,
  },
  ...pyqSectionRoutes('group4'),

  // ─── Across groups ────────────────────────────────────────────────────────
  {
    group: null,
    paths: ['/test-arena/pyq'],
    title: 'TNPSC Previous Year Question Papers – Group 1, 2 & 4',
    description:
      'TNPSC Group 1, Group 2 / 2A and Group 4 previous year questions, section-wise and year-wise, with bilingual (Tamil & English) explanations.',
  },
]

/** The preview a path gets, or null when it keeps index.html's own tags. */
export function shareMetaFor(path: string): ShareMeta | null {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  for (const route of SHARE_ROUTES) {
    if (route.paths.indexOf(clean) !== -1) return { title: route.title, description: route.description }
  }
  return null
}

export interface SharePage {
  path: string
  /** null: an ancestor directory that only needs a copy of index.html as-is. */
  meta: ShareMeta | null
}

/**
 * Every page the build writes. Includes each listed path's ancestors, because
 * writing dist/test-arena/pyq/group4/index.html makes dist/test-arena/ a
 * directory, and nginx's `$uri/` would then match /test-arena and answer 403
 * (a directory with no index) instead of falling through to the SPA.
 */
export function sharePages(): SharePage[] {
  const pages: SharePage[] = []
  const seen: Record<string, true> = {}
  const add = (path: string) => {
    if (seen[path]) return
    seen[path] = true
    pages.push({ path, meta: shareMetaFor(path) })
  }
  for (const route of SHARE_ROUTES) {
    for (const path of route.paths) {
      const parts = path.split('/').filter(Boolean)
      for (let i = 1; i <= parts.length; i++) add('/' + parts.slice(0, i).join('/'))
    }
  }
  return pages
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const SHARE_ORIGIN = 'https://tnpscmentors.in'

/**
 * index.html with one path's preview swapped in. Throws when a tag it expects
 * is missing, so an edit to index.html's head fails the build rather than
 * quietly shipping every link with the default preview again.
 */
export function applyShareMeta(html: string, path: string, meta: ShareMeta): string {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const swaps: [RegExp, string][] = [
    [/(<title>)[^<]*(<\/title>)/, `${title} – TNPSC Mentors`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/, description],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/, title],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/, description],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/, escapeHtml(SHARE_ORIGIN + path)],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, title],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, description],
  ]
  let out = html
  for (const [pattern, value] of swaps) {
    if (!pattern.test(out)) throw new Error(`shareMeta: index.html has no tag matching ${pattern}`)
    out = out.replace(pattern, (_m, open: string, close: string) => open + value + close)
  }
  return out
}
