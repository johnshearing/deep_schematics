/**
 * The sheet itself: 16 PNGs placed absolutely under one CSS transform.
 *
 * There is no rendering work here and that is the point — `webui_ideas.md` §2 observed that
 * the images already exist and the manifest already carries their rectangles, so the viewer
 * is a coordinate system and a transform rather than a renderer.
 *
 * The plane is measured in **PDF points**, not pixels. `scale` is the only thing that turns
 * points into screen pixels, which means anything else expressed in points — a marker at
 * `components[].location`, a conductor polyline out of `geometry.json` — drops in as a
 * sibling of the tiles and lands in the right place with no further arithmetic. That is the
 * seam the component overlay and the bidirectional citation are meant to arrive through.
 *
 * The tiles overlap by 30 pt by design (the vision pass needed the margin). Drawn at their
 * own rectangles the overlaps paint identical pixels over each other, so there is nothing to
 * reconcile and no seams.
 */

import { memo } from 'react'

import { tileUrl } from '@/api/client'
import type { Tile } from '@/api/types'
import type { Viewport } from './useTileViewport'

interface Props {
  tiles: Tile[]
  /** Sheet size in PDF points. */
  width: number
  height: number
  viewport: Viewport
  onTileSettled: (file: string, ok: boolean) => void
}

export const TileSheet = memo(function TileSheet({
  tiles,
  width,
  height,
  viewport,
  onTileSettled,
}: Props) {
  return (
    <div
      className="absolute top-0 left-0 origin-top-left bg-white"
      style={{
        width,
        height,
        transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
        willChange: 'transform',
      }}
    >
      {tiles.map((tile) => {
        const [x0, y0, x1, y1] = tile.pdf_rect
        return (
          <img
            key={tile.file}
            src={tileUrl(tile.file)}
            // Empty rather than "tile row 1 column 4": the grid is an artifact of how the
            // sheet was rendered and means nothing to a reader who cannot see it.
            alt=""
            draggable={false}
            onLoad={() => onTileSettled(tile.file, true)}
            onError={() => onTileSettled(tile.file, false)}
            className="pointer-events-none absolute select-none"
            style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
          />
        )
      })}
    </div>
  )
})
