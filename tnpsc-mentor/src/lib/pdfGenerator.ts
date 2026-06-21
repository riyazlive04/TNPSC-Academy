import { jsPDF } from 'jspdf'
import type { DisplayLang, Question } from '../types'
import { optionLetters, displayQuestion, displayOption, displayExplanation } from '../types'

// Palette mirrors the app's violet theme (src/index.css --c-* tokens) so the
// exported PDF feels like a printed extension of the UI.
type RGB = [number, number, number]
const VIOLET: RGB = [124, 92, 255] // --c-brand
const VIOLET_DEEP: RGB = [76, 29, 149] // --c-brand-deep
const VIOLET_SOFT: RGB = [238, 235, 254] // --c-brand-soft
const INK: RGB = [24, 20, 43] // --c-ink
const GREY: RGB = [110, 108, 124]
const LINE: RGB = [232, 230, 243] // --c-line
const MINT: RGB = [22, 163, 74] // --c-mint (correct)
const MINT_SOFT: RGB = [231, 247, 238] // --c-mint-soft
const WHITE: RGB = [255, 255, 255]

// Tamil glyphs can't be drawn with jsPDF's built-in Helvetica, so we lazily
// fetch a Tamil TTF at runtime and embed it (base64 cached across calls;
// `undefined` = not attempted, `null` = failed).
//
// IMPORTANT: must be a font that covers BOTH Tamil AND Latin. Noto Sans Tamil
// has no Latin glyphs, and jsPDF (no complex-script fallback) silently drops the
// rest of a string at the first missing glyph — so every Tamil string with an
// embedded Latin token (FIDE, ATP, US, names, the "en / ta" bilingual options)
// got truncated mid-line. Hind Madurai (OFL) covers Tamil + Latin + digits.
const TAMIL_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindmadurai/HindMadurai-Regular.ttf'
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

/** jsPDF's GState (opacity) isn't in the type defs — access it loosely. */
function setOpacity(doc: jsPDF, opacity: number) {
  const g = doc as unknown as {
    GState?: new (o: { opacity: number }) => unknown
    setGState?: (s: unknown) => void
  }
  if (g.GState && g.setGState) g.setGState(new g.GState({ opacity }))
}

interface QuestionBankPdfParams {
  questions: Question[]
  /** Sub-title shown under the main heading (e.g. "Outer Questions · Polity"). */
  label: string
  /** Main heading on the cover band. Defaults to "Question Bank". */
  title?: string
  /** UI language - drives which language the PDF content is rendered in. */
  lang?: DisplayLang
  /** Optional faint diagonal watermark tiled across every page. */
  watermark?: string
}

/**
 * Generates and auto-downloads a polished study PDF for a set of questions: each
 * question with its options (the correct one highlighted) and explanation,
 * styled to match the app's violet theme. Used both for the admin question-bank
 * export and the post-test "Explanation Sheet".
 */
