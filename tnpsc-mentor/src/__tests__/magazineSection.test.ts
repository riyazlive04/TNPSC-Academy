import { describe, it, expect } from 'vitest'
import { displayItemTitle, isSectionEcho, sectionLabel } from '../lib/caMagazine'

// The round-up row of a section is pushed titled after its own section, and the
// app hides that echo so the item doesn't repeat the heading above it. The
// section was renamed for display (TNPSC BITS → TNPSC CABITS) while the pipeline
// keeps pushing the old key, so the match has to span BOTH names — otherwise the
// rename brings the duplicate heading back for every reader.

const BITS = 'TNPSC BITS' // the stored topic key — never renamed

describe('magazine section labels', () => {
  it('displays the renamed section', () => {
    expect(sectionLabel(BITS, 'en')).toBe('TNPSC CABITS')
  })

  it('treats every name of the section as an echo', () => {
    expect(isSectionEcho('TNPSC BITS', BITS)).toBe(true) // as the pipeline pushes it
    expect(isSectionEcho('TNPSC CABITS', BITS)).toBe(true) // once renamed in place
    expect(isSectionEcho('  tnpsc   cabits ', BITS)).toBe(true) // case/spacing noise
    expect(isSectionEcho('TNPSC துளிகள்', BITS)).toBe(true) // the Tamil twin
  })

  it('leaves a real headline alone', () => {
    expect(isSectionEcho('Tamil Nadu tops the index', BITS)).toBe(false)
    // A garbled title is NOT an echo — it must stay visible rather than vanish.
    expect(isSectionEcho('TNBITSPSC', BITS)).toBe(false)
  })

  it('renames an echo title, and only an echo title', () => {
    expect(displayItemTitle('TNPSC BITS', BITS)).toBe('TNPSC CABITS')
    expect(displayItemTitle('Cabinet approves the scheme', BITS)).toBe('Cabinet approves the scheme')
    expect(displayItemTitle('', BITS)).toBe('')
  })

  it('does not confuse one section with another', () => {
    expect(isSectionEcho('TNPSC BITS', 'NATIONAL')).toBe(false)
    expect(isSectionEcho('National', 'NATIONAL')).toBe(true)
  })
})
