/**
 * The sheet itself, painted onto a canvas at device resolution.
 *
 * **This was 16 `<img>` elements under one CSS `transform: scale()`, and that is why the text
 * was blurry.** Three compounding reasons, all of which the canvas removes rather than
 * mitigates:
 *
 * 1. The scaled plane carried `will-change: transform`, which promotes it to a composited
 *    layer. The browser rasterizes such a layer once and then GPU-stretches the cached
 *    texture as the transform changes — so zooming magnified a bitmap rasterized at the *old*
 *    scale. "Magnifying does not help" is the signature of that bug, not of a low-resolution
 *    source: a 1:1 crop of any tile is crisp, and label text on this sheet is 22.9 px tall at
 *    400 DPI.
 * 2. At native zoom that plane was 6800×4400 CSS px, past the maximum texture size on most
 *    GPUs, which forces a reduced-scale rasterization and a stretch back up.
 * 3. Everything was sized in CSS pixels, so on a 2× display even a correct rasterization was
 *    upscaled once more before it reached the panel.
 *
 * A canvas has no composited-layer cache to go stale, no layer larger than the viewport, and
 * a backing store measured in device pixels. Every frame is rasterized from the source PNGs at
 * the current zoom, which is what the browser's own PDF viewer does in the tab the reader
 * compared against — the difference being that we still stop at the tiles' 400 DPI, where the
 * vector original does not stop at all. Rendering the PDF itself with pdf.js onto this same
 * canvas is the remaining upgrade, and it changes nothing above this line.
 *
 * **The point-space seam is unchanged.** `paint.ts` projects PDF points onto the backing
 * store, so a marker at `components[].location` or a conductor polyline out of `geometry.json`
 * is still the same one-line conversion — it just goes through `tileDestRect` instead of
 * through CSS `left`/`top`. Clickable overlays will sit in a DOM layer above this canvas,
 * which is why the canvas does not swallow pointer events.
 *
 * The `<img>` elements survive as loaders. They are hidden and never painted directly, but
 * they are how the browser fetches, decodes, caches and reports `load`/`error`, and doing that
 * by hand with `new Image()` would buy nothing and lose the ability to assert on it.
 */

import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'

import { tileUrl } from '@/api/client'
import type { Tile } from '@/api/types'
import { CANDIDATE, paintRuns, paintSheet, type Polyline } from './paint'
import type { Viewport } from './useTileViewport'

interface Props {
  tiles: Tile[]
  /** Sheet size in PDF points. */
  width: number
  height: number
  viewport: Viewport
  /** Container size in CSS pixels. */
  size: { width: number; height: number }
  /** Device pixels per CSS pixel. */
  dpr: number
  /**
   * The highlighted wire's runs, or the union of a net's wires' — **one selection at a time.**
   *
   * Painted here, in the same frame as the tiles, rather than on a layer of its own: it is the
   * one overlay with no interaction in it, it goes *under* the DOM markers, and a second canvas
   * would be a second thing to keep in step with the viewport. Absent, or empty, is the normal
   * state — nothing is highlighted until somebody selects a wire or a net that has a path.
   */
  runs?: readonly Polyline[]
  /**
   * Runs being *considered* rather than accepted — the Locate tab's hovered candidate, or a hand
   * trace as it is being drawn.
   *
   * Painted **under** `runs` and in `CANDIDATE`'s own colour, so a proposal can never be mistaken
   * for a decision on a sheet where accepting the wrong conductor is the failure that matters.
   * One layer serves both because the two cannot happen at once: you are either comparing
   * proposals or drawing one.
   */
  candidates?: readonly Polyline[]
  onTileSettled: (file: string, ok: boolean) => void
}

/** A broken image still has `complete === true`, so the natural size is the real test. */
function ready(image: HTMLImageElement | undefined): HTMLImageElement | null {
  return image && image.complete && image.naturalWidth > 0 ? image : null
}

export const TileSheet = memo(function TileSheet({
  tiles,
  width,
  height,
  viewport,
  size,
  dpr,
  runs,
  candidates,
  onTileSettled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useRef(new Map<string, HTMLImageElement>())
  const frame = useRef(0)
  // Bumped on every load or error purely to re-run the paint effect. The images themselves
  // live in a ref, so nothing else here would notice one arriving.
  const [arrivals, setArrivals] = useState(0)

  const settle = useCallback(
    (file: string, ok: boolean) => {
      setArrivals((n) => n + 1)
      onTileSettled(file, ok)
    },
    [onTileSettled],
  )

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const device = {
      width: Math.max(1, Math.round(size.width * dpr)),
      height: Math.max(1, Math.round(size.height * dpr)),
    }
    // Assigning either dimension clears the canvas, so only do it when it actually changed.
    if (canvas.width !== device.width) canvas.width = device.width
    if (canvas.height !== device.height) canvas.height = device.height

    // A wheel burst delivers several events per frame and each one re-renders. Coalescing to
    // one paint per frame keeps a fast zoom from queueing sixteen redundant redraws.
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      paintSheet({
        ctx,
        device,
        dpr,
        viewport,
        sheet: { width, height },
        tiles: tiles.map((tile) => ({
          pdf_rect: tile.pdf_rect,
          image: ready(images.current.get(tile.file)),
        })),
      })
      // After the tiles, so the highlight lies over the ink it follows, and before the DOM
      // markers, which are a layer above this canvas entirely.
      if (candidates?.length) {
        paintRuns({ ctx, dpr, viewport, runs: candidates, style: CANDIDATE })
      }
      if (runs?.length) paintRuns({ ctx, dpr, viewport, runs })
    })
    return () => cancelAnimationFrame(frame.current)
  }, [tiles, width, height, viewport, size.width, size.height, dpr, runs, candidates, arrivals])

  return (
    <>
      <canvas
        ref={canvasRef}
        /* How many runs this frame was asked to highlight. **The only assertable trace of the
           highlight there is**: `test-setup.ts` forces `getContext('2d')` to null, so nothing
           painted on this canvas can be read back through the DOM. The arithmetic is tested
           directly in `paint.test.ts`, and this is how a screen test knows the right runs reached
           the sheet. The same idiom as `data-end-label` and `data-ink-ring`. */
        data-runs={runs?.length ?? 0}
        /* And how many were offered rather than accepted, read the same way and for the same
           reason: nothing painted on this canvas can be read back through the DOM. */
        data-candidates={candidates?.length ?? 0}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />

      {/* Loaders, not content. `hidden` still fetches and decodes; it just never composites,
          which is the job — the canvas is the only thing that draws. */}
      <div hidden aria-hidden="true">
        {tiles.map((tile) => (
          <img
            key={tile.file}
            src={tileUrl(tile.file)}
            alt=""
            ref={(element) => {
              if (element) images.current.set(tile.file, element)
              else images.current.delete(tile.file)
            }}
            onLoad={() => settle(tile.file, true)}
            onError={() => settle(tile.file, false)}
          />
        ))}
      </div>
    </>
  )
})
