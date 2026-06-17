import { jsPDF } from 'jspdf'
import type { DisplayLang, Question } from '../types'
import { LETTERS, displayQuestion, displayOption, displayExplanation } from '../types'

const NAVY: [number, number, number] = [13, 27, 42] // #0D1B2A
const BLUE: [number, number, number] = [13, 71, 161] // #0D47A1
const GREEN: [number, number, number] = [22, 163, 74]
const GREY: [number, number, number] = [90, 90, 90]

// Tamil glyphs can't be drawn with jsPDF's built-in Helvetica. We lazily fetch a
// Noto Sans Tamil TTF (which also covers Latin) at runtime and embed it. The
// base64 is cached across calls. `undefined` = not attempted, `null` = failed.
const TAMIL_FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansTamil/NotoSansTamil-Regular.ttf'
let tamilFontB64: string | null | undefined

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadTamilFontB64(): Promise<string | null> {
  if (tamilFontB64 !== undefined) return tamilFontB64
  try {
    const res = await fetch(TAMIL_FONT_URL)
    if (!res.ok) throw new Error(`font ${res.status}`)
    tamilFontB64 = arrayBufferToBase64(await res.arrayBuffer())
  } catch {
    tamilFontB64 = null
  }
  return tamilFontB64
}

interface QuestionBankPdfParams {
  questions: Question[]
  /** Title shown under the header band (e.g. "Outer Questions · Polity"). */
  label: string
  /** UI language - drives which language the PDF content is rendered in. */
  lang?: DisplayLang
  /** Optional faint horizontal watermark drawn across the centre of every page. */
  watermark?: string
}

/**
 * Generates and auto-downloads an answer-key PDF for a set of questions: each
 * question with its options (the correct one marked) and explanation. Unlike
 * the per-test report it needs no score/answers - it's a plain study/print
 * export of the bank, used by the admin Outer-questions view.
 */
export async function generateQuestionBankPdf({
  questions,
  label,
  lang = 'en',
  watermark,
}: QuestionBankPdfParams): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  let bodyFont = 'helvetica'
  let effLang: DisplayLang = lang
  if (lang !== 'en') {
    const b64 = await loadTamilFontB64()
    if (b64) {
      doc.addFileToVFS('NotoSansTamil.ttf', b64)
      doc.addFont('NotoSansTamil.ttf', 'NotoSansTamil', 'normal')
      doc.addFont('NotoSansTamil.ttf', 'NotoSansTamil', 'bold')
      doc.addFont('NotoSansTamil.ttf', 'NotoSansTamil', 'italic')
      bodyFont = 'NotoSansTamil'
    } else {
      effLang = 'en'
    }
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 24) {
      addFooter(doc, pageW, pageH, margin)
      doc.addPage()
      y = margin
    }
  }

  // ── Header band ──
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, pageW, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('TNPSC Mentor - Question Bank', margin, 44)
  y = 92

  doc.setTextColor(...NAVY)
  doc.setFont(bodyFont, 'bold')
  doc.setFontSize(13)
  doc.text(label, margin, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  doc.text(`${questions.length} questions   |   Date: ${new Date().toLocaleString()}`, margin, y)
  y += 22
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageW - margin, y)
  y += 18

  questions.forEach((q, idx) => {
    const qLines = doc.splitTextToSize(`${idx + 1}. ${displayQuestion(q, effLang)}`, contentW)
    ensureSpace(qLines.length * 14 + 80)

    doc.setTextColor(...NAVY)
    doc.setFont(bodyFont, 'bold')
    doc.setFontSize(11)
    doc.text(qLines, margin, y)
    y += qLines.length * 14 + 4

    doc.setFont(bodyFont, 'normal')
    doc.setFontSize(10)
    LETTERS.forEach((letter) => {
      const isCorrect = q.correct_answer === letter
      doc.setTextColor(...(isCorrect ? GREEN : NAVY))
      const optLines = doc.splitTextToSize(
        `${letter}. ${displayOption(q, letter, effLang)}${isCorrect ? '   [Correct]' : ''}`,
        contentW - 12
      )
      ensureSpace(optLines.length * 12 + 4)
      doc.text(optLines, margin + 12, y)
      y += optLines.length * 12 + 2
    })

    const explanation = displayExplanation(q, effLang)
    if (explanation) {
      y += 4
      doc.setFont(bodyFont, 'italic')
      doc.setFontSize(9.5)
      doc.setTextColor(...GREY)
      const expLines = doc.splitTextToSize(`Explanation: ${explanation}`, contentW - 8)
      ensureSpace(expLines.length * 12 + 8)
      doc.text(expLines, margin + 4, y)
      y += expLines.length * 12
    }

    y += 14
    doc.setDrawColor(235, 235, 235)
    doc.line(margin, y - 6, pageW - margin, y - 6)
  })

  addFooter(doc, pageW, pageH, margin)

  if (watermark) addWatermark(doc, pageW, pageH, watermark)

  const safe = label.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)
  doc.save(`TNPSC_Mentor_${safe || 'QuestionBank'}.pdf`)
}

/** Draws a faint, horizontal watermark across the centre of every page. Done as
 *  a final pass (over all pages) so it never disturbs the content font state. */
function addWatermark(doc: jsPDF, pageW: number, pageH: number, text: string) {
  // jsPDF's GState (opacity) isn't in the type defs - access it loosely.
  const g = doc as unknown as {
    GState?: new (o: { opacity: number }) => unknown
    setGState?: (s: unknown) => void
  }
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    if (g.GState && g.setGState) g.setGState(new g.GState({ opacity: 0.07 }))
    doc.setTextColor(...BLUE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(58)
    doc.text(text, pageW / 2, pageH / 2, { align: 'center', baseline: 'middle' })
    if (g.GState && g.setGState) g.setGState(new g.GState({ opacity: 1 }))
  }
}

function addFooter(doc: jsPDF, pageW: number, pageH: number, margin: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  const page = doc.getNumberOfPages()
  doc.text(
    '✳ TNPSC MENTOR - Prepare smart. Score high.',
    margin,
    pageH - margin + 8
  )
  doc.text(`Page ${page}`, pageW - margin - 30, pageH - margin + 8)
}
