import { describe, expect, it } from 'vitest'
import {
  PDF_ATTENDANCE_GATE,
  canDownloadExplanationPdf,
  pdfBlockedBy,
  type PdfAccessInput,
} from '../lib/pdfAccess'

/**
 * Who gets offered the explanation sheet. Both failures here are silent: a
 * paying customer quietly denied the sheet they bought, or a blank PDF that
 * spends one of a free user's capped downloads.
 */

const at = (pct: number, over: Partial<PdfAccessInput> = {}): PdfAccessInput => ({
  attempted: pct,
  totalQuestions: 100,
  // The server's 25% verdict. Mirrored here rather than recomputed so a test
  // can state the two independently, which is the whole point of the series
  // branch.
  pdfUnlocked: pct >= 25,
  ...over,
})

describe('canDownloadExplanationPdf — practice tests', () => {
  it('keeps the 80% rule', () => {
    expect(canDownloadExplanationPdf(at(79))).toBe(false)
    expect(canDownloadExplanationPdf(at(80))).toBe(true)
    expect(canDownloadExplanationPdf(at(100))).toBe(true)
  })

  it('applies the rule to every non-series mode', () => {
    for (const mockKind of ['group', 'subject', 'exam', 'vettri', undefined] as const) {
      expect(canDownloadExplanationPdf(at(50, { mockKind }))).toBe(false)
      expect(canDownloadExplanationPdf(at(80, { mockKind }))).toBe(true)
    }
  })

  it('refuses an empty test instead of dividing by zero', () => {
    expect(canDownloadExplanationPdf({ attempted: 0, totalQuestions: 0, pdfUnlocked: true })).toBe(
      false
    )
  })

  it('uses the exported gate rather than a second copy of 0.8', () => {
    expect(PDF_ATTENDANCE_GATE).toBe(0.8)
    const justUnder = Math.floor(PDF_ATTENDANCE_GATE * 100) - 1
    expect(canDownloadExplanationPdf(at(justUnder))).toBe(false)
  })
})

describe('canDownloadExplanationPdf — scheduled test-series papers', () => {
  const series = (pct: number, over: Partial<PdfAccessInput> = {}) =>
    at(pct, { mockKind: 'series', ...over })

  it('has NO attendance requirement — the whole point of the change', () => {
    // A buyer who answered 30 of 200 questions still gets the sheet they paid
    // for. Under the old rule this returned false until 160.
    expect(canDownloadExplanationPdf(series(30))).toBe(true)
    expect(canDownloadExplanationPdf(series(25))).toBe(true)
    expect(canDownloadExplanationPdf(series(79))).toBe(true)
  })

  it('still needs the server to have sent explanations', () => {
    // Not a rule of ours: below 25% the grader never merges explanations or
    // correct answers onto the questions, so the sheet would come out blank and
    // would have cost a free user one of their capped downloads.
    expect(canDownloadExplanationPdf(series(10))).toBe(false)
    expect(canDownloadExplanationPdf(series(0))).toBe(false)
  })

  it('follows pdfUnlocked, not the attendance number', () => {
    // The server is the authority on whether the data is there. If it says
    // unlocked at a low attendance, the sheet has content and is offered.
    expect(canDownloadExplanationPdf(series(5, { pdfUnlocked: true }))).toBe(true)
    // And if it withholds at a high attendance, there is still nothing to print.
    expect(canDownloadExplanationPdf(series(90, { pdfUnlocked: false }))).toBe(false)
  })

  it('is unaffected by totalQuestions, including a 200-Q paper', () => {
    expect(
      canDownloadExplanationPdf({
        mockKind: 'series',
        attempted: 60,
        totalQuestions: 200,
        pdfUnlocked: true,
      })
    ).toBe(true)
  })
})

describe('pdfBlockedBy', () => {
  it('returns null when the sheet is available', () => {
    expect(pdfBlockedBy(at(80))).toBeNull()
    expect(pdfBlockedBy(at(30, { mockKind: 'series' }))).toBeNull()
  })

  it('never quotes 80% on a series paper, which has no such requirement', () => {
    // Showing "attempt at least 80%" on a paper that needs no attendance at all
    // states a rule that does not exist, which is worse than showing nothing.
    expect(pdfBlockedBy(at(10, { mockKind: 'series' }))).toBe('explanations25')
  })

  it('quotes the 80% rule on a practice test, where it is real', () => {
    expect(pdfBlockedBy(at(50))).toBe('attendance80')
  })
})
