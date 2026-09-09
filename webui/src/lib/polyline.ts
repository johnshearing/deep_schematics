/**
 * Arithmetic on a run of ink, in **PDF points** — one answer, for everything that measures one.
 *
 * Not a projection onto the screen: that is `features/drawing/paint.ts`, and invariant 2 says
 * there is exactly one of those. This is the other kind of measurement — *how far is this pin from
 * that conductor, and how far along it* — and it had exactly one caller until Phase D. It now has
 * three: the ink's endpoint proposal (`features/locate/wiring.ts`), the bus a block's commoning is
 * cut out of, and the sheet hit-test that answers *what line am I pointing at*.
 *
 * Those three must not be allowed to disagree. A hit-test that used its own distance function
 * could name a conductor the landing rule says a pin is not on, and the two answers would both be
 * defensible and one of them wrong — which on a sheet whose conductor rows are **16 pt apart** is
 * how a reader ends up looking at a different circuit.
 */

/** A polyline in PDF points, as `/api/conductors` publishes one. */
export type Points = readonly (readonly [number, number])[]

/** Where a point falls against a polyline: perpendicular distance, and arc length along it. */
export interface Projection {
  /** Perpendicular distance in points. `ON_INK_PT` is 4 — a quarter of a conductor row. */
  off: number
  /** How far along the polyline the foot of that perpendicular sits. */
  along: number
}

/** Perpendicular distance to the polyline, and how far along the projection falls. */
export function project(point: readonly [number, number], polyline: Points): Projection {
  let best: Projection = { off: Infinity, along: 0 }
  let arc = 0
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]
    const b = polyline[i + 1]
    const span = gap(a, b)
    let t = 0
    let off: number
    if (span === 0) {
      off = gap(point, a)
    } else {
      t = ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / (span * span)
      t = Math.max(0, Math.min(1, t))
      off = gap(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
    if (off < best.off) best = { off, along: arc + t * span }
    arc += span
  }
  return best
}

/** The coordinate at an arc position, clamped to the ends. */
export function atArc(polyline: Points, along: number): [number, number] {
  let arc = 0
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]
    const b = polyline[i + 1]
    const span = gap(a, b)
    if (arc + span >= along - 1e-9) {
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, (along - arc) / span))
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    }
    arc += span
  }
  const last = polyline[polyline.length - 1]
  return [last[0], last[1]]
}

/**
 * The piece of a polyline between two arc positions, **corners and all.**
 *
 * The two cut points plus every vertex strictly between them, so a stretch that turns a corner
 * keeps its corner. A straight line between the ends of a bent stretch would be a polyline nobody
 * drew, which is invariant 1 in the place it is easiest to break by accident: this is how a
 * block's commoning is cut out of a conductor it shares with a wire.
 */
export function between(polyline: Points, lo: number, hi: number): [number, number][] {
  const out: [number, number][] = [atArc(polyline, lo)]
  let arc = 0
  for (let i = 0; i < polyline.length - 1; i += 1) {
    arc += gap(polyline[i], polyline[i + 1])
    if (arc > lo && arc < hi) out.push([polyline[i + 1][0], polyline[i + 1][1]])
  }
  out.push(atArc(polyline, hi))
  return out
}

export function polylineLength(polyline: Points): number {
  let total = 0
  for (let i = 1; i < polyline.length; i += 1) total += gap(polyline[i - 1], polyline[i])
  return total
}

export function gap(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}