export async function generateQuestionBankPdf({
  questions,
  label,
  title = 'Question Bank',
  lang = 'en',
  watermark,
}: QuestionBankPdfParams): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 42
  const gutter = 34 // left column reserved for the question-number badge
  const colX = margin + gutter
  const colW = pageW - margin - colX // content column width
  const footerSafe = pageH - 40 // content must stop above the footer band

  let bodyFont = 'helvetica'
  let effLang: DisplayLang = lang
  if (lang !== 'en') {
    const b64 = await loadTamilFontB64()
    if (b64) {
      doc.addFileToVFS('TamilLatin.ttf', b64)
      doc.addFont('TamilLatin.ttf', 'TamilLatin', 'normal')
      doc.addFont('TamilLatin.ttf', 'TamilLatin', 'bold')
      doc.addFont('TamilLatin.ttf', 'TamilLatin', 'italic')
      bodyFont = 'TamilLatin'
    } else {
      effLang = 'en'
    }
  }

  let y = 0
  const newPage = () => {
    doc.addPage()
    y = margin + 6
  }
  const ensureSpace = (needed: number) => {
    if (y + needed > footerSafe) newPage()
  }

  // ── Cover band ───────────────────────────────────────────────────────────
  const drawHeaderBand = () => {
    doc.setFillColor(...VIOLET_DEEP)
    doc.rect(0, 0, pageW, 96, 'F')
    doc.setFillColor(...VIOLET)
    doc.rect(0, 0, pageW, 6, 'F') // top accent strip
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TNPSC MENTOR', margin, 34)
    doc.setFontSize(22)
    doc.text(title, margin, 62)
    // sub-title (label) in the band, may need the Tamil font
    doc.setFont(bodyFont, 'normal')
    doc.setFontSize(11)
    setOpacity(doc, 0.85)
    const sub = doc.splitTextToSize(label, pageW - margin * 2)
    doc.text(sub[0] ?? '', margin, 82)
    setOpacity(doc, 1)
  }
  drawHeaderBand()
  y = 120

  // Meta line
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...GREY)
  doc.text(
    `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}   ·   Generated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`,
    margin,
    y
  )
  y += 16
  doc.setDrawColor(...LINE)
  doc.setLineWidth(1)
  doc.line(margin, y, pageW - margin, y)
  y += 22

  // ── Questions ────────────────────────────────────────────────────────────
  questions.forEach((q, idx) => {
    // Measure the question text so the whole header (badge + text) can move to a
    // new page together rather than orphaning the badge.
    doc.setFont(bodyFont, 'bold')
    doc.setFontSize(11.5)
    const qLines = doc.splitTextToSize(displayQuestion(q, effLang), colW)
    const qLineH = 15
    ensureSpace(qLines.length * qLineH + 46)

    // Number badge — violet rounded square with white "Qn"
    const badgeY = y - 11
    doc.setFillColor(...VIOLET)
    doc.roundedRect(margin, badgeY, gutter - 10, 19, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text(`Q${idx + 1}`, margin + (gutter - 10) / 2, badgeY + 13, { align: 'center' })

    // Question text
    doc.setFont(bodyFont, 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...INK)
    doc.text(qLines, colX, y)
    y += qLines.length * qLineH + 6

    // Options — correct one sits on a mint pill with a check mark
    doc.setFontSize(10)
    const optLineH = 13
    optionLetters(q).forEach((letter) => {
      const optText = displayOption(q, letter, effLang)
      if (!optText) return
      const isCorrect = q.correct_answer === letter
      const optLines = doc.splitTextToSize(`${letter}.  ${optText}`, colW - 22)
      const blockH = optLines.length * optLineH + 6
      ensureSpace(blockH + 2)
      if (isCorrect) {
        doc.setFillColor(...MINT_SOFT)
        doc.roundedRect(colX - 6, y - 10, colW + 6, blockH, 4, 4, 'F')
      }
      doc.setFont(bodyFont, isCorrect ? 'bold' : 'normal')
      doc.setTextColor(...(isCorrect ? MINT : INK))
      doc.text(optLines, colX, y)
      if (isCorrect) {
        // Vector checkmark (glyph ✓ isn't in jsPDF's WinAnsi font set).
        const cx = pageW - margin - 13
        const cy = y - 3
        doc.setDrawColor(...MINT)
        doc.setLineWidth(1.4)
        doc.line(cx - 4, cy, cx - 1.5, cy + 3)
        doc.line(cx - 1.5, cy + 3, cx + 4, cy - 4)
      }
      y += blockH
    })

    // Explanation — violet-tinted card with a left accent bar
    const explanation = displayExplanation(q, effLang)
    if (explanation) {
      y += 6
      doc.setFont(bodyFont, 'normal')
      doc.setFontSize(9.5)
      const padX = 10
      const expW = colW - padX * 2
      const labelH = 14
      const expBodyH = 12
      const expLines = doc.splitTextToSize(explanation, expW)
      const boxH = labelH + expLines.length * expBodyH + 12
      ensureSpace(boxH + 4)
      const boxY = y - 2
      doc.setFillColor(...VIOLET_SOFT)
      doc.roundedRect(colX, boxY, colW, boxH, 6, 6, 'F')
      doc.setFillColor(...VIOLET)
      doc.roundedRect(colX, boxY, 4, boxH, 2, 2, 'F') // accent bar
      // label
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...VIOLET)
      doc.text('EXPLANATION', colX + padX, boxY + 13)
      // body
      doc.setFont(bodyFont, 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(60, 56, 80)
      doc.text(expLines, colX + padX, boxY + labelH + 9)
      y = boxY + boxH
    }

    // Separator between questions
    y += 14
    if (idx < questions.length - 1) {
      ensureSpace(12)
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.7)
      doc.line(margin, y - 7, pageW - margin, y - 7)
    }
  })

  // ── Final pass: watermark + footer on every page ─────────────────────────
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    if (watermark) drawWatermark(doc, pageW, pageH, watermark)
    drawFooter(doc, pageW, pageH, margin, i, total)
  }

  const safe = (title + '_' + label).replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  doc.save(`TNPSC_Mentor_${safe || 'QuestionBank'}.pdf`)
}

/** Faint diagonal watermark tiled across the page. */
function drawWatermark(doc: jsPDF, pageW: number, pageH: number, text: string) {
  setOpacity(doc, 0.05)
  doc.setTextColor(...VIOLET)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  const stepX = 260
  const stepY = 150
  for (let yy = 120; yy < pageH; yy += stepY) {
    for (let xx = 20; xx < pageW; xx += stepX) {
      doc.text(text, xx, yy, { angle: 30 })
    }
  }
  setOpacity(doc, 1)
}

function drawFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  page: number,
  total: number
) {
  const y = pageH - 26
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.line(margin, y - 8, pageW - margin, y - 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  doc.text('TNPSC Mentor  ·  Prepare smart. Score high.', margin, y)
  doc.text(`Page ${page} of ${total}`, pageW - margin, y, { align: 'right' })
}
