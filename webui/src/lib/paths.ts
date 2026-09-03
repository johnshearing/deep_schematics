/**
 * What to highlight when something is selected — the one answer, for both tabs.
 *
 * The rule is one sentence and it is the reason this file exists rather than the logic sitting in
 * whichever tab needed it first: **a wire's highlight is its own runs, and a net's is the union of
 * its wires'.** A net stores nothing (`server/app/locations.py`), so if the Drawing tab and the
 * Locate tab each worked that out for themselves they could eventually disagree about what net 120
 * is — which is exactly the class of drift `paint.ts` exists to prevent for coordinates.
 *
 * Pure, and it takes the payload rather than reading a store, so it is testable as arithmetic.
 */

import type { DesignatorKind, PathIndex, Polyline, WirePath } from '@/api/types'

/**
 * A selection's paths, gathered — and enough about them for a card to say what is on the sheet.
 *
 * `wires` and `traced` are the two numbers a reader needs when nothing is drawn: *this net has
 * four wires and none of them has a path yet* is information, and an empty sheet is not.
 */
export interface PathSummary {
  /** Everything to paint, in the order the wires are listed. */
  runs: Polyline[]
  /** How many wires this selection covers: 1 for a wire, its membership for a net. */
  wires: number
  /** How many of them somebody has traced. */
  traced: number
  /** The two provenance axes, `mixed` where a net's wires disagree and null where nothing is
   * traced. A net whose runs are half lifted and half hand-drawn is a real state and the card
   * must not claim it is one or the other. */
  geometry: WirePath['geometry'] | 'mixed' | null
  attribution: WirePath['attribution'] | 'mixed' | null
  /** The extracted runs these paths were lifted from, in order and deduplicated. Empty where
   * every path here was traced by hand. */
  conductors: string[]
}

const NOTHING: PathSummary = {
  runs: [],
  wires: 0,
  traced: 0,
  geometry: null,
  attribution: null,
  conductors: [],
}

/**
 * The paths for one selection, or **null for a kind that cannot have one**.
 *
 * Null and an empty summary are different answers and both are used: a component has no path in
 * the way a stone has no opinion, and there is nothing to say about it; a wire with no path yet is
 * a wire waiting for Session 6's editor, and the card says so.
 */
export function pathsFor(
  index: PathIndex | null,
  kind: DesignatorKind | null | undefined,
  id: string | null | undefined,
): PathSummary | null {
  if (!id || (kind !== 'wire' && kind !== 'net')) return null
  if (!index) return { ...NOTHING, wires: kind === 'wire' ? 1 : 0 }

  const wires = kind === 'wire' ? [id] : (index.nets[id] ?? [])
  const runs: Polyline[] = []
  const conductors: string[] = []
  const geometry = new Set<WirePath['geometry']>()
  const attribution = new Set<WirePath['attribution']>()
  let traced = 0

  for (const wire of wires) {
    const path = index.wires[wire]
    if (!path) continue
    traced += 1
    runs.push(...path.runs)
    geometry.add(path.geometry)
    attribution.add(path.attribution)
    for (const conductor of path.conductors ?? []) {
      if (!conductors.includes(conductor)) conductors.push(conductor)
    }
  }

  return { runs, wires: wires.length, traced, ...axes(geometry, attribution), conductors }
}

function axes(
  geometry: Set<WirePath['geometry']>,
  attribution: Set<WirePath['attribution']>,
): Pick<PathSummary, 'geometry' | 'attribution'> {
  return {
    geometry: one(geometry),
    attribution: one(attribution),
  }
}

function one<T>(values: Set<T>): T | 'mixed' | null {
  if (values.size === 0) return null
  if (values.size === 1) return [...values][0]
  return 'mixed'
}
