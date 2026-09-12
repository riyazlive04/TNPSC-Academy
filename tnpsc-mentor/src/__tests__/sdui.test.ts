import { describe, expect, it } from 'vitest'
import { isAllowedRoute, isAllowedUrl, sanitizeLayout } from '../lib/sdui/validate'
import { matches, resolveText } from '../lib/sdui/conditions'
import type { SduiContext } from '../lib/sdui/context'

// The SDUI layer decides what a published row is allowed to draw and do on a
// student's phone, with no release in between. These tests cover the two
// properties the whole design rests on: a bad layout degrades to the built-in
// screen, and a layout can never point a tap somewhere the app wouldn't.

const ctx = (over: Partial<SduiContext> = {}): SduiContext => ({
  lang: 'en',
  platform: 'android',
  app_version: '2.0.7',
  role: 'user',
  premium: false,
  vettri: false,
  unlimited: false,
  rank_booster: false,
  mock_pack: false,
  signed_in: true,
  credits: 30,
  tests_taken: 4,
  streak: 2,
  days_since_signup: 9,
  hour: 20,
  name: 'Kavya',
  ...over,
})

describe('sanitizeLayout', () => {
  it('keeps a well-formed tree', () => {
    const { layout } = sanitizeLayout({
      key: 'home.banners',
      revision: 3,
      nodes: [{ type: 'banner', props: { title: 'Hi' }, action: { kind: 'navigate', to: '/mock' } }],
    })
    expect(layout?.nodes).toHaveLength(1)
    expect(layout?.revision).toBe(3)
    expect(layout?.nodes[0].action).toEqual({ kind: 'navigate', to: '/mock' })
  })

  it('drops an unknown component but keeps its siblings', () => {
    // Forward compatibility: an older build must render the parts it knows
    // rather than losing the whole region to a component it lacks.
    const { layout, droppedTypes } = sanitizeLayout({
      key: 'home.top',
      nodes: [{ type: 'lottie_player' }, { type: 'text', props: { text: 'still here' } }],
    })
    expect(droppedTypes).toEqual(['lottie_player'])
    expect(layout?.nodes.map((n) => n.type)).toEqual(['text'])
  })

  it('rejects the layout when nothing survives', () => {
    const { layout } = sanitizeLayout({ key: 'home.top', nodes: [{ type: 'nope' }] })
    expect(layout).toBeNull()
  })

  it('refuses garbage instead of throwing', () => {
    for (const bad of [null, undefined, 42, 'nodes', {}, { key: 'a' }, { nodes: [] }]) {
      expect(() => sanitizeLayout(bad)).not.toThrow()
      expect(sanitizeLayout(bad).layout).toBeNull()
    }
  })

  it('strips an off-app navigation but keeps the node visible', () => {
    // A wrong target must not take the banner away — it just stops being a
    // link, which is a copy bug rather than a missing feature.
    const { layout } = sanitizeLayout({
      key: 'k.x',
      nodes: [{ type: 'banner', props: { title: 'x' }, action: { kind: 'navigate', to: '/superadmin' } }],
    })
    expect(layout?.nodes[0].type).toBe('banner')
    expect(layout?.nodes[0].action).toBeUndefined()
  })

  it('caps runaway nesting', () => {
    let node: Record<string, unknown> = { type: 'text', props: { text: 'deep' } }
    for (let i = 0; i < 40; i++) node = { type: 'stack', children: [node] }
    const { layout } = sanitizeLayout({ key: 'k.x', nodes: [node] })
    // Survives (the outer stacks are fine) but the tree is truncated, not
    // recursed to a stack overflow.
    let depth = 0
    let cursor = layout?.nodes[0]
    while (cursor?.children?.length) {
      cursor = cursor.children[0]
      depth++
    }
    expect(depth).toBeLessThanOrEqual(12)
  })

  it('clamps oversized copy rather than shipping it', () => {
    const { layout } = sanitizeLayout({
      key: 'k.x',
      nodes: [{ type: 'text', props: { text: 'a'.repeat(9000) } }],
    })
    expect(String(layout?.nodes[0].props?.text)).toHaveLength(2000)
  })
})

