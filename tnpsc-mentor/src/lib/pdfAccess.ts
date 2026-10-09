// ─── Explanation-PDF access ──────────────────────────────────────────────────
// Whether the result screen offers the explanation sheet for an attempt.
//
// Kept here as a pure function rather than inline in ResultPage for the same
// reason as lib/g1Access: both ways of getting this wrong are silent and
// expensive. Withhold the sheet from a paying customer who sat a scheduled
// paper and they are missing what they bought, with no error to notice; offer
// it when the server has not sent any explanations and they get a blank PDF
// that cost them one of their capped free downloads.

/** The attendance a PRACTICE test needs before the sheet is offered. */
export const PDF_ATTENDANCE_GATE = 0.8

export interface PdfAccessInput {
  /** `config.mockKind` — 'series' marks a scheduled test-series paper. */
  mockKind?: 'group' | 'subject' | 'exam' | 'series' | 'vettri'
  attempted: number
  totalQuestions: number
  /**
   * The server grader's 25% attendance verdict (`ResultPayload.pdfUnlocked`).
   * This is what decides whether explanations and correct answers were merged
   * onto the questions at all — below it there is simply nothing to put in a
   * sheet, so it is a fact about the data rather than a rule we are choosing.
   */
  pdfUnlocked: boolean
}

/**
 * A scheduled test-series paper has NO attendance requirement: it is a paid,
 * dated paper sat once, and the sheet is much of what the buyer paid for, so
 * requiring 80% of a 200-question paper withholds it from exactly the people
 * who most need to read it. It still needs `pdfUnlocked`, because without it
 * the sheet would be empty.
 *
 * Every other test keeps the 80% rule.
 */
export function canDownloadExplanationPdf(input: PdfAccessInput): boolean {
  const { mockKind, attempted, totalQuestions, pdfUnlocked } = input
  if (mockKind === 'series') return pdfUnlocked
  return totalQuestions > 0 && attempted / totalQuestions >= PDF_ATTENDANCE_GATE
}

/** Whether a blocked attempt is being held back by the 80% rule (practice) or
 *  by the 25% explanations unlock (a series paper) — they need different copy,
 *  since quoting "80%" on a paper that has no such requirement is a lie. */
export function pdfBlockedBy(input: PdfAccessInput): 'attendance80' | 'explanations25' | null {
  if (canDownloadExplanationPdf(input)) return null
  return input.mockKind === 'series' ? 'explanations25' : 'attendance80'
}
