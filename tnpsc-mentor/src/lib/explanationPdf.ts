import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { DisplayLang, Question } from '../types'
import { LETTERS, displayQuestion, displayOption, displayExplanation } from '../types'

/**
 * Explanation-sheet PDF generator that renders each question as real HTML and
 * snapshots it with html2canvas, instead of drawing text with jsPDF directly.
 *
 * WHY: jsPDF has no complex-script shaping, so Tamil vowel signs (ெ/ே/ை, the
 * ◌ு/◌ூ ligatures) come out scrambled. The browser DOES shape Tamil correctly
 * (it's the same engine rendering the app UI), so we let it lay the text out and
 * just capture the pixels. Runs 100% client-side — no server cost at scale.
 *
 * Each question is captured as its OWN image so pagination never cuts a question
 * mid-line: we measure each block and start a new page when it won't fit.
 */

// Palette mirrors the app's violet theme (src/index.css --c-* tokens).
const VIOLET = '#7C5CFF'
const VIOLET_DEEP = '#4C1D95'
const VIOLET_SOFT = '#EEEBFE'
const INK = '#18142B'
const MINT = '#16A34A'
const MINT_SOFT = '#E7F7EE'
const LINE = '#E8E6F3'
const GREY: [number, number, number] = [110, 108, 124]
const LINE_RGB: [number, number, number] = [232, 230, 243]
const VIOLET_RGB: [number, number, number] = [124, 92, 255]

// The Tamil-capable font the app already loads (index.html / .tamil class). The
// browser shapes Tamil correctly with it; html2canvas captures that.
const FONT_STACK = "'Noto Sans Tamil','Inter',system-ui,sans-serif"
// Off-screen render width in CSS px. Maps to the A4 content width in points.
const RENDER_W = 760

interface ExplanationPdfParams {
  questions: Question[]
  /** Sub-title under the heading (e.g. "Current Affairs · Sports"). */
  label: string
  title?: string
  lang?: DisplayLang
  watermark?: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Build the inner HTML for one question block (question, options, explanation). */
function questionBlockHtml(q: Question, index: number, lang: DisplayLang): string {
  const optionRows = LETTERS.map((letter) => {
    const text = displayOption(q, letter, lang)
    if (!text) return ''
    const isCorrect = q.correct_answer === letter
    const bg = isCorrect ? MINT_SOFT : 'transparent'
    const color = isCorrect ? MINT : INK
    const weight = isCorrect ? 600 : 400
    const check = isCorrect
      ? `<span style="float:right;color:${MINT};font-weight:700">&#10003;</span>`
      : ''
    return `<div style="background:${bg};color:${color};font-weight:${weight};border-radius:7px;padding:5px 10px;margin:3px 0;font-size:14px;line-height:1.45">
      <span style="font-weight:700">${letter}.</span> ${esc(text)} ${check}
    </div>`
  }).join('')

  const explanation = displayExplanation(q, lang)
  const explHtml = explanation
    ? `<div style="background:${VIOLET_SOFT};border-left:4px solid ${VIOLET};border-radius:8px;padding:10px 12px;margin-top:8px">
        <div style="color:${VIOLET};font-weight:700;font-size:10px;letter-spacing:.5px;margin-bottom:3px">EXPLANATION</div>
        <div style="color:#3C3850;font-size:13px;line-height:1.5;white-space:pre-line">${esc(explanation)}</div>
      </div>`
    : ''

  return `<div style="padding:14px 4px;border-bottom:1px solid ${LINE}">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <span style="flex:0 0 auto;background:${VIOLET};color:#fff;font-weight:700;font-size:11px;border-radius:5px;padding:2px 7px">Q${index + 1}</span>
      <div style="font-weight:700;color:${INK};font-size:15px;line-height:1.5;white-space:pre-line">${esc(displayQuestion(q, lang))}</div>
    </div>
    <div style="margin-top:8px">${optionRows}</div>
    ${explHtml}
  </div>`
}

function coverHtml(title: string, label: string, count: number): string {
  return `<div style="background:${VIOLET_DEEP};color:#fff;padding:18px 16px 16px;border-top:6px solid ${VIOLET}">
      <div style="font-size:11px;font-weight:700;letter-spacing:.5px">TNPSC MENTOR</div>
      <div style="font-size:24px;font-weight:800;margin-top:4px">${esc(title)}</div>
      <div style="font-size:13px;opacity:.85;margin-top:6px">${esc(label)}</div>
    </div>
    <div style="color:#6E6C7C;font-size:11px;padding:8px 4px;border-bottom:1px solid ${LINE}">
      ${count} ${count === 1 ? 'question' : 'questions'} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
    </div>`
}

/** Render one off-screen HTML string to a canvas via html2canvas. */
async function htmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W}px;background:#fff;font-family:${FONT_STACK}`
  host.innerHTML = html
  document.body.appendChild(host)
  try {
    return await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  } finally {
    document.body.removeChild(host)
  }
}

