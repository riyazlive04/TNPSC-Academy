import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { savePdfDoc } from './savePdf'
import { groupBySection, sectionLabel } from './caMagazine'
import { markdownToHtml } from './caMagazineMarkdown'
import type { CaMagazineItem } from './api'

/**
 * PDF export of a CA-magazine issue. Like explanationPdf, this renders real HTML
 * and snapshots it with html2canvas rather than drawing text with jsPDF — jsPDF
 * can't shape Tamil, but the browser can, so we capture the pixels. Content is
 * the same markdown the reader shows (bullets + bold via markdownToHtml), grouped
 * into the canonical sections. Bilingual per the reader's language. 100% client-
 * side. Lazy-loaded on demand so jspdf/html2canvas stay out of the reader chunk.
 */

const VIOLET = '#7C5CFF'
const VIOLET_DEEP = '#4C1D95'
const VIOLET_SOFT = '#EEEBFE'
const INK = '#18142B'
const BODY = '#3C3850'
const LINE = '#E8E6F3'
const GREY: [number, number, number] = [110, 108, 124]
const LINE_RGB: [number, number, number] = [232, 230, 243]

const FONT_STACK = "'Noto Sans Tamil','Inter',system-ui,sans-serif"
const RENDER_W = 760

// Global styling for the markdown the host renders (ul/li/strong/p).
const PDF_STYLE =
  '<style>' +
  'ul{list-style:disc;padding-left:20px;margin:5px 0}' +
  'ul ul{list-style:circle;margin:2px 0}' +
  'li{margin:3px 0;font-size:13.5px;line-height:1.55;color:' + BODY + '}' +
  'p{margin:5px 0;font-size:13.5px;line-height:1.55;color:' + BODY + '}' +
  'strong,b{font-weight:700;color:' + INK + '}' +
  '</style>'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Lang = 'en' | 'ta' | 'both'

/** One item as an HTML block (title + English and/or Tamil content). */
function itemHtml(item: CaMagazineItem, topic: string, lang: Lang): string {
  const ta = item.title_ta?.trim()
  const showTitle = item.title.trim().toUpperCase() !== topic.toUpperCase()
  const showEn = lang !== 'ta' || !item.content_ta
  const showTa = (lang === 'ta' || lang === 'both') && !!item.content_ta

  let titleHtml = ''
  if (showTitle) {
    const parts: string[] = []
    if (lang === 'en' || lang === 'both' || !ta) parts.push(esc(item.title))
    if ((lang === 'ta' || lang === 'both') && ta) parts.push(esc(ta))
    titleHtml = parts
      .map(
        (p) =>
          `<div style="font-weight:700;color:${INK};font-size:15px;line-height:1.4;margin-bottom:3px">${p}</div>`
      )
      .join('')
  }

  const enHtml = showEn ? markdownToHtml(item.content) : ''
  const taHtml = showTa ? markdownToHtml(item.content_ta as string) : ''
  const divider = showEn && showTa ? `<div style="height:1px;background:${LINE};margin:8px 0"></div>` : ''

  return `<div style="padding:9px 4px 11px;border-bottom:1px solid ${LINE}">${titleHtml}${enHtml}${divider}${taHtml}</div>`
}

function sectionHeaderHtml(label: string): string {
  return `<div style="background:${VIOLET_SOFT};color:${VIOLET_DEEP};font-weight:800;font-size:12px;letter-spacing:.07em;text-transform:uppercase;padding:7px 12px;border-radius:8px;margin:14px 0 6px">${esc(label)}</div>`
}

function coverHtml(title: string, subtitle: string): string {
  return `<div style="background:${VIOLET_DEEP};color:#fff;padding:20px 18px 18px;border-top:6px solid ${VIOLET}">
      <div style="font-size:11px;font-weight:700;letter-spacing:.5px">TNPSC MENTOR</div>
      <div style="font-size:23px;font-weight:800;margin-top:5px;line-height:1.2">${esc(title)}</div>
      <div style="font-size:13px;opacity:.85;margin-top:7px">${esc(subtitle)}</div>
    </div>`
}

