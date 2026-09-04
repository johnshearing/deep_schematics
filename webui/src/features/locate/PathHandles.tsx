/**
 * The corners of a **hand-traced** route, draggable.
 *
 * ### Why only a hand-traced one
 *
 * `geometry: extracted` is a claim about the polyline itself: *these corners are the drawing's,
 * not mine*. A dragged vertex would leave that claim standing over a line a person had altered —
 * geometry that says it is the PDF's own vector data and is not — which is the same class of lie as
 * storing a computed label side as though somebody had chosen it (invariant 10). So a lifted route
 * has no handles at all, and the panel offers an explicit conversion instead. This component is
 * only ever rendered for `geometry: human`; the refusal is *also* in `model.movePathVertex`, from
 * the other side, deliberately.
 *
 * ### Why it is its own overlay and not part of `MarkerLayer`
 *
 * `MarkerLayer` draws designators — things the index has an id for, that can be selected, that
 * carry labels and provenance. A corner is none of those: it has no id, it is not selectable, and
 * it exists only while one wire is armed on one tab. Two different things that happen to both be
 * absolutely-positioned dots.
 *
 * Through `pointToCss` and `cssToPoint` like everything else on the sheet: **there is one
 * projection in this application**, and a handle that computed its own would sit a little away
 * from the line it is supposed to be a corner of.
 */

import { useRef } from 'react'

import type { Polyline } from '@/api/types'
import { cssToPoint, pointToCss } from '@/features/drawing/paint'
import type { Viewport } from '@/features/drawing/useTileViewport'

/** The same 3 CSS pixels of pointer travel `MarkerLayer` uses before a press becomes a drag.
 * Small enough that a deliberate nudge works, large enough that a shaky click does not move
 * anything. */
const DRAG_SLOP = 3

interface Props {
  runs: readonly Polyline[]
  viewport: Viewport
  dpr: number
  /** Fires on every pointer move past the slop, like a marker drag — so the caller coalesces the
   * undo entry by gesture rather than by frame. */
  onMove: (run: number, vertex: number, point: [number, number]) => void
  onDragEnd: () => void
}

export function PathHandles({ runs, viewport, dpr, onMove, onDragEnd }: Props) {
  return (
    <>
      {runs.map((run, index) =>
        run.map((corner, vertex) => (
          <Handle
            key={`${index}:${vertex}`}
            corner={corner}
            viewport={viewport}
            dpr={dpr}
            label={`Corner ${vertex + 1} of run ${index + 1}`}
            onMove={(point) => onMove(index, vertex, point)}
            onDragEnd={onDragEnd}
          />
        )),
      )}
    </>
  )
}

function Handle({
  corner,
  viewport,
  dpr,
  label,
  onMove,
  onDragEnd,
}: {
  corner: [number, number]
  viewport: Viewport
  dpr: number
  label: string
  onMove: (point: [number, number]) => void
  onDragEnd: () => void
}) {
  const { left, top } = pointToCss(corner, viewport, dpr)
  const dragged = useRef(false)
  const from = useRef<{ x: number; y: number } | null>(null)

  return (
    <button
      type="button"
      aria-label={label}
      data-path-handle={label}
      title="Drag to move this corner. Shift is not needed; Ctrl+Z puts it back."
      style={{ left, top }}
      className={
        'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-sm border ' +
        'border-white bg-[var(--color-danger)] shadow-[0_0_0_1px_rgba(0,0,0,0.4)]'
      }
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragged.current = false
        from.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        const start = from.current
        if (!start) return
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP) return
        dragged.current = true
        // Read the pointer against the sheet, not against this element: the handle is centred on
        // its own corner, so an offset from the element's box would move the corner to the corner.
        const sheet = event.currentTarget.parentElement?.getBoundingClientRect()
        if (!sheet) return
        onMove(
          cssToPoint(
            { left: event.clientX - sheet.left, top: event.clientY - sheet.top },
            viewport,
          ),
        )
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        from.current = null
        if (dragged.current) onDragEnd()
        dragged.current = false
      }}
      /* A press that never travelled is not a drag and must not become one on the next frame. */
      onPointerCancel={() => {
        from.current = null
        dragged.current = false
      }}
    />
  )
}
