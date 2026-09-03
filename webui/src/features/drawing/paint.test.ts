/**
 * The arithmetic that decides whether the drawing is sharp.
 *
 * A canvas cannot be inspected in jsdom, and even in a real browser "is this blurry?" is not
 * an assertion. What *is* assertable is the thing that was wrong: the projection from PDF
 * points to device pixels. If a tile's destination size in device pixels matches its source
 * pixel count and its origin is a whole number, the browser is copying pixels rather than
 * stretching them, and the result is as crisp as the PNG. These tests pin that down.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  cssToPoint,
  HIGHLIGHT,
  overlaps,
  paintRuns,
  paintSheet,
  pointToCss,
  polylineToDevice,
  tileDestRect,
  type PaintTile,
  type Polyline,
} from './paint'

/** The real sheet: 1224×792 pt rendered at 400 DPI into a 4×4 grid. */
const SHEET = { width: 1224, height: 792 }
const DPI = 400
const TILE: [number, number, number, number] = [582, 366, 948, 624]

function recordingContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    // The highlighter's half of the context. `save`/`restore` are in here because the stroke
    // settings must not leak into the next frame's tiles.
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low' as CanvasRenderingContext2D['imageSmoothingQuality'],
  }
}

type Recording = ReturnType<typeof recordingContext>

function paint(context: Recording, viewport: { x: number; y: number; scale: number }, dpr: number,
               tiles: PaintTile[], device = { width: 1600, height: 1200 }) {
  return paintSheet({
    ctx: context as unknown as CanvasRenderingContext2D,
    device, dpr, viewport, sheet: SHEET, tiles,
  })
}

const IMAGE = {} as CanvasImageSource

describe('tileDestRect', () => {
  it('draws a tile at its own pixel count at native zoom, whatever the display density', () => {
    // Native zoom is `dpi / 72 / dpr` — the `/ dpr` being the correction this change turns on.
    // On a 2× display it is half the CSS-pixel scale it used to be, and the device-pixel
    // result is identical, which is the property that matters.
    for (const dpr of [1, 2, 3]) {
      const scale = DPI / 72 / dpr
      const dest = tileDestRect(TILE, { x: 37.4, y: -12.9, scale }, dpr)
      // (948 - 582) pt × 400/72 = 2033.33 device px, against a PNG the renderer rounded up to
      // 2034. A third of a pixel of resampling, not a stretch.
      expect(dest.w).toBeCloseTo((948 - 582) * (DPI / 72), 6)
      expect(dest.h).toBeCloseTo((624 - 366) * (DPI / 72), 6)
      // Whole device pixels, so what resampling remains is not compounded by a fractional
      // offset.
      expect(Number.isInteger(dest.x)).toBe(true)
      expect(Number.isInteger(dest.y)).toBe(true)
    }
  })

  it('projects points through the viewport offset and scale', () => {
    const dest = tileDestRect([10, 20, 110, 70], { x: 5, y: 7, scale: 2 }, 2)
    // scale × dpr = 4 device px per point.
    expect(dest).toEqual({ x: 5 * 2 + 10 * 4, y: 7 * 2 + 20 * 4, w: 400, h: 200 })
  })
})

describe('pointToCss', () => {
  it('lands a marker on the same spot as the tile under it, at any density', () => {
    // The property that matters is agreement with `tileDestRect`, not the numbers themselves:
    // a marker that computes its own projection can drift off the drawing it annotates.
    const viewport = { x: 37.4, y: -12.9, scale: 1.3 }
    for (const dpr of [1, 2, 3]) {
      const marker = pointToCss([861, 679], viewport, dpr)
      const tile = tileDestRect([861, 679, 900, 700], viewport, dpr)
      expect(marker.left).toBeCloseTo(tile.x / dpr, 6)
      expect(marker.top).toBeCloseTo(tile.y / dpr, 6)
    }
  })

  it('is in CSS pixels, because `left` and `top` are', () => {
    // Same viewport, twice the density: the device-pixel origin doubles and the CSS one does
    // not. Getting this backwards puts every marker at twice its offset on a retina display.
    expect(pointToCss([100, 50], { x: 0, y: 0, scale: 2 }, 1)).toEqual({ left: 200, top: 100 })
    expect(pointToCss([100, 50], { x: 0, y: 0, scale: 2 }, 2)).toEqual({ left: 200, top: 100 })
  })
})

