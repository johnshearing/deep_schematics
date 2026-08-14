/**
 * The 47 components, as things you can click, above the sheet you can only look at.
 *
 * **DOM, not canvas, and that is a deliberate split.** Markers need hit-testing, focus, tab
 * order, tooltips and a keyboard path — all free in the DOM and all hand-rolled in a canvas.
 * The opposite call comes with net highlighting: 149 conductor polylines need none of that and
 * are far cheaper painted, so they will go into `paint.ts` rather than here. The rule is
 * "interactive in the DOM, decorative in the canvas".
 *
 * Everything is positioned through `pointToCss`, which is `paint.ts`'s own projection divided
 * by the device-pixel ratio. There is exactly one projection in this application; a second one
 * here would eventually disagree with the tiles, and a marker half an inch off the component it
 * names is worse than no marker at all.
 *
 * The layer itself is `pointer-events-none` so dragging the sheet still works between markers,
 * and each marker turns them back on for itself. Pointer events are stopped at the marker
 * rather than allowed to bubble, so pressing one never starts a pan — the container captures
 * the pointer when a drag begins, and a captured pointer swallows the click that follows.
 */

import type { Designator } from '@/api/types'
import { cn } from '@/lib/utils'
import { pointToCss } from './paint'
import type { Viewport } from './useTileViewport'

interface Props {
  /** Components with a location. Anything without one is citable but has nowhere to sit. */
  markers: Designator[]
  viewport: Viewport
  dpr: number
  /** The component the selection is *on*, if the selection is a component. */
  selectedId: string | null
  /** Components the selection runs through — a net's members, a wire's two ends. Ringed more
   * quietly than the selection itself, because they are context rather than the answer. */
  relatedIds: Set<string>
  /** Ids read well at high zoom and become a grey fog at fit zoom, where the dots alone are
   * already enough to say "there are things here". */
  showLabels: boolean
  onSelect: (entry: Designator) => void
}

export function MarkerLayer({
  markers,
  viewport,
  dpr,
  selectedId,
  relatedIds,
  showLabels,
  onSelect,
}: Props) {
  if (!(viewport.scale > 0)) return null

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="marker-layer">
      {markers.map((entry) => {
        const { left, top } = pointToCss(entry.point!, viewport, dpr)
        const selected = entry.id === selectedId
        const related = !selected && relatedIds.has(entry.id)

        return (
          <button
            key={entry.id}
            type="button"
            aria-label={`${entry.id} — ${entry.label}`}
            aria-pressed={selected}
            title={`${entry.id} — ${entry.label}`}
            style={{ left, top }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={() => onSelect(entry)}
            className={cn(
              'pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center',
              'gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              'focus-visible:outline-none',
            )}
          >
            <span
              className={cn(
                'block rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
                'transition-[width,height] duration-150',
                selected
                  ? 'size-4 bg-[var(--color-danger)] ring-3 ring-[var(--color-danger)]/35'
                  : related
                    ? 'size-3.5 bg-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/35'
                    : 'size-2.5 bg-[var(--color-primary)]/85',
              )}
            />
            {(showLabels || selected || related) && (
              <span
                className={cn(
                  'rounded px-1 py-px font-mono text-[10px] leading-tight whitespace-nowrap',
                  // Its own background, because it sits over black line art on white paper and
                  // has to be legible against both.
                  'bg-white/85 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]',
                  selected && 'bg-[var(--color-danger)] text-white',
                )}
              >
                {entry.id}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
