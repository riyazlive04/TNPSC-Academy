// ─── CA slide deck → .pptx ───────────────────────────────────────────────────
// Renders the shared model from `caSlides` with PptxGenJS. Text stays real text
// (editable, selectable, searchable) — only the branded background is an image.
// 100% client-side; lazy-loaded so pptxgenjs stays out of the console chunk.

import type PptxGenJSType from 'pptxgenjs'
import {
  BG_URL,
  BODY_BOTTOM,
  BULLET_INDENT,
  DATE_HEIGHT,
  DATE_LEFT,
  DATE_PT,
  DATE_TOP,
  DATE_WIDTH,
  DIVIDER_PT,
  DIVIDER_TOP,
  EN_LEFT,
  EN_WIDTH,
  LATIN_FONT,
  SLIDE_H,
  SLIDE_W,
  TA_LEFT,
  TA_WIDTH,
  TAMIL_FONT,
  splitInline,
  type CaSlide,
  type ContentSlide,
  type SlideColumn,
} from './caSlides'

const LAYOUT = 'CA_16x9'
const MASTER = 'CA_BACKGROUND'

/** The background art as a data URI — PptxGenJS embeds `data:` images directly. */
async function backgroundDataUrl(): Promise<string> {
  const res = await fetch(BG_URL)
  if (!res.ok) throw new Error('Could not load the slide background.')
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the slide background.'))
    reader.readAsDataURL(blob)
  })
}

type TextItem = NonNullable<Parameters<PptxGenJSType.Slide['addText']>[0]>
type Runs = Extract<TextItem, unknown[]>

/**
 * One column as PptxGenJS rich text. Paragraph properties (bullet, indent,
 * alignment, line spacing) are repeated on every run of a paragraph — the
 * library reads them off each item rather than tracking paragraph state.
 */
function columnRuns(col: SlideColumn, lineSpacing: number, numbered: boolean): Runs {
  const font = col.tamil ? TAMIL_FONT : LATIN_FONT
  const runs: Runs = []

  const push = (
    text: string,
    bold: boolean,
    italic: boolean,
    para: Record<string, unknown>,
    breakLine: boolean
  ) => {
    runs.push({
      text,
      options: { ...para, bold, italic, fontSize: col.fontPt, fontFace: font, breakLine },
    })
  }

  if (col.title) {
    const para = { align: 'left' as const, lineSpacingMultiple: lineSpacing }
    const parts = splitInline(col.title)
    parts.forEach((r, i) => push(r.text, true, r.italic, para, i === parts.length - 1))
  }

  col.lines.forEach((line, i) => {
    // `indent` is the gap between marker and text — the template's 0.25" marL.
    // PptxGenJS stamps `startAt` on EVERY numbered paragraph, which restarts the
    // sequence and renders "1." all the way down; numbering each explicitly is
    // the only way to get 1, 2, 3 out of it.
    const bullet = numbered
      ? ({ type: 'number', numberStartAt: i + 1, indent: BULLET_INDENT * 72 } as const)
      : ({ characterCode: '2022', indent: BULLET_INDENT * 72 } as const)
    const para = {
      align: 'justify' as const,
      lineSpacingMultiple: lineSpacing,
      indentLevel: line.depth,
      bullet,
    }
    const parts = splitInline(line.text)
    parts.forEach((r, i) => push(r.text, r.bold, r.italic, para, i === parts.length - 1))
  })

  return runs
}

function addColumn(slide: PptxGenJSType.Slide, col: SlideColumn, s: ContentSlide, x: number, w: number): void {
  const runs = columnRuns(col, s.lineSpacing, s.numbered)
  if (!runs.length) return
  slide.addText(runs, {
    x,
    y: s.top,
    w,
    h: BODY_BOTTOM - s.top,
    valign: 'top',
    wrap: true,
    // The model already fits the text; never let PowerPoint rescale it.
    fit: 'none',
    paraSpaceAfter: 0,
    color: '000000',
  })
}

/** Build the whole deck as a Blob, ready to save. */
export async function buildCaSlidesPptx(slides: CaSlide[]): Promise<Blob> {
  const [{ default: PptxGenJS }, bg] = await Promise.all([import('pptxgenjs'), backgroundDataUrl()])

  const pres = new PptxGenJS()
  pres.defineLayout({ name: LAYOUT, width: SLIDE_W, height: SLIDE_H })
  pres.layout = LAYOUT
  // The branded art goes on a master, not on each slide. PptxGenJS only
  // de-duplicates media that came from a `path`, and only within one slide, so
  // an addImage per slide would embed the PNG once per slide (37 copies, ~7 MB).
  // Slides reference the master by name, so it is stored exactly once.
  pres.defineSlideMaster({ title: MASTER, background: { data: bg } })

  for (const s of slides) {
    const slide = pres.addSlide({ masterName: MASTER })
    slide.addText(s.date, {
      x: DATE_LEFT,
      y: DATE_TOP,
      w: DATE_WIDTH,
      h: DATE_HEIGHT,
      align: 'right',
      bold: true,
      fontSize: DATE_PT,
      fontFace: LATIN_FONT,
      color: '000000',
    })

    if (s.kind === 'divider') {
      slide.addText(s.label, {
        x: EN_LEFT,
        y: DIVIDER_TOP,
        w: SLIDE_W - 2 * EN_LEFT,
        h: 0.42,
        align: 'center',
        bold: true,
        fontSize: DIVIDER_PT,
        fontFace: LATIN_FONT,
        color: '000000',
      })
      continue
    }

    addColumn(slide, s.en, s, EN_LEFT, EN_WIDTH)
    addColumn(slide, s.ta, s, TA_LEFT, TA_WIDTH)
  }

  return (await pres.write({ outputType: 'blob' })) as Blob
}