async function ensureFonts(): Promise<void> {
  const fonts = document.fonts
  if (!fonts) return
  const specs = ['16px "Noto Sans Tamil"', '700 16px "Noto Sans Tamil"', '16px "Inter"', '700 16px "Inter"']
  await Promise.all(specs.map((s) => fonts.load(s).catch(() => [])))
  await fonts.ready
}

/** Rasterise several HTML blocks in ONE html2canvas pass, then slice per block. */
async function renderBlocks(blocks: string[]): Promise<HTMLCanvasElement[]> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W}px;background:#fff;font-family:${FONT_STACK}`
  host.innerHTML = PDF_STYLE + blocks.map((b) => `<div data-pdf-b>${b}</div>`).join('')
  document.body.appendChild(host)
  try {
    await ensureFonts()
    const full = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const scale = full.width / host.offsetWidth
    return Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-b]')).map((el) => {
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

async function htmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W}px;background:#fff;font-family:${FONT_STACK}`
  host.innerHTML = PDF_STYLE + html
  document.body.appendChild(host)
  try {
    await ensureFonts()
    return await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  } finally {
    document.body.removeChild(host)
  }
}

const CHUNK = 8

interface MagazinePdfParams {
  items: CaMagazineItem[]
  title: string
  subtitle: string
  lang: Lang
}

export async function generateMagazinePdf({ items, title, subtitle, lang }: MagazinePdfParams): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentW = pageW - margin * 2
  const footerSafe = pageH - 40
  const pageBodyH = footerSafe - margin

  const toJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.85)

  const state = { y: margin }

  // Draw a portion of a (possibly very tall) canvas, flowing across page breaks.
  const placeFlowing = (canvas: HTMLCanvasElement) => {
    const pxToPt = contentW / canvas.width
    let sy = 0
    while (sy < canvas.height) {
      if (state.y >= footerSafe - 4) {
        doc.addPage()
        state.y = margin
      }
      const availPx = Math.max(1, Math.floor((footerSafe - state.y) / pxToPt))
      const sliceH = Math.min(availPx, canvas.height - sy)
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = sliceH
      tmp.getContext('2d')!.drawImage(canvas, 0, sy, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      const hPt = sliceH * pxToPt
      doc.addImage(toJpeg(tmp), 'JPEG', margin, state.y, contentW, hPt)
      state.y += hPt
      sy += sliceH
      if (sy < canvas.height) {
        doc.addPage()
        state.y = margin
      }
    }
  }

  // Place a block atomically when it fits on a page; flow-slice only the rare
  // block taller than a full page (e.g. a big TNPSC BITS in bilingual mode).
  const placeBlock = (canvas: HTMLCanvasElement) => {
    const hPt = (canvas.height / canvas.width) * contentW
    if (hPt > pageBodyH) {
      placeFlowing(canvas)
      return
    }
    if (state.y + hPt > footerSafe) {
      doc.addPage()
      state.y = margin
    }
    doc.addImage(toJpeg(canvas), 'JPEG', margin, state.y, contentW, hPt)
    state.y += hPt
  }

  // Cover — full-bleed coloured band.
  const cover = await htmlToCanvas(coverHtml(title, subtitle))
  const coverHPt = (cover.height / cover.width) * pageW
  doc.addImage(toJpeg(cover), 'JPEG', 0, 0, pageW, coverHPt)
  state.y = coverHPt + 12

  // Build an ordered block list: section header, then its items.
  const blocks: string[] = []
  for (const { topic, items: sectionItems } of groupBySection(items)) {
    blocks.push(sectionHeaderHtml(sectionLabel(topic, lang)))
    for (const item of sectionItems) blocks.push(itemHtml(item, topic, lang))
  }

  for (let start = 0; start < blocks.length; start += CHUNK) {
    const canvases = await renderBlocks(blocks.slice(start, start + CHUNK))
    for (const canvas of canvases) placeBlock(canvas)
  }

  // Footer on every page (Latin only → safe in jsPDF's Helvetica).
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

  const safe = title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  await savePdfDoc(doc, `TNPSC_Mentors_${safe || 'CA_Magazine'}.pdf`)
}
