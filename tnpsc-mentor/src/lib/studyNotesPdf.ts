import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { savePdfDoc } from './savePdf'
import { stampWatermark, makeWatermarkLayer } from './pdfWatermark'

/**
 * Study-notes PDF generator.
 *
 * Recreates the "quick notes" infographics (timelines, biographies, achievement
 * lists) as polished bilingual PDFs branded as TNPSC Mentors, with a faint
 * "TNPSC Mentors" diagonal watermark tiled across every page.
 *
 * WHY html2canvas (and not jsPDF text like pdfGenerator.ts): jsPDF has no
 * complex-script shaping, so Tamil vowel signs (ெ/ே/ை, the ◌ு/◌ூ ligatures)
 * come out scrambled. The browser shapes Tamil correctly (same engine that
 * renders the app UI), so we render each block as off-screen HTML and snapshot
 * the pixels - identical approach to explanationPdf.ts. Each entry is captured
 * as its own image so pagination never cuts an entry mid-line.
 *
 * The watermark is composited into each block's raster rather than drawn over
 * the page with jsPDF text — PDF-level transparency is ignored by several
 * Android viewers, which turned the faint mark into a solid violet lattice.
 * See stampWatermark in pdfWatermark.ts.
 */

// ─── Bilingual content model ──────────────────────────────────────────────────
/** A string available in both languages. */
export interface Bil {
  en: string
  ta: string
}

/** One block of a study note: an optional marker (year / number) + content. */
export interface NoteEntry {
  /** Language-neutral marker shown in the badge, e.g. "1915", "1", "1920-22". */
  marker?: string
  /** Bold sub-heading for the entry (bilingual). */
  heading?: Bil
  /** Paragraph body (bilingual). Use "\n" for line breaks. */
  body?: Bil
  /** Optional bullet list under the body (bilingual, parallel arrays). */
  bullets?: Bil[]
}

/** A full study note (one topic), rendered to one bilingual PDF. */
export interface StudyNote {
  /** Stable id - used for the download filename. */
  id: string
  /** Cover title (bilingual). */
  title: Bil
  /** Optional sub-title under the title (bilingual). */
  subtitle?: Bil
  /** Optional period chip on the cover, e.g. "1917 – 1947". */
  period?: string
  /** Marker styling: a vertical timeline rail vs. plain numbered/list cards. */
  layout: 'timeline' | 'list'
  entries: NoteEntry[]
}

// ─── Palette (mirrors the app's violet theme: src/index.css --c-* tokens) ──────
const VIOLET = '#7C5CFF'
const VIOLET_DEEP = '#4C1D95'
const VIOLET_SOFT = '#EEEBFE'
const INK = '#18142B'
const INK2 = '#3C3850'
const GREY: [number, number, number] = [110, 108, 124]
const LINE = '#E8E6F3'
const LINE_RGB: [number, number, number] = [232, 230, 243]

// Study notes are brand material rather than a per-student download, so the
// mark is the brand name — there is no one to trace a leaked copy back to.
const NOTES_WATERMARK = 'TNPSC Mentors'

// Tamil-capable font the app already loads (index.html / .tamil class). The
// browser shapes Tamil correctly with it and html2canvas captures that.
const FONT_STACK = "'Noto Sans Tamil','Inter',system-ui,sans-serif"
// Off-screen render width in CSS px. Maps to the A4 content width in points.
const RENDER_W = 760

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Render a paragraph that honours "\n" line breaks. */
const para = (text: string) =>
  esc(text).replace(/\n/g, '<br/>')

/** One language column of an entry: heading + body + bullets. */
function langColumn(
  tag: string,
  heading: string | undefined,
  body: string | undefined,
  bullets: string[] | undefined,
  tamil: boolean
): string {
  if (!heading && !body && !(bullets && bullets.length)) return ''
  const cls = tamil ? 'tamil' : ''
  const headHtml = heading
    ? `<div class="${cls}" style="font-weight:700;color:${INK};font-size:14.5px;line-height:1.45">${esc(heading)}</div>`
    : ''
  const bodyHtml = body
    ? `<div class="${cls}" style="color:${INK2};font-size:13px;line-height:1.55;margin-top:${heading ? '3px' : '0'}">${para(body)}</div>`
    : ''
  const bulletsHtml =
    bullets && bullets.length
      ? `<ul class="${cls}" style="margin:5px 0 0;padding-left:18px;color:${INK2};font-size:13px;line-height:1.55">${bullets
          .map((b) => `<li style="margin:2px 0">${esc(b)}</li>`)
          .join('')}</ul>`
      : ''
  return `<div style="margin-top:8px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.6px;color:${VIOLET};text-transform:uppercase;margin-bottom:2px">${tag}</div>
    ${headHtml}${bodyHtml}${bulletsHtml}
  </div>`
}

