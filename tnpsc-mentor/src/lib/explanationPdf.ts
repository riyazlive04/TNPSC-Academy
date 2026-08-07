import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { savePdfDoc } from './savePdf'
import { stampWatermark, makeWatermarkLayer } from './pdfWatermark'
import type { DisplayLang, Question, ParsedMatch } from '../types'
import {
  optionLetters,
  displayQuestion,
  displayOption,
  displayExplanation,
  parseMatchQuestion,
  formatMatchLabel,
} from '../types'

/**
 * Explanation-sheet PDF generator that renders each question as real HTML and
 * snapshots it with html2canvas, instead of drawing text with jsPDF directly.
 *
 * WHY: jsPDF has no complex-script shaping, so Tamil vowel signs (ெ/ே/ை, the
 * ◌ு/◌ூ ligatures) come out scrambled. The browser DOES shape Tamil correctly
 * (it's the same engine rendering the app UI), so we let it lay the text out and
 * just capture the pixels. Runs 100% client-side - no server cost at scale.
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

// Math delimiters — identical to MathText.tsx (the on-screen renderer) so the
// exported sheet typesets the SAME KaTeX the student sees: \( … \) / $ … $
// inline, \[ … \] / $$ … $$ display. Author a big stacked fraction with \dfrac.
const MATH_RE = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g

/**
 * A single-`$…$` span that is really a pair of literal dollar signs around prose
 * (currency, e.g. "$100 billion … $102 billion") — mirror of MathText.tsx so the
 * PDF treats it as text instead of letting KaTeX mangle the sentence.
 */
function isLiteralDollarSpan(s: string): boolean {
  if (/[\\^_{}]/.test(s)) return false
  if (/\b(billion|million|trillion|crore|lakh)\b/i.test(s)) return true
  return (s.match(/[A-Za-z]{3,}/g) ?? []).length >= 2
}

/**
 * Escape a user string AND typeset any embedded LaTeX with KaTeX, returning HTML.
 * Without this the raw TeX source ("\dfrac{22}{7}") was html-escaped and printed
 * literally, so fractions never stacked in the PDF. html2canvas snapshots the
 * KaTeX HTML (stacked fractions, √, exponents …) as pixels, same as the app UI.
 * Non-math text is escaped; a KaTeX parse error falls back to the escaped TeX.
 */
