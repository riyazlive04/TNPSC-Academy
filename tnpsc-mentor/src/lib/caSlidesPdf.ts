// ─── CA slide deck → PDF ─────────────────────────────────────────────────────
// The same model `caSlidesPptx` turns into a .pptx, drawn here as one landscape
// PDF page per slide. Each slide is laid out as real HTML and snapshotted with
// html2canvas rather than typeset with jsPDF: jsPDF cannot shape Tamil, but the
// browser can, so we capture the pixels (the trick magazinePdf already relies on).
//
// Because the browser does the wrapping, each slide is measured after mount and
// its font stepped down until it fits — the model's estimate is tuned for
// PowerPoint's metrics, and Noto Sans Tamil sets a little differently.

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { saveBlob } from './saveBlob'
import {
  BG_URL,
  BODY_BOTTOM,
  BULLET_INDENT,
  DATE_LEFT,
  DATE_PT,
  DATE_TOP,
  DATE_WIDTH,
  DIVIDER_PT,
  DIVIDER_TOP,
  EN_LEFT,
  EN_WIDTH,
  SLIDE_H,
  SLIDE_W,
  TA_LEFT,
  TA_WIDTH,
  splitInline,
  type CaSlide,
  type SlideColumn,
} from './caSlides'

/** CSS px per inch — the slide renders at 1280 × 720 before the 2× capture. */
const PX = 96
const FONT_STACK = "'Noto Sans Tamil','Inter',system-ui,sans-serif"
/** PowerPoint's text-box insets, so the HTML text starts where the .pptx text does. */
const INSET_L = 0.1
const INSET_T = 0.05
const MIN_FONT_PT = 7

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Inline markdown → HTML, matching the runs the .pptx gets. */
function runsHtml(text: string, boldAll = false): string {
  return splitInline(text)
    .map((r) => {
      const body = esc(r.text)
      const bold = r.bold || boldAll
      const styled = r.italic ? `<em>${body}</em>` : body
      return bold ? `<strong>${styled}</strong>` : styled
    })
    .join('')
}

function columnHtml(col: SlideColumn, lineSpacing: number, numbered: boolean): string {
  if (!col.title && !col.lines.length) return ''
  const parts: string[] = []

  if (col.title) {
    parts.push(
      `<div style="text-align:left;font-weight:700;line-height:${lineSpacing * 1.2}">${runsHtml(col.title, true)}</div>`
    )
  }

  col.lines.forEach((line, i) => {
    // Hanging indent: the marker sits in a fixed gutter and the text block
    // occupies the rest, exactly like the .pptx's marL / negative indent.
    const marker = numbered ? `${i + 1}.` : '&bull;'
    const pad = (line.depth + 1) * BULLET_INDENT
    parts.push(
      `<div style="display:flex;align-items:flex-start;padding-left:${(pad - BULLET_INDENT) * PX}px">` +
        `<span style="flex:0 0 ${BULLET_INDENT * PX}px;line-height:${lineSpacing * 1.2}">${marker}</span>` +
        `<span style="flex:1 1 auto;text-align:justify;line-height:${lineSpacing * 1.2}">${runsHtml(line.text)}</span>` +
        `</div>`
    )
  })

  return parts.join('')
}

function slideHtml(slide: CaSlide, bgUrl: string): string {
  const box = (x: number, y: number, w: number, extra: string, inner: string) =>
    `<div style="position:absolute;left:${(x + INSET_L) * PX}px;top:${(y + INSET_T) * PX}px;width:${(w - 2 * INSET_L) * PX}px;${extra}">${inner}</div>`

  const chrome =
    `<img src="${bgUrl}" style="position:absolute;left:0;top:0;width:${SLIDE_W * PX}px;height:${SLIDE_H * PX}px" />` +
    box(
      DATE_LEFT,
      DATE_TOP,
      DATE_WIDTH,
      `text-align:right;font-weight:700;font-size:${DATE_PT}pt`,
      esc(slide.date)
    )

  if (slide.kind === 'divider') {
    return (
      chrome +
      box(
        EN_LEFT,
        DIVIDER_TOP,
        SLIDE_W - 2 * EN_LEFT,
        `text-align:center;font-weight:700;font-size:${DIVIDER_PT}pt`,
        esc(slide.label)
      )
    )
  }

  const col = (c: SlideColumn, x: number, w: number) =>
    box(
      x,
      slide.top,
      w,
      `font-size:${c.fontPt}pt`,
      `<div data-fitbox>${columnHtml(c, slide.lineSpacing, slide.numbered)}</div>`
    )

  return chrome + col(slide.en, EN_LEFT, EN_WIDTH) + col(slide.ta, TA_LEFT, TA_WIDTH)
}

async function ensureFonts(): Promise<void> {
  const fonts = document.fonts
  if (!fonts) return
  const specs = ['16px "Noto Sans Tamil"', '700 16px "Noto Sans Tamil"', '16px "Inter"', '700 16px "Inter"']
  await Promise.all(specs.map((s) => fonts.load(s).catch(() => [])))
  await fonts.ready
}

/**
 * Shrink any column whose real wrapped height overflows the body band. The model
 * sized it for PowerPoint's fonts; this is the browser having the last word.
 */
function fitColumns(host: HTMLElement, slide: CaSlide): void {
  if (slide.kind !== 'content') return
  const availPx = (BODY_BOTTOM - slide.top) * PX
  host.querySelectorAll<HTMLElement>('[data-fitbox]').forEach((box) => {
    const outer = box.parentElement
    if (!outer) return
    const start = parseFloat(outer.style.fontSize)
    for (let pt = start; box.scrollHeight > availPx && pt > MIN_FONT_PT; pt -= 0.5) {
      outer.style.fontSize = `${pt - 0.5}pt`
    }
  })
}

/**
 * Mount one slide off-screen at its true pixel size, fonts loaded and columns
 * fitted. The caller owns the returned element and must remove it.
 */
export async function mountSlide(slide: CaSlide, bgUrl = BG_URL): Promise<HTMLElement> {
  const host = document.createElement('div')
  host.style.cssText =
    `position:fixed;left:-99999px;top:0;width:${SLIDE_W * PX}px;height:${SLIDE_H * PX}px;` +
    `background:#fff;color:#000;font-family:${FONT_STACK};overflow:hidden`
  host.innerHTML = slideHtml(slide, bgUrl)
  document.body.appendChild(host)
  await ensureFonts()
  fitColumns(host, slide)
  return host
}

/** Rasterise one slide at 2× into a canvas. */
async function renderSlide(slide: CaSlide): Promise<HTMLCanvasElement> {
  const host = await mountSlide(slide)
  try {
    return await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  } finally {
    host.remove()
  }
}

/** Render the deck to a landscape PDF — one page per slide. */
export async function buildCaSlidesPdf(
  slides: CaSlide[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'in', format: [SLIDE_W, SLIDE_H], orientation: 'landscape' })

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], 'landscape')
    const canvas = await renderSlide(slides[i])
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, SLIDE_W, SLIDE_H)
    onProgress?.(i + 1, slides.length)
  }

  return doc.output('blob')
}

/** Build the deck as a PDF and save it. */
export async function generateCaSlidesPdf(
  slides: CaSlide[],
  filename: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  await saveBlob(await buildCaSlidesPdf(slides, onProgress), filename, '.pdf')
}
