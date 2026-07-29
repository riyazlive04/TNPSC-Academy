// ─── CA magazine → slide deck (layout model) ─────────────────────────────────
// The shape of the deck the team hand-built in PowerPoint for the 15 July issue:
// one branded background on every slide, the issue date top-right, a full-slide
// title before each section group, then one item per slide with the English
// block on the left and its Tamil twin on the right.
//
// This module is the single source of truth for that layout — pure data, no DOM
// and no PowerPoint. `caSlidesPptx` renders it to a .pptx and `caSlidesPdf`
// renders the same model to a PDF, so the two exports can never drift apart.

import type { CaMagazineItem, CaMagazineType } from './api'
import { groupBySection, isSectionEcho, issueDateLabel, parseBullets, type MagazineLine } from './caMagazine'

// ─── Geometry (inches, 16:9) ─────────────────────────────────────────────────
// The background art carries the header band (ends ~0.67") and the social
// footer band (starts ~6.98"), so every element lives between them.
export const SLIDE_W = 13.333
export const SLIDE_H = 7.5
export const BG_URL = '/ca-slide-bg.png'

export const DATE_LEFT = 8.5
export const DATE_TOP = 0.72
export const DATE_WIDTH = 4.53
export const DATE_HEIGHT = 0.34
export const DATE_PT = 12

export const DIVIDER_TOP = 3.14
export const DIVIDER_PT = 18

export const BODY_TOP = 1.18
export const BODY_BOTTOM = 6.8
export const EN_LEFT = 0.3
export const EN_WIDTH = 6.05
export const TA_LEFT = 6.78
export const TA_WIDTH = 6.25

/** Hanging indent of one bullet level. */
export const BULLET_INDENT = 0.25
/** PowerPoint's default text-box insets (left+right, and top+bottom). */
const INSET_X = 0.2
const INSET_Y = 0.12

export const TAMIL_FONT = 'Nirmala Text'
export const LATIN_FONT = 'Aptos'

// ─── Section title slides ────────────────────────────────────────────────────
// Every group opens with one. A topic the pipeline invents later still gets a
// slide — it just falls back to the label as pushed.
const DIVIDER_LABELS: Record<string, string> = {
  'TNPSC BITS': 'TNPSC CABITS',
  'TAMIL NADU': 'STATE CURRENT AFFAIRS',
  NATIONAL: 'NATIONAL CURRENT AFFAIRS',
  INTERNATIONAL: 'INTERNATIONAL CURRENT AFFAIRS',
  ECONOMY: 'ECONOMY',
  'SCIENCE AND TECHNOLOGY': 'SCIENCE AND TECHNOLOGY',
  ENVIRONMENT: 'ENVIRONMENT',
  'REPORTS AND INDICES': 'REPORTS AND INDICES',
  STATES: 'OTHER STATES',
  SPORTS: 'SPORTS',
  'PERSONALITIES, AWARDS, AND EVENTS': 'PERSONALITIES, AWARDS AND EVENTS',
  'IMPORTANT DAYS': 'IMPORTANT DAYS',
  MISCELLANEOUS: 'MISCELLANEOUS',
}

export function dividerLabel(topic: string): string {
  return DIVIDER_LABELS[topic] ?? topic.toUpperCase()
}

// ─── Fitting ─────────────────────────────────────────────────────────────────
// [English pt, Tamil pt, line-spacing multiple] — the first step that fits wins,
// so almost every slide keeps the template's own 12pt / 10pt at 150%.
const SIZE_LADDER: readonly (readonly [number, number, number])[] = [
  [12, 10, 1.5],
  [12, 10, 1.25],
  [11, 9.5, 1.25],
  [10, 9, 1.15],
  [9, 8, 1.1],
]
const MIN_STEP = SIZE_LADDER[SIZE_LADDER.length - 1]

// Average glyph width as a fraction of the point size. Fitted against the
// template deck itself — every one of its boxes is spAutoFit, so PowerPoint had
// already written the true rendered height into each shape (Latin landed near
// 0.49, Tamil near 0.67). Set a little above those so the estimate errs tall: a
// slightly small font is survivable, text under the footer band is not.
const CHAR_W_LATIN = 0.53
const CHAR_W_TAMIL = 0.73
const HEIGHT_HEADROOM = 1.04

interface Para {
  text: string
  /** Left indent in inches. */
  indent: number
}

/** Estimated rendered height of a run of paragraphs, in inches. */
function estHeight(paras: Para[], widthIn: number, sizePt: number, lineSpacing: number, tamil: boolean): number {
  const linePt = 1.2 * sizePt * lineSpacing
  const charPt = sizePt * (tamil ? CHAR_W_TAMIL : CHAR_W_LATIN)
  let totalPt = 0
  for (const p of paras) {
    const usablePt = (widthIn - INSET_X - p.indent) * 72
    const cpl = Math.max(usablePt / charPt, 8)
    totalPt += Math.max(1, Math.ceil(p.text.length / cpl)) * linePt
  }
  return (totalPt * HEIGHT_HEADROOM) / 72 + INSET_Y
}

// ─── Inline markdown ─────────────────────────────────────────────────────────
export interface TextRun {
  text: string
  bold: boolean
  italic: boolean
}

/**
 * `a **b** c` → three runs. Hand-scanned rather than regex-matched: a lookbehind
 * would be the tidy way to tell `*` from `**`, but Safari only shipped those in
 * 16.4 and a parse error would take down the whole chunk.
 */