describe('cssToPoint', () => {
  it('is the inverse of pointToCss, which is what makes a click a coordinate', () => {
    // The Locate editor writes what this returns into an authored file, so the round trip is the
    // property: place a dot on the sheet, click it, get the same point back. Its own arithmetic
    // would eventually disagree with the tiles, and the dots would land plausibly and be wrong.
    const viewport = { x: 12, y: 48.94, scale: 0.634 }
    for (const point of [
      [0, 0],
      [154.5, 348.3],
      [861, 679],
      [1224, 792],
    ] as [number, number][]) {
      const css = pointToCss(point, viewport, 2)
      const back = cssToPoint(css, viewport)
      // `pointToCss` snaps to whole *device* pixels, so up to half of one comes back — 0.4 pt
      // at this zoom, well under the 16 pt spacing of the rows this has to distinguish.
      expect(back[0]).toBeCloseTo(point[0], 0)
      expect(back[1]).toBeCloseTo(point[1], 0)
    }
  })

  it('converts a CSS delta into a sheet delta when the offset is dropped', () => {
    // How a drag moves a dot: the offset is zeroed so only the scale applies, which is why a
    // drag needs no container rectangle and cannot drift as the sheet is panned under it.
    const viewport = { x: 999, y: -40, scale: 0.634 }
    const [dx, dy] = cssToPoint({ left: 63.4, top: -12.68 }, { ...viewport, x: 0, y: 0 })
    expect(dx).toBeCloseTo(100, 6)
    expect(dy).toBeCloseTo(-20, 6)
  })

  it('answers the origin rather than dividing by zero before the sheet is measured', () => {
    expect(cssToPoint({ left: 400, top: 300 }, { x: 0, y: 0, scale: 0 })).toEqual([0, 0])
  })
})

describe('overlaps', () => {
  const view = { x: 0, y: 0, w: 100, h: 100 }
  it('is true for a rectangle straddling an edge', () => {
    expect(overlaps({ x: -10, y: 50, w: 20, h: 20 }, view)).toBe(true)
  })
  it('is false for one that only touches, and for one entirely outside', () => {
    expect(overlaps({ x: 100, y: 0, w: 20, h: 20 }, view)).toBe(false)
    expect(overlaps({ x: 500, y: 500, w: 20, h: 20 }, view)).toBe(false)
  })
})

describe('paintSheet', () => {
  const tiles: PaintTile[] = [
    { pdf_rect: [0, 0, 642, 792], image: IMAGE },
    { pdf_rect: [582, 0, 1224, 792], image: IMAGE },
  ]

  it('draws in device pixels and asks for the good downscale filter', () => {
    const ctx = recordingContext()
    paint(ctx, { x: 0, y: 0, scale: 1 }, 2, tiles)

    // Identity transform: every coordinate handed to the context is already device pixels.
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1600, 1200)
    // At fit zoom a 2.4 megapixel tile is reduced to about 140,000; the default filter turns
    // 4 pt lettering into grey mush.
    expect(ctx.imageSmoothingQuality).toBe('high')
  })

  it('paints the paper white before the tiles, so a slow tile is a gap and not a hole', () => {
    const ctx = recordingContext()
    paint(ctx, { x: 10, y: 20, scale: 0.5 }, 1, tiles)

    expect(ctx.fillStyle).toBe('#ffffff')
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 612, 396)
    expect(ctx.drawImage).toHaveBeenCalledTimes(2)
  })

  it('skips tiles that are off screen', () => {
    const ctx = recordingContext()
    // Zoomed into the far left of the sheet: the second tile starts at 582 pt, which at this
    // scale is 5820 device px — well past a 1600 px viewport.
    const drawn = paint(ctx, { x: 0, y: 0, scale: 10 }, 1, tiles)

    expect(drawn).toBe(1)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
  })

  it('skips tiles that have not arrived, and reports how many it drew', () => {
    const ctx = recordingContext()
    const drawn = paint(ctx, { x: 0, y: 0, scale: 1 }, 1, [tiles[0], { ...tiles[1], image: null }])

    expect(drawn).toBe(1)
  })

  it('clears but draws nothing before the container has been measured', () => {
    const ctx = recordingContext()
    const drawn = paint(ctx, { x: 0, y: 0, scale: 0 }, 1, tiles)

    expect(drawn).toBe(0)
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
})

/**
 * The highlighter — a wire's route painted along the ink.
 *
 * The thing worth testing is the same thing as everywhere else in this file: that it agrees with
 * the projection the tiles use. A highlight half a row out is worse than no highlight, because it
 * names the wrong circuit with complete confidence — on a sheet whose conductor rows are 16 pt
 * apart, and where `W052`'s straight chord would miss its own run by 300 pt.
 */
