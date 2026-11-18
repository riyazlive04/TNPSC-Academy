import { describe, expect, it } from 'vitest'
import {
  MAGAZINE_SECTION_ORDER, sectionLabel, isSectionEcho, parseBullets,
} from '../lib/caMagazine'
// @ts-expect-error — plain .mjs twin used by the public CA archive build
import * as ca from '../../scripts/ca-archive/sections.mjs'

// The public archive (scripts/ca-archive) renders magazine sections outside Vite,
// so it carries a JS twin of these helpers. A student must see the same section
// names, the same hidden echo titles and the same bullets in the app and on the
// public page — these tests fail the moment the two drift.
describe('ca-archive sections.mjs matches src/lib/caMagazine.ts', () => {
  it('has the same section order', () => {
    expect(ca.MAGAZINE_SECTION_ORDER).toEqual(MAGAZINE_SECTION_ORDER)
  })

  it('labels every section the same in English and Tamil', () => {
    for (const key of MAGAZINE_SECTION_ORDER) {
      const [en, ta] = ca.sectionLabels(key)
      expect(en).toBe(sectionLabel(key, 'en'))
      expect(ta).toBe(sectionLabel(key, 'ta'))
    }
  })

  it('treats the same titles as section echoes', () => {
    const titles = ['TNPSC BITS', 'TNPSC CABITS', 'tnpsc  bits', 'TNPSC துளிகள்', 'Tamil Nadu', 'Some headline']
    for (const key of MAGAZINE_SECTION_ORDER) {
      for (const t of titles) expect(ca.isSectionEcho(t, key)).toBe(isSectionEcho(t, key))
    }
  })

  it('parses bullets identically', () => {
    const md = '- **Top** level\n  - nested\n    - deeper\n\nplain line\n-   spaced'
    expect(ca.parseBullets(md)).toEqual(parseBullets(md))
  })

  it('maps question topics back to magazine sections', () => {
    expect(ca.sectionKeyForTopic('Tamil Nadu')).toBe('TAMIL NADU')
    expect(ca.sectionKeyForTopic('Personalities, Awards and Events')).toBe('PERSONALITIES, AWARDS, AND EVENTS')
    expect(ca.sectionKeyForTopic('Nonexistent')).toBeNull()
  })
})