export function splitInline(text: string): TextRun[] {
  const runs: TextRun[] = []
  let plain = ''
  let i = 0
  const flush = () => {
    if (plain) runs.push({ text: plain, bold: false, italic: false })
    plain = ''
  }
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        runs.push({ text: text.slice(i + 2, end), bold: true, italic: false })
        i = end + 2
        continue
      }
    } else if (text[i] === '*' && !/\s/.test(text[i + 1] ?? ' ')) {
      const end = text.indexOf('*', i + 1)
      if (end > i + 1) {
        flush()
        runs.push({ text: text.slice(i + 1, end), bold: false, italic: true })
        i = end + 1
        continue
      }
    }
    plain += text[i]
    i++
  }
  flush()
  return runs.length ? runs : [{ text, bold: false, italic: false }]
}

// ─── The model ───────────────────────────────────────────────────────────────
export interface SlideColumn {
  /** Bold heading above the bullets; absent on the TNPSC Bits round-up. */
  title: string | null
  lines: MagazineLine[]
  fontPt: number
  tamil: boolean
}

export interface DividerSlide {
  kind: 'divider'
  date: string
  label: string
}

export interface ContentSlide {
  kind: 'content'
  date: string
  /** Top of both columns, in inches. */
  top: number
  lineSpacing: number
  /** Numbered list instead of bullets — the TNPSC Bits round-up. */
  numbered: boolean
  en: SlideColumn
  ta: SlideColumn
}

export type CaSlide = DividerSlide | ContentSlide

interface Page {
  step: readonly [number, number, number]
  en: MagazineLine[]
  ta: MagazineLine[]
}

const parasOf = (title: string | null, lines: MagazineLine[]): Para[] => [
  ...(title ? [{ text: title, indent: 0 }] : []),
  ...lines.map((l) => ({ text: l.text, indent: (l.depth + 1) * BULLET_INDENT })),
]

/** Height of the taller of the two columns at a given size step. */
function blockHeight(
  step: readonly [number, number, number],
  titleEn: string | null,
  titleTa: string | null,
  en: MagazineLine[],
  ta: MagazineLine[]
): number {
  const [enPt, taPt, ls] = step
  return Math.max(
    estHeight(parasOf(titleEn, en), EN_WIDTH, enPt, ls, false),
    estHeight(parasOf(titleTa, ta), TA_WIDTH, taPt, ls, true)
  )
}

/** Split one item into pages that fit, shrinking before ever splitting. */
function planPages(
  titleEn: string | null,
  titleTa: string | null,
  bulEn: MagazineLine[],
  bulTa: MagazineLine[]
): Page[] {
  const avail = BODY_BOTTOM - BODY_TOP
  const fits = (step: readonly [number, number, number], en: MagazineLine[], ta: MagazineLine[]) =>
    blockHeight(step, titleEn, titleTa, en, ta) <= avail

  for (const step of SIZE_LADDER) {
    if (fits(step, bulEn, bulTa)) return [{ step, en: bulEn, ta: bulTa }]
  }

  // Still too tall at the smallest step: break the bullets across slides,
  // keeping the two languages index-aligned so the columns stay twins.
  const pages: Page[] = []
  const n = Math.max(bulEn.length, bulTa.length)
  let i = 0
  while (i < n) {
    let take = n - i
    while (take > 1 && !fits(MIN_STEP, bulEn.slice(i, i + take), bulTa.slice(i, i + take))) take--
    pages.push({ step: MIN_STEP, en: bulEn.slice(i, i + take), ta: bulTa.slice(i, i + take) })
    i += take
  }
  return pages
}

/**
 * Build the deck for one magazine issue. Sections come out in the reader's
 * canonical order (TNPSC Bits first), each preceded by its title slide.
 */
export function buildCaSlides(items: CaMagazineItem[], caType: CaMagazineType, date: string): CaSlide[] {
  const dateText = issueDateLabel(caType, date, 'en')
  const slides: CaSlide[] = []

  for (const { topic, items: group } of groupBySection(items)) {
    slides.push({ kind: 'divider', date: dateText, label: dividerLabel(topic) })

    for (const item of group) {
      // The Bits round-up's "title" is just the section name — drop it and
      // number the points instead, as the template does on its opening slide.
      const numbered = isSectionEcho(item.title, topic)
      const titleEn = numbered ? null : item.title.trim()
      const titleTa = numbered ? null : (item.title_ta?.trim() || null)
      const bulEn = parseBullets(item.content)
      const bulTa = parseBullets(item.content_ta ?? '')

      planPages(titleEn, titleTa, bulEn, bulTa).forEach((page, idx) => {
        const [enPt, taPt, ls] = page.step
        // Nudge short items down so they sit in the band rather than clinging to
        // the header — the optical balance the template was hand-set to.
        const slack = BODY_BOTTOM - BODY_TOP - blockHeight(page.step, titleEn, titleTa, page.en, page.ta)
        const suffix = idx === 0 ? '' : ' (contd.)'
        slides.push({
          kind: 'content',
          date: dateText,
          top: BODY_TOP + Math.min(Math.max(slack, 0) / 3, 1),
          lineSpacing: ls,
          numbered,
          en: { title: titleEn && titleEn + suffix, lines: page.en, fontPt: enPt, tamil: false },
          ta: { title: titleTa && titleTa + suffix, lines: page.ta, fontPt: taPt, tamil: true },
        })
      })
    }
  }
  return slides
}

/** `CA_9_July_2026` — the base filename for either export. */
export function slidesFileLabel(caType: CaMagazineType, date: string): string {
  return `CA_${issueDateLabel(caType, date, 'en').replace(/\s+/g, '_')}`
}
