import { describe, it, expect } from 'vitest'
import { parseSolution } from '../lib/aptitudeSolution'

/**
 * The Group 4 importer (server/import_pyq4.mjs) flattens the source's structured
 * worked solutions into the sectioned text convention parseSolution() reads.
 * These lock that contract: the emitted shape must parse into Given / working /
 * Asked sections with the answer letter recovered from the trailing marker.
 */
const EN = [
  'Given:',
  'e is a non-zero real number (base)',
  'Exponent = 0',
  'From question:',
  'Any non-zero base raised to the power 0 equals 1 (law of indices)',
  'Formula: $a^{0}$ = 1 (a ≠ 0)',
  '$e^{0}$ = 1',
  'Asked:',
  'Value of e⁰',
  '= 1 → Option (B)',
].join('\n')

const TA = [
  'தரவுகள்:',
  'e ஒரு மெய்யெண்',
  'தீர்வு:',
  'சூத்திரம்: $a^{0}$ = 1',
  'கேட்டது:',
  '= 1 → விடை (B)',
].join('\n')

describe('pyq4 flattened worked solutions', () => {
  it('parses the English shape into sections with the answer letter', () => {
    const r = parseSolution(EN)
    expect(r.sectioned).toBe(true)
    expect(r.answerLetter).toBe('B')
    expect(r.sections.map((s) => s.key)).toEqual(['given', 'working', 'asked'])
    // The "Formula:" line is emphasised, not left as a plain step.
    const working = r.sections.find((s) => s.key === 'working')!
    expect(working.lines.some((l) => l.kind === 'formula' && l.label === 'Formula')).toBe(true)
    // The option marker is stripped off the final line, not left inline.
    const asked = r.sections.find((s) => s.key === 'asked')!
    expect(asked.lines.every((l) => !/option\s*\(/i.test(l.text))).toBe(true)
  })

  it('parses the Tamil shape via the Tamil section headers', () => {
    const r = parseSolution(TA)
    expect(r.sectioned).toBe(true)
    expect(r.answerLetter).toBe('B')
    expect(r.sections.map((s) => s.key)).toEqual(['given', 'working', 'asked'])
    const working = r.sections.find((s) => s.key === 'working')!
    expect(working.lines.some((l) => l.kind === 'formula')).toBe(true)
  })
})
