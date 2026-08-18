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
  overlaps,
  paintSheet,
  pointToCss,
  tileDestRect,
  type PaintTile,
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
    fillStyle: '',
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
