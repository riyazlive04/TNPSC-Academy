import { describe, expect, it } from 'vitest'
import { MOCK_PACK_FREE_CATEGORIES } from '../lib/credits.js'

/**
 * The ₹399 Group 1 Mock Test Pack draws Group 1 previous-year questions without
 * spending credits.
 *
 * This is a FOURTH way of saying "does this person pay for this draw", next to
 * `unlimited`, `creditsUnlimited` and `mockUnlocked` (see mockAccess.test.ts).
 * Getting it wrong is expensive in both directions: too wide and a ₹399 plan
 * quietly hands over Current Affairs and subject practice that Premium and
 * Vettri are sold on; too narrow and the plan bills credits for the bank its
 * own banner advertises as unlimited.
 *
 * The rule under test is the expression in routes/questions.ts isUnlimited():
 *   creditsUnlimited || (category && mockPack && MOCK_PACK_FREE_CATEGORIES ∋ category)
 */
const drawsFree = (
  p: { creditsUnlimited: boolean; mockPack: boolean },
  category?: string
): boolean =>
  p.creditsUnlimited ||
  (!!category && p.mockPack && MOCK_PACK_FREE_CATEGORIES.includes(category))

describe('Mock Pack — free Group 1 PYQ draws', () => {
  const free = { creditsUnlimited: false, mockPack: false }
  const pack = { creditsUnlimited: false, mockPack: true }

  it('charges a free learner for Group 1 PYQ', () => {
    expect(drawsFree(free, 'pyq')).toBe(false)
  })

  it('does not charge a Mock Pack owner for Group 1 PYQ', () => {
    expect(drawsFree(pack, 'pyq')).toBe(true)
  })

  it('still charges a Mock Pack owner for every other bank', () => {
    // The whole point of a category list rather than folding mockPack into
    // creditsUnlimited: a ₹399 plan must not silently include the banks the
    // ₹1,899 and ₹1,699 plans are sold on.
    for (const category of [
      'current_affairs',
      'subject',
      'aptitude',
      'samacheer',
      'mock',
      'testseries',
    ]) {
      expect(drawsFree(pack, category)).toBe(false)
    }
  })

  it('does not leak into the Group 2 and Group 4 PYQ banks', () => {
    // Those are separate products ('pyq2' / 'pyq4'). The copy says "Group 1
    // PYQs", and a near-miss on a category string is exactly how that would
    // stop being true without anyone noticing.
    expect(drawsFree(pack, 'pyq2')).toBe(false)
    expect(drawsFree(pack, 'pyq4')).toBe(false)
  })

  it('charges when no category is known, rather than guessing', () => {
    // Mock exams and the starter challenge call the gate without a category;
    // an undefined category must never be treated as a free bank.
    expect(drawsFree(pack, undefined)).toBe(false)
    expect(drawsFree(pack, '')).toBe(false)
  })

  it('leaves an unlimited plan unlimited regardless of category', () => {
    const premium = { creditsUnlimited: true, mockPack: false }
    expect(drawsFree(premium, 'current_affairs')).toBe(true)
    expect(drawsFree(premium, undefined)).toBe(true)
  })
})