describe('polylineToDevice', () => {
  /** `C0080`: the BLUE 18AWG run of net 120, one horizontal segment at y = 663.7. */
  const C0080: Polyline = [
    [379.8, 663.7],
    [301.8, 663.7],
  ]

  it('puts every vertex exactly where pointToCss puts the same point', () => {
    // The invariant, vertex by vertex: there is one projection in this application. A second one
    // would drift the highlight off the conductor it is claiming to be.
    const viewport = { x: 37.4, y: -12.9, scale: 1.3 }
    for (const dpr of [1, 2, 3]) {
      const device = polylineToDevice(C0080, viewport, dpr)
      C0080.forEach((point, index) => {
        const css = pointToCss(point, viewport, dpr)
        expect(device[index].x / dpr).toBeCloseTo(css.left, 6)
        expect(device[index].y / dpr).toBeCloseTo(css.top, 6)
      })
    }
  })

  it('keeps a horizontal run horizontal at every zoom', () => {
    // A conductor row is the thing a reader is checking, so the one visual property that must
    // never wobble is that a run at one y stays at one y.
    for (const scale of [0.634, 1, 5.56]) {
      const device = polylineToDevice(C0080, { x: 12, y: 48.94, scale }, 2)
      expect(device[0].y).toBe(device[1].y)
      expect(device[0].x).toBeGreaterThan(device[1].x)
    }
  })
})

describe('paintRuns', () => {
  const RUNS: Polyline[] = [
    [
      [379.8, 663.7],
      [301.8, 663.7],
    ],
    [
      [301.8, 639.6],
      [426.3, 639.6],
    ],
  ]

  it('strokes each run once, and returns how many it drew', () => {
    const ctx = recordingContext()
    const drawn = paintRuns({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      dpr: 2,
      viewport: { x: 0, y: 0, scale: 1 },
      runs: RUNS,
    })

    expect(drawn).toBe(2)
    expect(ctx.beginPath).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
    // One moveTo per run and one lineTo per further point: a two-point run is 1 and 1.
    expect(ctx.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx.lineTo).toHaveBeenCalledTimes(2)
    // Whole device pixels, exactly as `pointToCss` rounds — a fifth of a point at the fit zoom.
    expect(ctx.moveTo).toHaveBeenCalledWith(Math.round(379.8 * 2), Math.round(663.7 * 2))
    // Round caps and joins, because the ink it follows has neither a notch at a corner nor a
    // square end. And save/restore, so none of it leaks into the next frame's tiles.
    expect([ctx.lineCap, ctx.lineJoin]).toEqual(['round', 'round'])
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('measures its width in points, so the highlight thickens with the ink', () => {
    // Not in pixels: a stroke of fixed pixel width would cover four conductor rows at 400% and
    // be invisible at the 11% fit. The clamp is the floor under the second half of that.
    const wide = recordingContext()
    paintRuns({
      ctx: wide as unknown as CanvasRenderingContext2D,
      dpr: 1,
      viewport: { x: 0, y: 0, scale: 4 },
      runs: RUNS,
    })
    expect(wide.lineWidth).toBeCloseTo(HIGHLIGHT.widthPt * 4, 6)

    const fitted = recordingContext()
    paintRuns({
      ctx: fitted as unknown as CanvasRenderingContext2D,
      dpr: 1,
      // The 11% fit, where 5 pt is about three device pixels and the clamp starts to matter.
      viewport: { x: 12, y: 48.94, scale: 0.1 },
      runs: RUNS,
    })
    expect(fitted.lineWidth).toBe(HIGHLIGHT.minDevicePx)
  })

  it('draws nothing before the sheet is measured, and nothing for a run of one point', () => {
    // A single point is not a route. It reaches here only from a hand edit — the server refuses
    // it into `problems` — and half a route drawn is worse than none.
    const unmeasured = recordingContext()
    expect(
      paintRuns({
        ctx: unmeasured as unknown as CanvasRenderingContext2D,
        dpr: 1,
        viewport: { x: 0, y: 0, scale: 0 },
        runs: RUNS,
      }),
    ).toBe(0)
    expect(unmeasured.stroke).not.toHaveBeenCalled()

    const stub = recordingContext()
    expect(
      paintRuns({
        ctx: stub as unknown as CanvasRenderingContext2D,
        dpr: 1,
        viewport: { x: 0, y: 0, scale: 1 },
        runs: [[[379.8, 663.7]]],
      }),
    ).toBe(0)
    expect(stub.stroke).not.toHaveBeenCalled()
  })

  it('is translucent, so the conductor it marks is still readable through it', () => {
    // The reader is deciding *which* of these lines it is. A highlight that hid the line would
    // answer the question by removing the evidence.
    const ctx = recordingContext()
    paintRuns({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      dpr: 1,
      viewport: { x: 0, y: 0, scale: 1 },
      runs: RUNS,
    })
    expect(ctx.strokeStyle).toBe(HIGHLIGHT.stroke)
    expect(HIGHLIGHT.stroke).toMatch(/rgba\(.+0\.\d+\)$/)
  })
})