function mathHtml(raw: string | null | undefined): string {
  const text = raw ?? ''
  // Fast path: nothing that could open a math segment (matches MathText.tsx).
  if (!text.includes('\\') && !text.includes('$')) return esc(text)
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  MATH_RE.lastIndex = 0
  while ((m = MATH_RE.exec(text)) !== null) {
    if (m.index > last) out += esc(text.slice(last, m.index))
    // Literal-currency `$…$` → print the source verbatim, don't typeset.
    if (m[4] != null && isLiteralDollarSpan(m[4])) {
      out += esc(m[0])
      last = m.index + m[0].length
      continue
    }
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim()
    try {
      out += katex.renderToString(tex, { throwOnError: false, displayMode: false, output: 'html' })
    } catch {
      out += esc(tex)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out += esc(text.slice(last))
  return out
}

/**
 * Render a multi-line worked solution: each source line ("Given:", each step,
 * "→ Option (C)") becomes its OWN block row. A display-style \dfrac is ~2.4× the
 * text height, so flowing every step through one `white-space:pre-line` box with
 * a fixed line-height left tall fraction lines crowding the rows above/below
 * (the "not aligned" look). One block per line lets each fraction claim its own
 * row height while inline text stays baseline-aligned to its fraction; a blank
 * source line becomes a small gap.
 */
function mathBlockHtml(raw: string | null | undefined): string {
  return (raw ?? '')
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? '<div style="height:5px"></div>'
        : `<div style="margin:3px 0">${mathHtml(line)}</div>`
    )
    .join('')
}

/** One "Match List I with List II" block as a real two-column HTML table — the
 *  printed-paper layout the on-screen QuestionStem also uses. */
function matchTableHtml(p: ParsedMatch): string {
  const rowCount = Math.max(p.listI.items.length, p.listII.items.length)
  const hasHeader = Boolean(p.listI.header || p.listII.header)
  const cell = (
    item: { label: string; text: string } | undefined,
    left: boolean,
    top: boolean
  ): string => {
    const border = `${left ? `border-left:1px solid ${LINE};` : ''}${top ? `border-top:1px solid ${LINE};` : ''}`
    if (!item) return `<td style="${border}padding:6px 9px"></td>`
    return `<td style="${border}padding:6px 9px;font-size:13px;font-weight:400;line-height:1.45;color:${INK};vertical-align:top">
      <span style="font-weight:700;color:#6E6C7C">${esc(formatMatchLabel(item.label))}</span> ${mathHtml(item.text)}
    </td>`
  }
  let rows = ''
  if (hasHeader) {
    const th = (text: string, left: boolean) =>
      `<th style="text-align:left;padding:7px 9px;font-size:12px;font-weight:700;color:${VIOLET_DEEP};border-bottom:1px solid ${LINE}${left ? `;border-left:1px solid ${LINE}` : ''}">${mathHtml(text)}</th>`
    rows += `<tr>${th(p.listI.header, false)}${th(p.listII.header, true)}</tr>`
  }
  for (let r = 0; r < rowCount; r++) {
    const top = hasHeader || r > 0
    rows += `<tr>${cell(p.listI.items[r], false, top)}${cell(p.listII.items[r], true, top)}</tr>`
  }
  return `<table style="width:100%;border-collapse:collapse;border:1px solid ${LINE};margin-top:6px;table-layout:fixed">${rows}</table>`
}

/** The question stem: a two-column table for "match" questions (per language for
 *  bilingual mode), otherwise the usual pre-wrapped paragraph. */
function questionStemHtml(q: Question, lang: DisplayLang): string {
  if (q.question_type === 'match') {
    const en = q.question_text
    const ta = q.question_text_ta?.trim() || null
    const texts = lang === 'ta' ? [ta ?? en] : lang === 'both' ? [en, ...(ta ? [ta] : [])] : [en]
    const parsed = texts.map(parseMatchQuestion)
    if (parsed.every(Boolean)) {
      return (parsed as ParsedMatch[])
        .map((p) => {
          const pre = p.preamble ? `<div style="margin-bottom:5px">${mathHtml(p.preamble)}</div>` : ''
          const trail = p.trailing
            ? `<div style="margin-top:5px;font-size:13px;font-weight:500;color:#6E6C7C">${mathHtml(p.trailing)}</div>`
            : ''
          return pre + matchTableHtml(p) + trail
        })
        .join('<div style="height:8px"></div>')
    }
  }
  return `<div>${mathBlockHtml(displayQuestion(q, lang))}</div>`
}

/** Build the inner HTML for one question block (question, options, explanation). */
function questionBlockHtml(q: Question, index: number, lang: DisplayLang): string {
  const optionRows = optionLetters(q).map((letter) => {
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
      <span style="font-weight:700">${letter}.</span> ${mathHtml(text)} ${check}
    </div>`
  }).join('')

  const explanation = displayExplanation(q, lang)
  const explHtml = explanation
    ? `<div style="background:${VIOLET_SOFT};border-left:4px solid ${VIOLET};border-radius:8px;padding:10px 12px;margin-top:8px">
        <div style="color:${VIOLET};font-weight:700;font-size:10px;letter-spacing:.5px;margin-bottom:3px">EXPLANATION</div>
        <div style="color:#3C3850;font-size:13px;line-height:1.55">${mathBlockHtml(explanation)}</div>
      </div>`
    : ''

  return `<div style="padding:14px 4px;border-bottom:1px solid ${LINE}">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <span style="flex:0 0 auto;box-sizing:border-box;display:inline-block;min-width:24px;height:20px;line-height:20px;text-align:center;padding:0 6px;background:${VIOLET};color:#fff;font-weight:700;font-size:11px;border-radius:5px">Q${index + 1}</span>
      <div style="flex:1;min-width:0;font-weight:700;color:${INK};font-size:15px;line-height:1.5">${questionStemHtml(q, lang)}</div>
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

// KaTeX ships its own web fonts; fraction bars, √ vinculums and exponents are
// positioned assuming THOSE exact glyph metrics. They load lazily on first use,
// and `document.fonts.ready` can resolve BEFORE they arrive — so html2canvas
// would snapshot the math shaped with fallback fonts, which is exactly what
// breaks fraction rules and detaches radical overlines in the export. Force the
// families our content uses to load (each weight/style) before rasterising.
const KATEX_FONTS = [
  'KaTeX_Main', 'KaTeX_Math', 'KaTeX_AMS',
  'KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4',
]
async function ensureKatexFonts(): Promise<void> {
  const fonts = document.fonts
  if (!fonts) return
  const specs = KATEX_FONTS.flatMap((f) => [`16px "${f}"`, `italic 16px "${f}"`, `bold 16px "${f}"`])
  // A family/weight that isn't declared just rejects — ignore and load the rest.
  await Promise.all(specs.map((s) => fonts.load(s).catch(() => [])))
  await fonts.ready
}

// html2canvas renders sub-pixel borders unreliably; KaTeX's default rule lines
// (~0.04em) are thinner than a device pixel at our export size and come out
// faint or broken. Floor them at 1px so fraction bars / roots rasterise solidly.
const KATEX_PDF_STYLE =
  '<style>' +
  '.katex .frac-line{border-bottom-width:max(1px,0.04em)}' +
  '.katex .sqrt>.sqrt-line{border-top-width:max(1px,0.05em)}' +
  '.katex .overline .overline-line,.katex .underline .underline-line{border-top-width:max(1px,0.04em)}' +
  '</style>'

/** Render one off-screen HTML string to a canvas via html2canvas. */
async function htmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W}px;background:#fff;font-family:${FONT_STACK}`
  host.innerHTML = KATEX_PDF_STYLE + html
  document.body.appendChild(host)
  try {
    // Wait for KaTeX (and Tamil) web fonts triggered by the just-inserted nodes,
    // else html2canvas can snapshot fraction bars/glyphs before they paint.
    await ensureKatexFonts()
    return await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  } finally {
    document.body.removeChild(host)
  }
}

// How many question blocks to rasterise in a single html2canvas pass. Capturing
// one block at a time means N html2canvas calls (each clones + lays out + rasters
// the DOM) - crippling for a 200-Q mock. Batching cuts that ~CHUNK-fold while we
// still slice each block out of the batch canvas, so per-question pagination is
// unchanged. Kept modest so the batch canvas stays well under the browser's max
// canvas height (≈32k px): ~12 blocks × ~180css px × scale 2 ≈ 4.3k px.
const CHUNK = 12

/**
 * Rasterise several question blocks in ONE html2canvas pass, then split the
 * result into one canvas per block (cropped by each block's measured box). This
 * is the perf-critical path for long mocks - far fewer html2canvas invocations
 * for identical output. Returns canvases in input order.
 */
async function renderQuestionChunk(blocks: string[]): Promise<HTMLCanvasElement[]> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W}px;background:#fff;font-family:${FONT_STACK}`
  host.innerHTML = KATEX_PDF_STYLE + blocks.map((b) => `<div data-pdf-q>${b}</div>`).join('')
  document.body.appendChild(host)
  try {
    // See htmlToCanvas: let KaTeX/Tamil fonts finish loading before rasterising.
    await ensureKatexFonts()
    const full = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const scale = full.width / host.offsetWidth // device scale actually applied (≈2)
    const children = Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-q]'))
    return children.map((el) => {
      const sy = Math.max(0, Math.round(el.offsetTop * scale))
      const sh = Math.min(full.height - sy, Math.round(el.offsetHeight * scale))
      const c = document.createElement('canvas')
      c.width = full.width
      c.height = sh
      c.getContext('2d')!.drawImage(full, 0, sy, full.width, sh, 0, 0, full.width, sh)
      return c
    })
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

  // JPEG (not PNG) keeps the file small - a 2-question PNG export was ~13 MB;
  // JPEG q0.85 is ~0.6 MB with no visible loss on text/UI.
  const toJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.85)

  // Canvas pixels per PDF point, taken from the rasteriser so a block image maps
  // 1:1 onto the page and the background lattice is drawn at the same density.
  const pxPerPt = (RENDER_W * 2) / contentW

  // Full-page background, painted before anything else on every page so the
  // mark reaches the margins and the footer band, not just the blocks. Built
  // once and re-added under a fixed alias, so jsPDF stores ONE copy of it no
  // matter how many pages a 200-question sheet runs to.
  const bg = watermark
    ? makeWatermarkLayer(watermark, { pxPerPt, pageWPt: pageW, pageHPt: pageH })
    : ''
  const paintBg = () => {
    if (bg) doc.addImage(bg, 'JPEG', 0, 0, pageW, pageH, 'wm-bg', 'FAST')
  }
  const newPage = () => {
    doc.addPage()
    paintBg()
  }

  let y = margin
  const placeCanvas = (canvas: HTMLCanvasElement, topMargin = margin) => {
    const hPt = (canvas.height / canvas.width) * contentW
    if (y + hPt > footerSafe) {
      newPage()
      y = topMargin
    }
    // Blocks are opaque, so they'd punch holes in the background layer. Stamp
    // the same lattice into each one, on the same page-space grid, and the two
    // layers meet without a seam. Rastered rather than drawn as PDF text with
    // an alpha — see stampWatermark for why.
    if (watermark) {
      stampWatermark(canvas, watermark, {
        pxPerPt: canvas.width / contentW,
        pageWPt: pageW,
        pageHPt: pageH,
        originXPt: margin,
        originYPt: y,
      })
    }
    doc.addImage(toJpeg(canvas), 'JPEG', margin, y, contentW, hPt)
    y += hPt
  }

  paintBg()

  // Cover (HTML so a Tamil sub-title shapes correctly).
  const cover = await htmlToCanvas(coverHtml(title, label, questions.length))
  // Cover spans full width incl. the colored band - bleed it to the page edges.
  const coverHPt = (cover.height / cover.width) * pageW
  if (watermark) {
    stampWatermark(cover, watermark, {
      pxPerPt: cover.width / pageW,
      pageWPt: pageW,
      pageHPt: pageH,
    })
  }
  doc.addImage(toJpeg(cover), 'JPEG', 0, 0, pageW, coverHPt)
  y = coverHPt + 10

  // Each question is still placed as its own atomic image (so pagination never
  // cuts a question mid-line), but we rasterise CHUNK at a time and slice them
  // apart - far fewer html2canvas passes than one-per-question on a 200-Q mock.
  for (let start = 0; start < questions.length; start += CHUNK) {
    const slice = questions.slice(start, start + CHUNK)
    const blocks = slice.map((q, j) => questionBlockHtml(q, start + j, lang))
    const canvases = await renderQuestionChunk(blocks)
    for (const canvas of canvases) placeCanvas(canvas)
  }

  // Footer on every page (the watermark is already baked into each block).
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    const fy = pageH - 26
    doc.setDrawColor(...LINE_RGB)
    doc.setLineWidth(0.7)
    doc.line(margin, fy - 8, pageW - margin, fy - 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text('TNPSC Mentors  ·  Prepare smart. Score high.', margin, fy)
    doc.text(`Page ${p} of ${total}`, pageW - margin, fy, { align: 'right' })
  }

  const safe = (title + '_' + label).replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  await savePdfDoc(doc, `TNPSC_Mentors_${safe || 'ExplanationSheet'}.pdf`)
}