/** Build the inner HTML for one entry block (badge + EN column + Tamil column). */
function entryBlockHtml(entry: NoteEntry, layout: StudyNote['layout']): string {
  const enCol = langColumn(
    'English',
    entry.heading?.en,
    entry.body?.en,
    entry.bullets?.map((b) => b.en),
    false
  )
  const taCol = langColumn(
    'தமிழ்',
    entry.heading?.ta,
    entry.body?.ta,
    entry.bullets?.map((b) => b.ta),
    true
  )

  // Badge: a filled violet pill for the marker, with a connecting rail dot for
  // the timeline layout.
  const badge = entry.marker
    ? `<div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:64px">
        <span style="background:${VIOLET};color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:4px 8px;white-space:nowrap">${esc(entry.marker)}</span>
        ${layout === 'timeline' ? `<span style="flex:1;width:2px;background:${LINE};margin-top:6px;min-height:8px"></span>` : ''}
      </div>`
    : `<div style="flex:0 0 auto;width:64px"></div>`

  return `<div style="display:flex;gap:12px;align-items:stretch;padding:12px 4px;border-bottom:1px solid ${LINE}">
    ${badge}
    <div style="flex:1 1 auto;min-width:0;border-left:3px solid ${VIOLET_SOFT};padding-left:14px">
      ${enCol}
      ${taCol}
    </div>
  </div>`
}

function coverHtml(note: StudyNote): string {
  const periodChip = note.period
    ? `<span style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:12px;font-weight:700;border-radius:999px;padding:3px 12px;margin-top:10px">${esc(note.period)}</span>`
    : ''
  const subEn = note.subtitle?.en
    ? `<div style="font-size:13px;opacity:.9;margin-top:8px">${esc(note.subtitle.en)}</div>`
    : ''
  const subTa = note.subtitle?.ta
    ? `<div class="tamil" style="font-size:13px;opacity:.9;margin-top:2px">${esc(note.subtitle.ta)}</div>`
    : ''
  return `<div style="background:${VIOLET_DEEP};color:#fff;padding:20px 18px 18px;border-top:6px solid ${VIOLET}">
      <div style="font-size:11px;font-weight:700;letter-spacing:.6px">TNPSC MENTOR</div>
      <div style="font-size:24px;font-weight:800;margin-top:5px">${esc(note.title.en)}</div>
      <div class="tamil" style="font-size:18px;font-weight:700;opacity:.95;margin-top:2px">${esc(note.title.ta)}</div>
      ${subEn}${subTa}${periodChip}
    </div>
    <div style="color:#6E6C7C;font-size:11px;padding:8px 4px;border-bottom:1px solid ${LINE}">
      ${note.entries.length} ${note.entries.length === 1 ? 'entry' : 'entries'} &nbsp;·&nbsp; English + தமிழ் &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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

/**
 * Generate and auto-download a bilingual study-note PDF with a faint
 * "TNPSC Mentors" background watermark.
 */
export async function generateStudyNotePdf(note: StudyNote): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentW = pageW - margin * 2
  const footerSafe = pageH - 40

  // JPEG (not PNG) keeps the file small with no visible loss on text.
  const toJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.85)

  // Full-page background so the mark reaches the margins and footer band, not
  // just the blocks; built once and re-added under a fixed alias so jsPDF keeps
  // a single copy. Blocks carry the same lattice on the same page-space grid,
  // so the layers meet seamlessly.
  const NOTES_MARK = { opacity: 0.06, fontSizePt: 30, stepXPt: 250, stepYPt: 150 }
  const bg = makeWatermarkLayer(NOTES_WATERMARK, {
    pxPerPt: (RENDER_W * 2) / contentW,
    pageWPt: pageW,
    pageHPt: pageH,
    ...NOTES_MARK,
  })
  const paintBg = () => {
    if (bg) doc.addImage(bg, 'JPEG', 0, 0, pageW, pageH, 'wm-bg', 'FAST')
  }

  paintBg()

  let y = margin
  const placeCanvas = (canvas: HTMLCanvasElement) => {
    const hPt = (canvas.height / canvas.width) * contentW
    if (y + hPt > footerSafe) {
      doc.addPage()
      paintBg()
      y = margin
    }
    stampWatermark(canvas, NOTES_WATERMARK, {
      pxPerPt: canvas.width / contentW,
      pageWPt: pageW,
      pageHPt: pageH,
      originXPt: margin,
      originYPt: y,
      ...NOTES_MARK,
    })
    doc.addImage(toJpeg(canvas), 'JPEG', margin, y, contentW, hPt)
    y += hPt
  }

  // Cover (HTML so the Tamil title shapes correctly); bleeds to the page edges.
  const cover = await htmlToCanvas(coverHtml(note))
  const coverHPt = (cover.height / cover.width) * pageW
  stampWatermark(cover, NOTES_WATERMARK, {
    pxPerPt: cover.width / pageW,
    pageWPt: pageW,
    pageHPt: pageH,
    ...NOTES_MARK,
  })
  doc.addImage(toJpeg(cover), 'JPEG', 0, 0, pageW, coverHPt)
  y = coverHPt + 10

  // Each entry as its own atomic image.
  for (const entry of note.entries) {
    const canvas = await htmlToCanvas(entryBlockHtml(entry, note.layout))
    placeCanvas(canvas)
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

  await savePdfDoc(doc, `TNPSC_Mentors_Notes_${note.id}.pdf`)
}
