import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import appSource from '../App.tsx?raw'
import { PYQ_GROUPS, pyqSectionSlug } from '../lib/constants'
import {
  SHARE_GROUP_LABEL,
  SHARE_ROUTES,
  applyShareMeta,
  shareMetaFor,
  sharePages,
  type ShareGroup,
} from '../lib/shareMeta'

// Link-preview titles per shared link. The failure this pins is the one a
// buyer saw: a Group 1 pay link forwarded on WhatsApp previewed as "TNPSC Test
// Series, Group 2 & Previous…", because every route served one index.html.

/** Public routes that are fine with index.html's default, group-neutral preview. */
const DEFAULT_PREVIEW_OK = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/guidelines',
  '/payment-policy',
  '/refund-policy',
  '/delete-account',
]

const publicRoutes = [...appSource.matchAll(/<Route\s+path="(\/[^"]*)"/g)].map((m) => m[1])
const shellRoutes = [...appSource.matchAll(/\{\s*path:\s*'(\/[^']*)'/g)].map((m) => m[1])
const mappedPaths = SHARE_ROUTES.flatMap((r) => r.paths)

const groupNumbers = (s: string) => [...s.matchAll(/Group (\d)/g)].map((m) => m[1])
const ogTitle = (html: string) => html.match(/property="og:title"\s+content="([^"]*)"/)?.[1]

describe('share previews', () => {
  it('the Group 1 mock-pack link from the WhatsApp forward previews as Group 1', () => {
    expect(shareMetaFor('/rank-booster/mock-test-pack')?.title).toMatch(/^TNPSC Test Series Group 1 – /)
    expect(shareMetaFor('/rank-booster/mock-test-pack/')?.title).toMatch(/^TNPSC Test Series Group 1 – /)
  })

  it('names each link by its own exam group and no other', () => {
    for (const route of SHARE_ROUTES) {
      if (!route.group) continue
      const own = SHARE_GROUP_LABEL[route.group].replace('Group ', '')[0]
      expect(route.title.startsWith(`TNPSC Test Series ${SHARE_GROUP_LABEL[route.group]} – `)).toBe(true)
      for (const n of groupNumbers(route.title + ' ' + route.description)) expect(n, route.title).toBe(own)
    }
  })

  it('gives every Group 4 PYQ link a Group 4 title', () => {
    for (const path of ['/test-arena/pyq/group4', '/test-arena/pyq/group4/tamil']) {
      expect(shareMetaFor(path)?.title).toMatch(/^TNPSC Test Series Group 4 – /)
    }
  })

  it('maps each path once', () => {
    expect(new Set(mappedPaths).size).toBe(mappedPaths.length)
  })

  it('maps only paths the app actually routes', () => {
    const literal = new Set([...publicRoutes, ...shellRoutes])
    for (const path of mappedPaths) {
      if (literal.has(path)) continue
      // The section-wise PYQ groups share /test-arena/pyq/:group(/:section).
      const m = path.match(/^\/test-arena\/pyq\/([^/]+)(?:\/([^/]+))?$/)
      const group = m ? PYQ_GROUPS[m[1] as keyof typeof PYQ_GROUPS] : undefined
      expect(group, path).toBeDefined()
      if (m?.[2]) expect(group!.sections.map(pyqSectionSlug), path).toContain(m[2])
    }
  })

  it('covers every section of every section-wise PYQ group', () => {
    for (const group of Object.values(PYQ_GROUPS)) {
      expect(shareMetaFor(`/test-arena/pyq/${group.key}`), group.key).not.toBeNull()
      for (const section of group.sections) {
        const path = `/test-arena/pyq/${group.key}/${pyqSectionSlug(section)}`
        const meta = shareMetaFor(path)
        expect(meta, path).not.toBeNull()
        expect(meta!.title).toContain(SHARE_GROUP_LABEL[group.key as ShareGroup])
      }
    }
  })

  it('makes every new public route choose: its own preview, or the default on purpose', () => {
    for (const path of publicRoutes) {
      expect(
        mappedPaths.includes(path) || DEFAULT_PREVIEW_OK.includes(path),
        `${path} has no preview in lib/shareMeta — add one, or list it in DEFAULT_PREVIEW_OK`,
      ).toBe(true)
    }
  })

  it('keeps the default preview from naming a single group', () => {
    const title = ogTitle(indexHtml)!
    expect(title).toBeTruthy()
    expect(groupNumbers(title)).toEqual(['1'])
    expect(title).toContain('1, 2 & 4')
  })
})

describe('applyShareMeta', () => {
  const meta = { title: 'Group 1 – Tests & "PYQs"', description: 'Mocks & more <here>' }
  const out = applyShareMeta(indexHtml, '/group-1', meta)

  it('swaps every preview tag and escapes the values', () => {
    expect(out).toContain('<title>Group 1 – Tests &amp; &quot;PYQs&quot; – TNPSC Mentors</title>')
    expect(ogTitle(out)).toBe('Group 1 – Tests &amp; &quot;PYQs&quot;')
    expect(out).toMatch(/name="twitter:title"\s+content="Group 1 – Tests &amp; &quot;PYQs&quot;"/)
    expect(out).toMatch(/name="description"\s+content="Mocks &amp; more &lt;here&gt;"/)
    expect(out).toMatch(/property="og:description"\s+content="Mocks &amp; more &lt;here&gt;"/)
    expect(out).toMatch(/name="twitter:description"\s+content="Mocks &amp; more &lt;here&gt;"/)
    expect(out).toContain('<meta property="og:url" content="https://tnpscmentors.in/group-1" />')
  })

  it('leaves the rest of the document alone', () => {
    const body = (html: string) => html.slice(html.indexOf('<body>'))
    expect(body(out)).toBe(body(indexHtml))
    expect(out.split('<meta').length).toBe(indexHtml.split('<meta').length)
    expect(out).toContain('"@type": "EducationalOrganization"')
  })

  it('fails loudly when index.html loses a tag it swaps', () => {
    const noOgUrl = indexHtml.replace(/<meta property="og:url"[^>]*>/, '')
    expect(() => applyShareMeta(noOgUrl, '/group-1', meta)).toThrow(/og:url/)
  })
})

describe('sharePages', () => {
  const pages = sharePages()
  const paths = pages.map((p) => p.path)

  it('writes every mapped path, once, with its preview', () => {
    expect(new Set(paths).size).toBe(paths.length)
    for (const path of mappedPaths) {
      expect(pages.find((p) => p.path === path)?.meta, path).toEqual(shareMetaFor(path))
    }
  })

  it("writes a page for every ancestor, so nginx never finds an index-less directory", () => {
    for (const path of paths) {
      const parts = path.split('/').filter(Boolean)
      for (let i = 1; i < parts.length; i++) {
        expect(paths, path).toContain('/' + parts.slice(0, i).join('/'))
      }
    }
    // An ancestor with no preview of its own keeps the default tags.
    expect(pages.find((p) => p.path === '/test-arena')?.meta).toBeNull()
  })
})
