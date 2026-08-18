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
