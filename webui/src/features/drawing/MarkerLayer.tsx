/**
 * The things on the sheet you can click, above the sheet you can only look at.
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
 * names is worse than no marker at all. Drag reads the same number the other way, so a dot the
 * editor drops is a dot the viewer draws.
 *
 * **One dot per place, not per identifier.** `CR-BP` is drawn three times on this sheet — coil,
 * NC contact, NO contact — so a component has a *list* of places and each gets its own dot,
 * keyed `id@site`. Anything shaped like one point per component is already wrong here.
 *
 * **A dot says how much it knows.** `confirmed` is filled, because a person put it there.
 * `seed` and `parent` are hollow, because they are the indexing pass's estimate (out by about
 * 11 pt on a sheet whose conductor rows are 16 pt apart) and a terminal borrowing its parent
 * component's point. Nobody should be told we know where `CR-BP:12` is while being shown a
 * guess, and the tooltip says which it is in words.
 *
 * **The dot is the anchor, and the label hangs off it.** This used to be one flex row — dot then
 * label — centred on the point, which meant the *dot* sat half a label's width to the left of the
 * thing it marked: it moved when labels appeared at the 30% zoom threshold, and it moved further
 * for a longer id (`TB-PB2SP` about 28 CSS px, `PB2` about 12). It was wrong by a whole conductor
 * row at moderate zoom, and it produced a memorable false positive: `CR-ON`'s marker appeared to
 * be sitting exactly on terminal A1, which was really the coil-centre point displaced left by the
 * width of the word "CR-ON". Correct by accident. So the button *is* the dot, centred on the
 * point by the only two translations in this file, and the label is absolutely positioned inside
 * it, contributing nothing to its size. The label stays part of the button rather than becoming a
 * sibling because it is a useful hit target and a marker should not have two focusable halves.
 *
 * The layer itself is `pointer-events-none` so dragging the sheet still works between markers,
 * and each marker turns them back on for itself. Pointer events are stopped at the marker
 * rather than allowed to bubble, so pressing one never starts a pan — the container captures
 * the pointer when a drag begins, and a captured pointer swallows the click that follows.
 */

import { useRef } from 'react'

import type { Compass, Designator, Place, Placement } from '@/api/types'
import { placesOf } from '@/lib/designators'
import { cn } from '@/lib/utils'
import { cssToPoint, pointToCss } from './paint'
import type { Viewport } from './useTileViewport'

/**
 * Where the label sits relative to the dot, per compass point.
 *
 * The emptiest side is a property of the drawing rather than of the marker — `geometry.json`
 * knows which way is clear, a human knows better — so the side arrives per place in
 * `locations.json` and this is only the lookup. East is the default and is what an unplaced
 * label gets.
 */
const LABEL_SIDE: Record<Compass, string> = {
  e: 'top-1/2 left-full ml-1.5 -translate-y-1/2',
  w: 'top-1/2 right-full mr-1.5 -translate-y-1/2',
  n: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  s: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  ne: 'bottom-full left-full mb-1 ml-1',
  nw: 'bottom-full right-full mb-1 mr-1',
  se: 'top-full left-full mt-1 ml-1',
  sw: 'top-full right-full mt-1 mr-1',
}

/** Said in words on hover, because a hollow dot is a hint and this is the actual claim. */
const PLACEMENT_NOTE: Record<Placement, string> = {
  confirmed: 'placed by hand',
  seed: 'estimated when the drawing was indexed — not confirmed',
  parent: "the component's point, not this pin's — not confirmed",
}

/** How far a pointer must travel before a press counts as a drag rather than a click. Small
 * enough that a deliberate nudge works, large enough that a shaky click still selects. */
const DRAG_SLOP = 3

interface Props {
  /** Whatever should have dots. The Drawing tab passes the located components; the Locate
   * editor passes components and terminals both, because those are the two kinds a human
   * places. Anything without a point is citable but has nowhere to sit. */
  markers: Designator[]
  viewport: Viewport
  dpr: number
  /**
   * The current selection, drawn as its own marker at its **own** point and labelled with its
   * **own** id.
   *
   * This is the fix for the fault where selecting `CR-ON:A2` produced a dot labelled `CR-ON`
   * sitting on `CR-ON:A1`: the tab used to reduce a selection to `entry.kind === 'component' ?
   * entry.id : null` and let the parent component's marker stand in for it. A terminal is not
   * its component, and a marker that borrows one is lying about two things at once.
   */
  selected?: Designator | null
  /** Components the selection runs through — a net's members, a wire's two ends. Ringed more
   * quietly than the selection itself, because they are context rather than the answer. */
  relatedIds: Set<string>
  /** Ids read well at high zoom and become a grey fog at fit zoom, where the dots alone are
   * already enough to say "there are things here". */
  showLabels: boolean
  /**
   * A dot was clicked. **The `place` is the dot that was clicked, not the entry's first one** —
   * `CR-BP` has three, and a caller told only the id has to guess which, which is how selecting
   * the NO contact used to fly the sheet to the coil.
   */
  onSelect: (entry: Designator, place: Place) => void
  /**
   * Locate editor only. When given, every dot becomes draggable and reports where it was
   * dropped, in PDF points — which is the obvious gesture for a dot that is visibly in the
   * wrong spot, and the one the original editor design was missing. Absent on the Drawing tab,
   * where the sheet is read-only and a stray drag must pan.
   */
  onDragPoint?: (entry: Designator, place: Place, point: [number, number]) => void
  /** Called once when a drag finishes, so the editor can save the result rather than every
   * intermediate frame of it. */
  onDragEnd?: () => void
}

