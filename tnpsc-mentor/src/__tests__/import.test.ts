import { describe, it, expect } from 'vitest'
import { parseImportText, validateRows } from '../lib/importQuestions'

const HEADER =
  'category,question_text,option_a,option_b,option_c,option_d,correct_answer'

describe('parseImportText - CSV', () => {
  it('parses a simple row into a keyed object', () => {
    const csv = `${HEADER}\npyq,What?,A1,B1,C1,D1,A`
    const { rows, parseError } = parseImportText('q.csv', csv)
    expect(parseError).toBeUndefined()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      category: 'pyq',
      question_text: 'What?',
      option_a: 'A1',
      correct_answer: 'A',
    })
  })

  it('handles quoted fields with commas and embedded newlines', () => {
    const csv = `${HEADER}\npyq,"Which, if any?","line1\nline2",B1,C1,D1,B`
    const { rows } = parseImportText('q.csv', csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].question_text).toBe('Which, if any?')
    expect(rows[0].option_a).toBe('line1\nline2')
  })

  it('unescapes doubled quotes', () => {
    const csv = `${HEADER}\npyq,"He said ""hi""",A1,B1,C1,D1,A`
    const { rows } = parseImportText('q.csv', csv)
    expect(rows[0].question_text).toBe('He said "hi"')
  })

  it('lower-cases headers and skips blank lines', () => {
    const csv = `CATEGORY,Question_Text,option_a,option_b,option_c,option_d,Correct_Answer\n\npyq,Q,A,B,C,D,C\n`
    const { rows } = parseImportText('q.csv', csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].category).toBe('pyq')
    expect(rows[0].correct_answer).toBe('C')
  })
})

describe('parseImportText - JSON', () => {
  it('parses a JSON array', () => {
    const json = JSON.stringify([{ category: 'aptitude', question_text: 'x' }])
    const { rows, parseError } = parseImportText('q.json', json)
    expect(parseError).toBeUndefined()
    expect(rows[0].category).toBe('aptitude')
  })

  it('flags non-array JSON', () => {
    const { parseError } = parseImportText('q.json', '{"category":"pyq"}')
    expect(parseError).toMatch(/array/i)
  })

  it('flags malformed JSON', () => {
    const { parseError } = parseImportText('q.json', '[{bad}]')
    expect(parseError).toMatch(/invalid json/i)
  })
})

describe('validateRows', () => {
  const good = {
    category: 'pyq',
    question_text: 'Q',
    option_a: 'A',
    option_b: 'B',
    option_c: 'C',
    option_d: 'D',
    correct_answer: 'b',
  }

  it('accepts a complete row and normalises the answer letter', () => {
    const { valid, errors } = validateRows([good])
    expect(errors).toHaveLength(0)
    expect(valid).toHaveLength(1)
    expect(valid[0].correct_answer).toBe('B') // upper-cased
  })

  it('reports the spreadsheet row number (header = row 1)', () => {
    const { errors } = validateRows([{ ...good, category: 'bogus' }])
    expect(errors[0].row).toBe(2)
    expect(errors[0].message).toMatch(/category/)
  })

  it('rejects an out-of-range correct_answer and empty options', () => {
    const { valid, errors } = validateRows([{ ...good, correct_answer: 'E', option_c: '' }])
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toMatch(/correct_answer/)
    expect(errors[0].message).toMatch(/option_c/)
  })

  it('validates standard and difficulty when present', () => {
    const { errors } = validateRows([{ ...good, standard: '12', difficulty: 'tricky' }])
    expect(errors[0].message).toMatch(/standard/)
    expect(errors[0].message).toMatch(/difficulty/)
  })

  it('keeps why_wrong only for non-correct letters', () => {
    const { valid } = validateRows([
      { ...good, correct_answer: 'A', why_wrong_a: 'should be dropped', why_wrong_b: 'B is wrong' },
    ])
    expect(valid[0].why_wrong).toEqual({ B: 'B is wrong' })
  })

  it('sets why_wrong to null when no reasons are given', () => {
    const { valid } = validateRows([good])
    expect(valid[0].why_wrong).toBeNull()
  })
})
