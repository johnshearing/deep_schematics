/**
 * Where the tiles land, in **device pixels**, and how they get painted.
 *
 * Pure functions with no DOM in them, because this arithmetic is the thing that can be wrong
 * and a canvas cannot be asserted against in jsdom. Everything here works in device pixels
 * rather than CSS pixels — that is the whole point of the exercise. A tile drawn at CSS
 * resolution on a 2× display is upscaled by the compositor before it ever reaches the panel,
 * which is half of why the text was blurry.
 *
 * Two details do real work:
 *
 * **Destination origins are rounded to whole device pixels, sizes are not.** At native zoom a
 * tile's destination width in device pixels is `(x1-x0) × dpi/72`, which is its source pixel
 * count to within the fraction of a pixel the tile renderer rounded up by — 2033.33 against a
 * PNG that is 2034 wide. So with the origin snapped, the copy is very nearly a pure
 * translation: a third of a pixel of resampling, against the 2× stretch it replaces. Rounding
 * the size as well would not close that gap (the source is genuinely 2034) and would drift the
 * geometry off the point grid the overlay depends on.
 *
 * **Off-screen tiles are skipped.** At fit zoom that saves nothing — the whole sheet is on
 * screen, so all 16 are drawn — but zoomed in it is most of them.
 */

import type { Viewport } from './useTileViewport'

export interface DeviceRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PaintTile {
  /** `[x0, y0, x1, y1]` in PDF points. */
  pdf_rect: [number, number, number, number]
  /** Null until the image has loaded, or if it failed. */
  image: CanvasImageSource | null
}

/** A rectangle in PDF points, projected onto the backing store. */
export function tileDestRect(
  rect: readonly [number, number, number, number],
  viewport: Viewport,
  dpr: number,
): DeviceRect {
  const scale = viewport.scale * dpr
  const [x0, y0, x1, y1] = rect
  return {
    x: Math.round(viewport.x * dpr + x0 * scale),
    y: Math.round(viewport.y * dpr + y0 * scale),
    w: (x1 - x0) * scale,
    h: (y1 - y0) * scale,
  }
}

/**
 * A point in PDF space, in **CSS** pixels — what a DOM overlay needs.
 *
 * Deliberately routed through `tileDestRect` rather than repeating `point × scale + offset`.
 * There must be exactly one projection in this application: the moment a marker computes its
 * own, it can disagree with the tile under it, and a marker half an inch off the component it
 * names is worse than no marker. The `/ dpr` at the end is the only difference between the two
 * — the canvas is measured in device pixels and `left`/`top` are not.
 */
export function pointToCss(
  point: readonly [number, number],
  viewport: Viewport,
  dpr: number,
): { left: number; top: number } {
  const dest = tileDestRect([point[0], point[1], point[0], point[1]], viewport, dpr)
  return { left: dest.x / dpr, top: dest.y / dpr }
}

/**
 * The inverse of `pointToCss`: where on the sheet a click in the container landed.
 *
 * This is what the Locate editor turns a mouse position into, and it lives here rather than in
 * that feature for the same reason everything else in this file does — there is one projection
 * in this application, and an editor that placed points through its own arithmetic would put
 * them where the tiles are not. `left`/`top` are CSS pixels relative to the container's
 * top-left, so a caller subtracts `getBoundingClientRect()` first.
 *
 * Not exactly `pointToCss`'s inverse to the last decimal: that one rounds its result to whole
 * device pixels, which at fit zoom is a fifth of a PDF point. Below the width of a conductor,
 * and a human is about to look at the dot anyway.
 */
export function cssToPoint(
  css: { left: number; top: number },
  viewport: Viewport,
): [number, number] {
  if (!(viewport.scale > 0)) return [0, 0]
  return [(css.left - viewport.x) / viewport.scale, (css.top - viewport.y) / viewport.scale]
}