export function MarkerLayer({
  markers,
  viewport,
  dpr,
  selected = null,
  relatedIds,
  showLabels,
  onSelect,
  onDragPoint,
  onDragEnd,
}: Props) {
  if (!(viewport.scale > 0)) return null

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="marker-layer">
      {markers.map((entry) =>
        // The selection draws itself below, at its own point and under its own name. Drawing it
        // here as well would put two dots on one spot and let the quieter one win the click.
        entry.id === selected?.id
          ? null
          : placesOf(entry).map((place, index) => (
              <Marker
                key={`${entry.id}@${place.site ?? index}`}
                entry={entry}
                place={place}
                viewport={viewport}
                dpr={dpr}
                state={relatedIds.has(entry.id) ? 'related' : 'plain'}
                showLabel={showLabels || relatedIds.has(entry.id)}
                onSelect={onSelect}
                onDragPoint={onDragPoint}
                onDragEnd={onDragEnd}
              />
            )),
      )}

      {selected &&
        placesOf(selected).map((place, index) => (
          <Marker
            key={`selected@${place.site ?? index}`}
            entry={selected}
            place={place}
            viewport={viewport}
            dpr={dpr}
            state="selected"
            showLabel
            onSelect={onSelect}
            onDragPoint={onDragPoint}
            onDragEnd={onDragEnd}
          />
        ))}
    </div>
  )
}

interface MarkerProps {
  entry: Designator
  place: Place
  viewport: Viewport
  dpr: number
  state: 'plain' | 'related' | 'selected'
  showLabel: boolean
  onSelect: (entry: Designator, place: Place) => void
  onDragPoint?: (entry: Designator, place: Place, point: [number, number]) => void
  onDragEnd?: () => void
}

function Marker({
  entry,
  place,
  viewport,
  dpr,
  state,
  showLabel,
  onSelect,
  onDragPoint,
  onDragEnd,
}: MarkerProps) {
  const { left, top } = pointToCss(place.point, viewport, dpr)
  const selected = state === 'selected'
  const confirmed = place.placement === 'confirmed'

  /** The in-flight drag. A ref rather than state: nothing here re-renders on it, and the parent
   * is already re-rendering from the point it is being handed. */
  const drag = useRef<{ id: number; x: number; y: number; from: [number, number] } | null>(null)
  /** Set when a drag actually moved, and consumed by the click that the browser fires next.
   * Without it, dropping a dot also selects — or worse, re-selects and flies the sheet away. */
  const dragged = useRef(false)

  const site = place.site ? ` (${place.site})` : ''
  const description = `${entry.id} — ${entry.label}${site}. ${PLACEMENT_NOTE[place.placement]}`

  return (
    <button
      type="button"
      aria-label={description}
      aria-pressed={selected}
      title={description}
      style={{ left, top }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (!onDragPoint) return
        // Optional-called for the same reason the viewport does it: jsdom has no pointer
        // capture, and a drag that throws on mousedown is not a testable drag.
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: place.point }
      }}
      onPointerMove={(event) => {
        const held = drag.current
        if (!held || held.id !== event.pointerId || !onDragPoint) return
        const dx = event.clientX - held.x
        const dy = event.clientY - held.y
        if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP) return
        dragged.current = true
        // Measured from where the press started rather than from the current dot, so a slow
        // drag cannot accumulate rounding, and `cssToPoint` is used for the *scale* only —
        // there is no container rectangle in a delta.
        const moved = cssToPoint({ left: dx, top: dy }, { ...viewport, x: 0, y: 0 })
        onDragPoint(entry, place, [held.from[0] + moved[0], held.from[1] + moved[1]])
      }}
      onPointerUp={() => {
        drag.current = null
        if (dragged.current) onDragEnd?.()
      }}
      onPointerCancel={() => {
        drag.current = null
        dragged.current = false
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false
          return
        }
        onSelect(entry, place)
      }}
      className={cn(
        // No flex, no padding, no gap, nothing but the dot: the button's box is the dot's
        // box, so these two translations put the dot itself on `point`.
        'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        'focus-visible:outline-none',
        onDragPoint && 'cursor-move',
      )}
    >
      <span
        className={cn(
          'block rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
          'transition-[width,height] duration-150',
          selected
            ? 'size-4 ring-3 ring-[var(--color-danger)]/35'
            : state === 'related'
              ? 'size-3.5 ring-2 ring-[var(--color-warning)]/35'
              : 'size-2.5',
          // Filled means a person placed it. Hollow means we are showing our own estimate, and
          // the difference has to be visible without hovering — that is the whole point of
          // publishing `placement` at all.
          confirmed
            ? selected
              ? 'bg-[var(--color-danger)]'
              : state === 'related'
                ? 'bg-[var(--color-warning)]'
                : 'bg-[var(--color-primary)]/85'
            : 'bg-white',
        )}
        // An inner ring in the marker's own colour, so a hollow dot still reads as *this* dot
        // rather than as a hole in the sheet. Inline because the colour is a CSS variable and
        // the width has to shrink with the dot.
        style={
          confirmed
            ? undefined
            : {
                boxShadow: `0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 ${selected ? 3 : 2}px ${
                  selected
                    ? 'var(--color-danger)'
                    : state === 'related'
                      ? 'var(--color-warning)'
                      : 'var(--color-primary)'
                }`,
              }
        }
      />
      {showLabel && (
        <span
          className={cn(
            'absolute',
            LABEL_SIDE[place.label_dir ?? 'e'],
            'rounded px-1 py-px font-mono text-[10px] leading-tight whitespace-nowrap',
            // Its own background, because it sits over black line art on white paper and
            // has to be legible against both.
            'bg-white/85 text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]',
            selected && 'bg-[var(--color-danger)] text-white',
            !confirmed && !selected && 'italic',
          )}
        >
          {entry.id}
        </span>
      )}
    </button>
  )
}
