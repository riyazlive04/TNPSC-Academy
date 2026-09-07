import { describe, it, expect } from 'vitest'
import {
  OUTCOME_TO_STATUS,
  appendNote,
  cleanText,
  csvCell,
  firstResponseSecs,
  istDate,
  safeFilterTerm,
  tenDigit,
} from './crmLogic.js'

// The first server-side tests in this project. They cover the CRM decisions
// that were previously verified only by hand against production.

describe('phone normalisation', () => {
  it('accepts every shape an Indian mobile is written in', () => {
    for (const raw of ['9876543210', '+919876543210', '919876543210', '09876543210', '98765 43210']) {
      expect(tenDigit(raw)).toBe('9876543210')
    }
  })

  it('rejects anything that is not one, rather than storing junk', () => {
    // The dedupe index keys on this: a bad number must become null, not collide.
    for (const raw of ['1234567890', '98765', '', null, undefined, 'not a phone']) {
      expect(tenDigit(raw)).toBe('')
    }
  })
})

describe('PostgREST filter safety', () => {
  it('strips the characters that could rewrite the filter', () => {
    // `.or()` interpolates into query syntax, so a comma would end one
    // condition and start another of the attacker's choosing.
    expect(safeFilterTerm('a,b')).toBe('ab')
    expect(safeFilterTerm('x)or(y')).toBe('xory')
    expect(safeFilterTerm('he said "hi"')).toBe('he said hi')
    expect(safeFilterTerm('back\\slash')).toBe('backslash')
  })

  it('keeps what a real search actually needs', () => {
    // Dots are only structural BEFORE the operator, so an email must survive.
    expect(safeFilterTerm('kavitha.r@example.com')).toBe('kavitha.r@example.com')
    expect(safeFilterTerm('  Priya Dharshini  ')).toBe('Priya Dharshini')
    expect(safeFilterTerm('98765')).toBe('98765')
  })
})

describe('IST day boundary', () => {
  it('rolls to the next date at 18:30 UTC, not at midnight UTC', () => {
    // The five and a half hours after Indian midnight are the window a
    // UTC-derived "today" gets wrong — exactly when a late shift checks its
    // own numbers.
    expect(istDate(Date.parse('2026-09-07T18:29:00Z'))).toBe('2026-09-07')
    expect(istDate(Date.parse('2026-09-07T18:30:00Z'))).toBe('2026-09-08')
    expect(istDate(Date.parse('2026-09-07T23:00:00Z'))).toBe('2026-09-08')
  })
})

describe('lead notes', () => {
  it('appends rather than replacing', () => {
    // The regression this guards: a second agent silently wiped what the first
    // one learned on the call.
    const first = appendNote(null, 'Asked about fees', new Date('2026-09-01T10:00:00Z'))
    const second = appendNote(first, 'Called back, wants a demo', new Date('2026-09-05T10:00:00Z'))
    expect(second).toContain('Asked about fees')
    expect(second).toContain('wants a demo')
    expect(second.split('\n')).toHaveLength(2)
  })

  it('stamps each line with a date', () => {
    expect(appendNote(null, 'Note', new Date('2026-09-07T10:00:00Z'))).toMatch(/^\[\d+ \w+\] Note$/)
  })

  it('trims from the front, keeping the newest note', () => {
    const long = 'x'.repeat(4000)
    const out = appendNote(long, 'the newest thing they said')
    expect(out.length).toBeLessThanOrEqual(4000)
    expect(out).toContain('the newest thing they said')
  })
})

describe('first response timing', () => {
  const now = Date.parse('2026-09-07T10:00:00Z')

  it('measures from when the lead reached the desk', () => {
    // A backfilled account signed up in June but landed on the desk today; the
    // team was not three months late answering it.
    expect(
      firstResponseSecs({ created_at: '2026-06-01T00:00:00Z', entered_at: '2026-09-07T09:58:00Z' }, now)
    ).toBe(120)
  })

  it('falls back to signup date for rows predating entered_at', () => {
    expect(firstResponseSecs({ created_at: '2026-09-07T09:59:00Z' }, now)).toBe(60)
  })

  it('never returns a negative or NaN duration', () => {
    expect(firstResponseSecs({ entered_at: '2026-09-07T11:00:00Z' }, now)).toBe(0)
    expect(firstResponseSecs({ entered_at: 'nonsense' }, now)).toBe(0)
    expect(firstResponseSecs({}, now)).toBe(0)
  })
})

describe('intent outcome drives lead status', () => {
  it('maps every outcome the DB allows', () => {
    // crm_intents.outcome has a CHECK constraint listing exactly these; an
    // unmapped one would silently leave the lead's status unchanged.
    for (const outcome of [
      'interested',
      'callback',
      'converted',
      'not_interested',
      'unreachable',
      'neutral',
    ]) {
      expect(OUTCOME_TO_STATUS[outcome]).toBeTruthy()
    }
  })

  it('sends a callback to the follow-up queue and a purchase to converted', () => {
    expect(OUTCOME_TO_STATUS.callback).toBe('follow_up')
    expect(OUTCOME_TO_STATUS.converted).toBe('converted')
  })
})

describe('CSV export', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(csvCell('Raj, S')).toBe('"Raj, S"')
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvCell(null)).toBe('""')
    // A bare number would be re-typed by a spreadsheet and lose its leading 0.
    expect(csvCell('09876543210')).toBe('"09876543210"')
  })
})

describe('text cleaning', () => {
  it('trims, nulls empties, and caps length', () => {
    expect(cleanText('  hi  ')).toBe('hi')
    expect(cleanText('   ')).toBeNull()
    expect(cleanText(null)).toBeNull()
    expect(cleanText('x'.repeat(600), 500)).toHaveLength(500)
  })
})
