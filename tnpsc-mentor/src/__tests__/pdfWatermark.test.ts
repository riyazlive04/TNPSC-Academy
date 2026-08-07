import { describe, it, expect } from 'vitest'
import { stampWatermark, pdfWatermark } from '../lib/pdfWatermark'

/**
 * The watermark used to be jsPDF text with an ExtGState alpha, which several
 * Android PDF viewers ignore — the faint mark rendered as a solid violet
 * lattice over the questions. It is now composited into the page raster, so
 * these guard the compositing contract: it must actually draw, it must respect
 * the alpha, and it must place tiles in page space rather than block space.
 */

interface Call {
  op: string
  args: unknown[]
}

/** Minimal 2D-context spy — jsdom has no canvas backend. */
function fakeCanvas(width: number, height: number) {
  const calls: Call[] = []
  const state = { globalAlpha: 1, fillStyle: '', font: '', textBaseline: '' }
  const ctx = {
    get globalAlpha() {
      return state.globalAlpha
    },
    set globalAlpha(v: number) {
      state.globalAlpha = v
      calls.push({ op: 'globalAlpha', args: [v] })
    },
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(v: string) {
      state.fillStyle = v
      calls.push({ op: 'fillStyle', args: [v] })
    },
    get font() {
      return state.font
    },
    set font(v: string) {
      state.font = v
      calls.push({ op: 'font', args: [v] })
    },
    textBaseline: '',
    save: () => calls.push({ op: 'save', args: [] }),
    restore: () => calls.push({ op: 'restore', args: [] }),
    translate: (x: number, y: number) => calls.push({ op: 'translate', args: [x, y] }),
    rotate: (r: number) => calls.push({ op: 'rotate', args: [r] }),
    fillText: (t: string, x: number, y: number) => calls.push({ op: 'fillText', args: [t, x, y] }),
  }
  const canvas = {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

const A4 = { pageWPt: 595, pageHPt: 842 }

describe('stampWatermark', () => {
  it('draws the mark tiled across the block', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, 'STUDENT · 780', { pxPerPt: 3, ...A4 })
    const draws = calls.filter((c) => c.op === 'fillText')
    expect(draws.length).toBeGreaterThan(0)
    expect(draws.every((c) => c.args[0] === 'STUDENT · 780')).toBe(true)
  })

  it('composites at the faint alpha instead of full strength', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, 'MARK', { pxPerPt: 3, ...A4 })
    expect(calls.find((c) => c.op === 'globalAlpha')?.args[0]).toBe(0.08)
    expect(calls.find((c) => c.op === 'fillStyle')?.args[0]).toBe('#7C5CFF')
  })

  it('honours an explicit opacity override', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, 'MARK', { pxPerPt: 3, opacity: 0.06, ...A4 })
    expect(calls.find((c) => c.op === 'globalAlpha')?.args[0]).toBe(0.06)
  })

  it('rotates counter-clockwise, matching the old jsPDF angle', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, 'MARK', { pxPerPt: 3, ...A4 })
    const rot = calls.find((c) => c.op === 'rotate')!.args[0] as number
    expect(rot).toBeCloseTo((-30 * Math.PI) / 180, 6)
  })

  it('offsets tiles into page space so blocks continue one lattice', () => {
    // Same block placed at two different page positions must not draw its
    // tiles at the same local coordinates — otherwise every block restarts the
    // grid and the seams show.
    const top = fakeCanvas(1520, 400)
    stampWatermark(top.canvas, 'MARK', { pxPerPt: 3, originYPt: 70, ...A4 })
    const lower = fakeCanvas(1520, 400)
    stampWatermark(lower.canvas, 'MARK', { pxPerPt: 3, originYPt: 110, ...A4 })

    const ys = (c: ReturnType<typeof fakeCanvas>) =>
      c.calls.filter((k) => k.op === 'translate').map((k) => k.args[1])
    expect(ys(top)).not.toEqual(ys(lower))
  })

  it('skips tiles that fall outside the block', () => {
    // A short block near the top of the page must not pay for the whole page's
    // worth of tiles.
    const short = fakeCanvas(1520, 120)
    stampWatermark(short.canvas, 'MARK', { pxPerPt: 3, originYPt: 70, ...A4 })
    const tall = fakeCanvas(1520, 2200)
    stampWatermark(tall.canvas, 'MARK', { pxPerPt: 3, originYPt: 70, ...A4 })
    const count = (c: ReturnType<typeof fakeCanvas>) =>
      c.calls.filter((k) => k.op === 'fillText').length
    expect(count(short)).toBeLessThan(count(tall))
  })

  it('is a no-op without a mark, so unwatermarked exports are untouched', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, '', { pxPerPt: 3, ...A4 })
    expect(calls).toHaveLength(0)
  })

  it('balances save/restore so later drawing is unaffected', () => {
    const { canvas, calls } = fakeCanvas(1520, 800)
    stampWatermark(canvas, 'MARK', { pxPerPt: 3, ...A4 })
    expect(calls.filter((c) => c.op === 'save')).toHaveLength(
      calls.filter((c) => c.op === 'restore').length
    )
  })
})

describe('pdfWatermark', () => {
  it('traces a download to the name and phone that made it', () => {
    expect(
      pdfWatermark({ full_name: 'Student', phone: '7806966124' } as never)
    ).toBe('STUDENT  ·  7806966124')
  })

  it('falls back to the email handle when there is no name', () => {
    expect(pdfWatermark({ email: 'aspirant@mail.com' } as never)).toBe('ASPIRANT')
  })

  it('returns nothing without a profile, so callers skip the mark', () => {
    expect(pdfWatermark(null)).toBe('')
  })
})
