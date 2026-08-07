import type { Profile } from '../types'

/**
 * The personalised diagonal watermark tiled across a downloaded PDF: the
 * downloader's name and phone (falling back to their email handle, then the
 * brand). A shared/leaked sheet stays traceable to whoever generated it.
 *
 * Used by every student-facing PDF export (explanation sheet, CA magazine, CA
 * question sets) so the mark is identical everywhere. Returns '' when there's
 * no profile — callers treat an empty string as "no watermark".
 */
export function pdfWatermark(profile: Profile | null | undefined): string {
  if (!profile) return ''
  const name = (profile.full_name?.trim() || profile.email?.split('@')[0] || 'TNPSC MENTOR').toUpperCase()
  return [name, profile.phone?.trim()].filter(Boolean).join('  ·  ')
}

/** The site's public address, shown in every PDF footer. */
export const SITE_URL = 'tnpscmentors.in'

/**
 * The watermark for copies that are PUBLISHED rather than downloaded by one
 * student — currently the current-affairs PDFs posted to the Telegram channel.
 * There is no person to trace, so the mark carries the brand and the site
 * instead: wherever the file is forwarded, it says where it came from.
 * Latin-only, like pdfWatermark, so jsPDF's built-in Helvetica can draw it.
 */
export const BRAND_WATERMARK = `TNPSC MENTORS  ·  ${SITE_URL.toUpperCase()}`

/** Brand violet, as a CSS colour for canvas compositing. */
const VIOLET_CSS = '#7C5CFF'

export interface StampOptions {
  /** Canvas pixels per PDF point, so the mark scales with the placed image. */
  pxPerPt: number
  /** Page size in points — the tile grid is laid out over the whole page. */
  pageWPt: number
  pageHPt: number
  /** Page coords (pt) of this canvas's top-left, so tiles line up across blocks. */
  originXPt?: number
  originYPt?: number
  opacity?: number
  fontSizePt?: number
  stepXPt?: number
  stepYPt?: number
  /** Degrees counter-clockwise, matching jsPDF's `doc.text(…, { angle })`. */
  angleDeg?: number
}

/**
 * Stamp the tiled diagonal watermark INTO a rasterised page block.
 *
 * Why this isn't drawn with jsPDF text + `setGState({ opacity })`, which is what
 * every one of these exports used to do: that encodes the transparency as an
 * ExtGState soft mask, and the PDF viewers Android reaches through the share
 * sheet (Drive, Files, several OEM readers) quietly ignore it. The mark then
 * paints at FULL strength — a solid violet lattice across the page that buries
 * the questions. It looked correct only where it was tested, in a desktop
 * browser, because pdf.js does honour the alpha.
 *
 * Compositing onto the canvas instead flattens the blend into the JPEG that
 * gets embedded, so the file carries no transparency at all and every renderer
 * is forced to agree. Text stays readable through the mark because the blend
 * already happened, against the real pixels underneath.
 *
 * Mutates `canvas` in place; call it before converting to JPEG.
 */
export function stampWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  opts: StampOptions
): void {
  if (!text) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const {
    pxPerPt,
    pageWPt,
    pageHPt,
    originXPt = 0,
    originYPt = 0,
    opacity = 0.08,
    fontSizePt = 26,
    stepXPt = 280,
    stepYPt = 120,
    angleDeg = 30,
  } = opts

  // Canvas rotation is clockwise-positive (y grows downward); jsPDF's `angle`
  // is counter-clockwise. Negate so the mark keeps the direction it always had.
  const rad = (-angleDeg * Math.PI) / 180
  const hPt = canvas.height / pxPerPt

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = VIOLET_CSS
  ctx.font = `bold ${fontSizePt * pxPerPt}px Helvetica, Arial, sans-serif`
  ctx.textBaseline = 'alphabetic'

  // Walk the grid in PAGE space, then translate into this block's local space,
  // so consecutive blocks on one page continue the same lattice instead of each
  // restarting it. Tiles far outside the block are skipped, not clipped, since
  // a rotated string reaches well past its origin.
  const reachPt = fontSizePt * 2 + stepYPt
  for (let yy = 70; yy < pageHPt; yy += stepYPt) {
    const localYPt = yy - originYPt
    if (localYPt < -reachPt || localYPt > hPt + reachPt) continue
    for (let xx = -10; xx < pageWPt; xx += stepXPt) {
      ctx.save()
      ctx.translate((xx - originXPt) * pxPerPt, localYPt * pxPerPt)
      ctx.rotate(rad)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
}

/**
 * A full-page watermark layer, as a JPEG data URL, to lay down as the page
 * BACKGROUND before any content goes on it.
 *
 * Stamping the blocks alone leaves the mark only where content sits — margins,
 * the gaps between questions and the footer band all came out bare. This paints
 * the lattice across the entire sheet; the content blocks then land on top
 * carrying their own stamp on the SAME page-space grid, so the two layers line
 * up seamlessly instead of showing a seam at every block edge.
 *
 * Opaque white behind the mark, so it stays a background rather than relying on
 * transparency — the whole point of doing this in raster (see stampWatermark).
 */
export function makeWatermarkLayer(
  text: string,
  opts: Omit<StampOptions, 'originXPt' | 'originYPt'>
): string {
  const { pxPerPt, pageWPt, pageHPt } = opts
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pageWPt * pxPerPt)
  canvas.height = Math.round(pageHPt * pxPerPt)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  stampWatermark(canvas, text, opts)
  return canvas.toDataURL('image/jpeg', 0.85)
}