describe('action targets', () => {
  it('accepts the app’s own routes', () => {
    expect(isAllowedRoute('/mock')).toBe(true)
    expect(isAllowedRoute('/s/offer-week')).toBe(true)
  })

  it('rejects anything that leaves the app or is not a route', () => {
    for (const bad of [
      'https://evil.example/phish',
      '//evil.example',
      'javascript:alert(1)',
      '/crm', // staff-only desk: never a server-driven destination
      'mock',
    ]) {
      expect(isAllowedRoute(bad)).toBe(false)
    }
  })

  it('allows only https links on known hosts', () => {
    expect(isAllowedUrl('https://tnpscmentors.in/offer')).toBe(true)
    expect(isAllowedUrl('https://www.youtube.com/watch?v=x')).toBe(true)
    expect(isAllowedUrl('http://tnpscmentors.in')).toBe(false)
    // The lookalike a suffix-without-dot check would have let through.
    expect(isAllowedUrl('https://tnpscmentors.in.evil.com')).toBe(false)
  })
})

describe('when', () => {
  it('shows a node with no rule', () => {
    expect(matches(undefined, ctx())).toBe(true)
  })

  it('matches a leaf test', () => {
    expect(matches({ field: 'premium', op: 'truthy' }, ctx({ premium: true }))).toBe(true)
    expect(matches({ field: 'premium', op: 'truthy' }, ctx())).toBe(false)
    expect(matches({ field: 'credits', op: 'lt', value: 10 }, ctx({ credits: 4 }))).toBe(true)
  })

  it('combines all/any/not', () => {
    const rule = {
      all: [{ field: 'signed_in' as const, op: 'truthy' as const }],
      any: [
        { field: 'platform' as const, op: 'eq' as const, value: 'android' },
        { field: 'platform' as const, op: 'eq' as const, value: 'ios' },
      ],
      not: { field: 'unlimited' as const, op: 'truthy' as const },
    }
    expect(matches(rule, ctx())).toBe(true)
    expect(matches(rule, ctx({ unlimited: true }))).toBe(false)
    expect(matches(rule, ctx({ platform: 'web' }))).toBe(false)
  })

  it('compares versions numerically, not as strings', () => {
    const rule = { field: 'app_version' as const, op: 'version_gte' as const, value: '2.0.9' }
    expect(matches(rule, ctx({ app_version: '2.0.10' }))).toBe(true)
    expect(matches(rule, ctx({ app_version: '2.0.8' }))).toBe(false)
    // The web build reports no version and must never match a native window.
    expect(matches(rule, ctx({ app_version: '' }))).toBe(false)
  })

  it('shows content when a rule is malformed', () => {
    // Failing open is deliberate: a banner nobody can see is a bug nobody can
    // reproduce, where one shown too widely is visible immediately.
    expect(matches({} as never, ctx())).toBe(true)
  })
})

describe('resolveText', () => {
  it('picks the reader’s language', () => {
    const t = { en: 'Mock tests', ta: 'மாதிரித் தேர்வுகள்' }
    expect(resolveText(t, ctx({ lang: 'en' }))).toBe('Mock tests')
    expect(resolveText(t, ctx({ lang: 'ta' }))).toBe('மாதிரித் தேர்வுகள்')
    expect(resolveText(t, ctx({ lang: 'both' }))).toBe('Mock tests / மாதிரித் தேர்வுகள்')
  })

  it('falls back to English when the Tamil is missing', () => {
    expect(resolveText({ en: 'Only English' }, ctx({ lang: 'ta' }))).toBe('Only English')
  })

  it('interpolates only the two known tokens', () => {
    expect(resolveText('Hi {name}, {credits} left', ctx())).toBe('Hi Kavya, 30 left')
    expect(resolveText('{secret}', ctx())).toBe('{secret}')
  })
})