export function overlaps(a: DeviceRect, b: DeviceRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export interface PaintArgs {
  ctx: CanvasRenderingContext2D
  /** Backing-store size, in device pixels. */
  device: { width: number; height: number }
  dpr: number
  viewport: Viewport
  /** Sheet size, in PDF points. */
  sheet: { width: number; height: number }
  tiles: PaintTile[]
}

/** Paint one frame. Returns how many tiles were actually drawn, which is what the caller
 * reports as progress and what the tests assert on. */
export function paintSheet({ ctx, device, dpr, viewport, sheet, tiles }: PaintArgs): number {
  // Identity: every coordinate below is already in device pixels.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, device.width, device.height)
  if (!(viewport.scale > 0)) return 0

  // The sheet is black line art on white. Painting the paper first means a tile that has not
  // arrived yet leaves a white gap rather than a hole onto the grey background.
  const paper = tileDestRect([0, 0, sheet.width, sheet.height], viewport, dpr)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(paper.x, paper.y, paper.w, paper.h)

  // At fit zoom a 2.4 megapixel tile is being reduced to about 140,000 pixels; the cheap
  // filter turns 4 pt lettering into grey mush.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const view: DeviceRect = { x: 0, y: 0, w: device.width, h: device.height }
  let drawn = 0
  for (const tile of tiles) {
    if (!tile.image) continue
    const dest = tileDestRect(tile.pdf_rect, viewport, dpr)
    if (!overlaps(dest, view)) continue
    ctx.drawImage(tile.image, dest.x, dest.y, dest.w, dest.h)
    drawn += 1
  }
  return drawn
}

// -- the highlighter ------------------------------------------------------------------------
//
// A wire's route, painted along the ink rather than between its ends. Here rather than in
// `MarkerLayer` for the reason that file's own header gives: 149 conductor polylines are far
// cheaper on a canvas than as DOM, and this one already owns the projection they have to agree
// with. A path is never computed — it is lifted from the PDF's own strokes or traced by a person
// (`server/app/locations.py`) — so everything below only draws what somebody authored.

/** One run of a path: two or more points in PDF points. Several of them make a path, because a
 * crossover hop is a real gap in the ink and closing it would draw a segment nobody drew. */
export type Polyline = readonly (readonly [number, number])[]

export interface RunStyle {
  /** Stroke width in **points**, so the highlight thickens with the ink as you zoom in. */
  widthPt: number
  /** …but never thinner than this in device pixels. At the 11% fit a 5 pt stroke is about three
   * device pixels, and below two it stops reading as a highlight at all. */
  minDevicePx: number
  /** Translucent, so the black conductor underneath stays readable through it: the reader is
   * checking *which* line this is, and a highlight that hid the line would answer nothing. */
  stroke: string
}

/**
 * The highlighter, and there is one of it.
 *
 * 5 pt against 16 pt conductor rows is wide enough to see at a glance and narrow enough that it
 * cannot be mistaken for covering the row above or below — which matters on a sheet where being
 * one row out names a different circuit. The colour is the selection's own, at the alpha that
 * still lets 0.5 pt line art through.
 */
export const HIGHLIGHT: RunStyle = {
  widthPt: 5,
  minDevicePx: 3,
  stroke: 'rgba(214, 74, 38, 0.42)',
}

/**
 * A run being *considered* rather than one that has been accepted — the Locate tab's proposals.
 *
 * A different colour, narrower, and more transparent than `HIGHLIGHT`, and every one of those is
 * doing a job. **Different**, because a proposal and a decision must never look alike on a sheet
 * where accepting the wrong conductor is the failure that matters. **Narrower**, so that a
 * candidate under the accepted stripe can still be seen. **More transparent**, because a person is
 * comparing it against the ink underneath, which is the whole act.
 *
 * Used for one hovered candidate at a time, and for a hand trace in progress. Those two cannot
 * happen at once — you are either comparing proposals or drawing one — which is why there is one
 * layer for both rather than two.
 */
export const CANDIDATE: RunStyle = {
  widthPt: 3.5,
  minDevicePx: 2,
  stroke: 'rgba(37, 99, 235, 0.55)',
}

/**
 * A polyline in PDF points, projected onto the backing store in **device pixels**.
 *
 * Every vertex goes through `tileDestRect`, exactly as `pointToCss` does, and that is the whole
 * design of this function: there is one projection in this application, and a highlight that
 * computed its own would eventually lie about which conductor it is on. `paint.test.ts` asserts
 * the agreement vertex by vertex rather than trusting the comment.
 */
export function polylineToDevice(
  points: Polyline,
  viewport: Viewport,
  dpr: number,
): { x: number; y: number }[] {
  return points.map((point) => {
    const dest = tileDestRect([point[0], point[1], point[0], point[1]], viewport, dpr)
    return { x: dest.x, y: dest.y }
  })
}

export interface PaintRunsArgs {
  ctx: CanvasRenderingContext2D
  dpr: number
  viewport: Viewport
  /** One wire's runs, or the union of a net's wires' runs. **One selection at a time**: two
   * highlights in one colour would say the two are the same thing, and a second colour would be
   * a legend nobody asked for. */
  runs: readonly Polyline[]
  style?: RunStyle
}

/** Paint the highlight. Returns how many runs were drawn, which is what the tests assert on —
 * jsdom has no 2D context, so the canvas itself can never be inspected. */
export function paintRuns({
  ctx,
  dpr,
  viewport,
  runs,
  style = HIGHLIGHT,
}: PaintRunsArgs): number {
  if (!(viewport.scale > 0) || runs.length === 0) return 0

  ctx.save()
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = Math.max(style.minDevicePx, style.widthPt * viewport.scale * dpr)
  // Round, so a corner of an orthogonal route does not grow a notch and a one-segment run does
  // not stop dead at its endpoint — the ink it follows has neither.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  let drawn = 0
  for (const run of runs) {
    if (run.length < 2) continue
    const points = polylineToDevice(run, viewport, dpr)
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
    ctx.stroke()
    drawn += 1
  }
  ctx.restore()
  return drawn
}