export async function generateExplanationPdf({
  questions,
  label,
  title = 'Explanation Sheet',
  lang = 'en',
  watermark,
}: ExplanationPdfParams): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentW = pageW - margin * 2
  const footerSafe = pageH - 40

  // JPEG (not PNG) keeps the file small — a 2-question PNG export was ~13 MB;
  // JPEG q0.85 is ~0.6 MB with no visible loss on text/UI.
  const toJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.85)

  let y = margin
  const placeCanvas = (canvas: HTMLCanvasElement, topMargin = margin) => {
    const hPt = (canvas.height / canvas.width) * contentW
    if (y + hPt > footerSafe) {
      doc.addPage()
      y = topMargin
    }
    doc.addImage(toJpeg(canvas), 'JPEG', margin, y, contentW, hPt)
    y += hPt
  }

  // Cover (HTML so a Tamil sub-title shapes correctly).
  const cover = await htmlToCanvas(coverHtml(title, label, questions.length))
  // Cover spans full width incl. the colored band — bleed it to the page edges.
  const coverHPt = (cover.height / cover.width) * pageW
  doc.addImage(toJpeg(cover), 'JPEG', 0, 0, pageW, coverHPt)
  y = coverHPt + 10

  // Each question as its own atomic image.
  for (let i = 0; i < questions.length; i++) {
    const canvas = await htmlToCanvas(questionBlockHtml(questions[i], i, lang))
    placeCanvas(canvas)
  }

  // Watermark + footer on every page (Latin only → safe in jsPDF's Helvetica).
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    if (watermark) {
      const g = doc as unknown as {
        GState?: new (o: { opacity: number }) => unknown
        setGState?: (s: unknown) => void
      }
      // Higher opacity + larger font so the "NAME · PHONE" mark is clearly
      // legible (still light enough to read the content through it); spacing
      // loosened to match the bigger text and keep tiles from overlapping.
      if (g.GState && g.setGState) g.setGState(new g.GState({ opacity: 0.12 }))
      doc.setTextColor(...VIOLET_RGB)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      for (let yy = 70; yy < pageH; yy += 120)
        for (let xx = -10; xx < pageW; xx += 280) doc.text(watermark, xx, yy, { angle: 30 })
      if (g.GState && g.setGState) g.setGState(new g.GState({ opacity: 1 }))
    }
    const fy = pageH - 26
    doc.setDrawColor(...LINE_RGB)
    doc.setLineWidth(0.7)
    doc.line(margin, fy - 8, pageW - margin, fy - 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text('TNPSC Mentor  ·  Prepare smart. Score high.', margin, fy)
    doc.text(`Page ${p} of ${total}`, pageW - margin, fy, { align: 'right' })
  }

  const safe = (title + '_' + label).replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  doc.save(`TNPSC_Mentor_${safe || 'ExplanationSheet'}.pdf`)
}
