/**
 * Which runs of ink might be this wire — ranked, explained, and **never accepted automatically.**
 *
 * ### What this is for
 *
 * A wire's route may not be computed. It is lifted from the PDF's own conductor strokes or traced
 * by a person along the printed run, and a chord between its two pins is the one thing it may never
 * be: `W068`'s straight line is 312 pt diagonally across the middle of the sheet while its ink is
 * 644 pt going out to x = 798 and back, in two pieces with a 3.5 pt crossover hop between them. So
 * the machine's whole job here is to *propose*, and this file is the proposing.
 *
 * ### Why it never accepts, even when there is exactly one answer
 *
 * 19 of the 71 wires come back with a single candidate and still want a click. That is not caution
 * for its own sake — it is the same finding the whole project rests on. A better guesser was built
 * for the component positions and rejected, because at that accuracy a proposal has to be audited,
 * auditing costs about what deciding costs, and it costs **more** when the proposal is confidently
 * wrong, because first you have to notice. One conductor on a 16 pt pitch is exactly that case: a
 * single candidate one row out is a different circuit, and it looks right.
 *
 * ### The four signals, and what each one assumes
 *
 * Ranked with the weakest assumption first, which is the order the plan asks for:
 *
 * 1. **Both of the wire's ends land on it.** The strongest thing there is, and it is barely an
 *    assumption at all: every pairing measured on this sheet is within 4 pt at both ends, against
 *    conductor rows 16 pt apart. It is *geometry against geometry* — a human-placed pin against a
 *    vector stroke — with no reading of the paper in between.
 * 2. **The net name printed beside it is this wire's net.** A statement the sheet makes, and one
 *    that had to be corrected 34 times before it could be trusted: that is what Phase F was for.
 *    Still weaker than the geometry, because a name is read and a coordinate is not — and because
 *    **the second half of a real path routinely carries no printed name at all** (`C0092`, `C0057`),
 *    so ranking on the name alone finds one end of a wire and not the other.
 * 3. **The colour and gauge printed beside it are this wire's.** `BLUE 18AWG` against `BLUE 18AWG`.
 *    Weaker again: 67 runs carry a spec and plenty of wires share one.
 * 4. **The run is long enough to be wiring.** Only ever used to *demote*: 46 of the 149 runs are
 *    under 15 pt, and they are the slanted bars of contact symbols that `trace_conductors`
 *    collected because they are short strokes like any other (`C0107`). Never used to promote — half
 *    a path is legitimately short, and `C0092` is 73 pt of a 275 pt route.
 *
 * ### Pure, and handed the payload
 *
 * No store, no React, no fetch: the ranking is the part that can be quietly wrong, and a wrong
 * ranking on a sheet like this is a highlight on the conductor one row above the one you meant.
 * `paths.test.ts` asserts it as arithmetic, against the four pairings measured off the real drawing
 * in `07_drawing_facts.md`.
 */

import type { Conductor, Designator, LocationsDocument, PathIndex, Polyline } from '@/api/types'
import { storedLabel } from './model'

/**
 * How close an end of the ink has to be to a placed pin to count as landing on it, in points.
 *
 * **8 pt is half a conductor row.** The rows on this sheet are 16 pt apart and being one row out
 * names a different circuit, so the tolerance has to stay inside half a row or it stops
 * discriminating. It is also twice the worst pairing anybody has measured here — all four of net
 * 120's wires sit within 4 pt at both ends — so the slack is real without being generous.
 */
export const NEAR_PT = 8

/**
 * How far a run with no printed name may sit from a wire and still be worth offering, in points.
 *
 * The escape hatch for the 19 wires with no labelled candidate: *"choose from the unlabelled
 * conductors, ranked by proximity"*. One and a half rows — close enough that a person can see
 * both at once, far enough to catch a pin placed a little off the ink it belongs to.
 */
export const NEARBY_PT = 24

/**
 * Below this, in points, a run is almost certainly not wiring.
 *
 * 46 of this sheet's 149 runs are shorter than this, and they are symbol strokes: `C0107` is a
 * 10.8 pt **diagonal** on an orthogonal drawing — the slanted bar of a normally-closed contact.
 * They are demoted rather than dropped, because *this is not wiring* is a judgement and the person
 * looking at the sheet is better at it than this arithmetic.
 */
export const MIN_RUN_PT = 15

/** Why a candidate is where it is in the list, in the words the panel shows. */
export type Reason =
  /** Both of the wire's placed pins are on this run's two ends. */
  | 'both ends'
  /** One of them is. Half a path, which is the normal shape of a route across a crossover hop. */
  | 'one end'
  /** The net name printed beside it is this wire's net. */
  | 'printed name'
  /** …and it is the name a **person** supplied or corrected, rather than the extraction's. */
  | 'corrected name'
  /** Its colour and gauge, as printed, are this wire's. */
  | 'spec'
  /** Its colour matches and its gauge does not. */
  | 'colour only'
  /** No name printed on it, and it sits within `NEARBY_PT` of the wire. */
  | 'nearby'
  /** A different net's name is printed beside it. Kept, and ranked last — see `candidates`. */
  | 'another net'
  /** Shorter than `MIN_RUN_PT`, or a closed loop. Almost certainly not wiring. */
  | 'suspect'

/** One proposal: a run of ink, why it is being offered, and how well it fits. */
export interface Candidate {
  conductor: Conductor
  /** Best first, and the first one is the headline the row leads with. */
  reasons: Reason[]
  /**
   * The worst of the distances from this run's ends to the wire's pins it was matched against, in
   * points — so a smaller number is a better fit. `null` where neither end lands on a pin at all,
   * which is what separates *this is the run* from *this is ink near the run*.
   */
  fit: number | null
  /** How many of the wire's two placed pins this run's ends land on: 2, 1 or 0. */
  ends: 0 | 1 | 2
}

/** What a wire's two ends are, as far as the editor can see: the placed points, in `[from, to]`
 * order, with `null` for a pin nobody has placed. All 131 are placed on this drawing. */
export type WireEnds = [[number, number] | null, [number, number] | null]

export function endsOf(entry: Designator): WireEnds {
  const members = entry.terminals ?? []
  return [members[0]?.point ?? null, members[1]?.point ?? null]
}

/**
 * The names this wire's net answers to — **both of them**, where the sheet and the netlist
 * disagree.
 *
 * This is `K10`, and it is worth exactly two nets. `NET-PB1` is printed `PB1`; the prefix was
 * added during extraction because the sheet also has a push button called `PB1`, and the rename
 * was right. After the whole review queue was worked those two were the **only** nets of 26 with
 * no printed conductor to match against — while `C0054` reads `PB1` and another run reads `PB2`.
 * Comparing against both forms takes the matcher from 24 of 26 to 26 of 26.
 *
 * Case-folded, because a printed name is OCR of stroked glyphs and its case is the least reliable
 * thing about it.
 */
export function netNames(net: string | null, printed?: string | null): string[] {
  return [net, printed]
    .filter((name): name is string => Boolean(name && name.trim()))
    .map((name) => name.trim().toUpperCase())
}

/** Which net a wire is on, from the path index's own membership map. It is the one thing about a
 * wire the designator index does not publish, and `/api/paths` has it because a net's highlight
 * needs it — so there is one answer rather than two. */
export function netOf(paths: PathIndex | null, wireId: string): string | null {
  if (!paths) return null
  for (const [net, wires] of Object.entries(paths.nets)) {
    if (wires.includes(wireId)) return net
  }
  return null
}

/**
 * The ranked proposals for one wire. **Never a decision** — see the file header.
 *
 * `net` is the wire's net id and `printedNet` the name the sheet prints for it where that differs
 * (`K10`). Both are compared against, case-folded.
 *
 * ### What is offered, and what is not
 *
 * A run is offered when it has a reason to be: one of the wire's pins lands on it, its printed name
 * is this wire's net, or — for the wires with no labelled candidate at all — it carries no name and
 * sits within `NEARBY_PT`. Everything else is left out, because a list of 149 runs is not a
 * proposal.
 *
 * **A run carrying another net's name is kept if the geometry fits, and ranked last.** Dropping it
 * would hide the most interesting case on the sheet: a run whose two ends are exactly on this
 * wire's two pins while the name beside it says another net is either a misread nobody caught or a
 * wire on the wrong row, and both are worth a person's eyes. It cannot be *accepted* by accident,
 * because nothing here accepts anything.
 *
 * ### The order
 *
 * By the four signals in the file header, in that order, and then by `id` so the list is stable —
 * a proposal list that reshuffled between renders would be one nobody could compare against the
 * sheet.
 */
export function candidates(
  entry: Designator,
  conductors: readonly Conductor[],
  options: { net?: string | null; printedNet?: string | null } = {},
): Candidate[] {
  const ends = endsOf(entry)
  const names = netNames(options.net ?? null, options.printedNet ?? null)
  const spec = entry.spec?.trim().toUpperCase() ?? null
  const colour = spec ? spec.split(/\s+/)[0] : null

  const out: Candidate[] = []
  for (const conductor of conductors) {
    const match = matchEnds(conductor, ends)
    const printedName = conductor.net_label?.trim().toUpperCase() ?? null
    const named = printedName !== null && names.includes(printedName)
    const otherNet = printedName !== null && !named

    // The cutoff. Anything with no reason at all is not a proposal.
    const near = nearest(conductor, ends)
    const offered =
      match.ends > 0 || named || (printedName === null && near !== null && near <= NEARBY_PT)
    if (!offered) continue
    // A run labelled with another net earns its place on geometry alone: without a pin on it, the
    // sheet has already said whose it is.
    if (otherNet && match.ends === 0) continue
    /**
     * And a symbol stroke that merely sits *near* the wire has no reason at all to be offered.
     *
     * `nearby` exists as the escape hatch for a wire with no labelled candidate — *choose from the
     * unlabelled conductors, ranked by proximity* — and a 10.8 pt diagonal is not one of them. One
     * that lands **on a pin** is kept, because then it is at least in the right place and *why does
     * the ink stop here* is a question worth being able to look at. Measured: this drops 42
     * proposals across the 71 wires and no real one.
     */
    if (suspect(conductor) && match.ends === 0) continue

    const reasons: Reason[] = []
    if (match.ends === 2) reasons.push('both ends')
    else if (match.ends === 1) reasons.push('one end')
    if (named) reasons.push(conductor.was ? 'corrected name' : 'printed name')
    if (spec && conductor.spec_label?.trim().toUpperCase() === spec) reasons.push('spec')
    else if (colour && conductor.color?.trim().toUpperCase() === colour) reasons.push('colour only')
    if (!named && printedName === null && match.ends === 0) reasons.push('nearby')
    if (otherNet) reasons.push('another net')
    if (suspect(conductor)) reasons.push('suspect')

    out.push({ conductor, reasons, fit: match.fit, ends: match.ends })
  }

  return out.sort(compare)
}

/** The list, sorted. Exported so a test can say *this order and no other* without re-deriving it. */
export function compare(a: Candidate, b: Candidate): number {
  return (
    rank(a) - rank(b) ||
    (a.fit ?? Infinity) - (b.fit ?? Infinity) ||
    nearBy(a) - nearBy(b) ||
    (a.conductor.id < b.conductor.id ? -1 : a.conductor.id > b.conductor.id ? 1 : 0)
  )
}

/**
 * One number for the tier a candidate is in, low is better.
 *
 * The digits are the four signals in order — ends, name, spec, plausibility — so the whole ordering
 * is one comparison and the reasoning is readable rather than distributed over a comparator.
 */
function rank(candidate: Candidate): number {
  const { reasons } = candidate
  const suspect = reasons.includes('suspect') ? 1 : 0
  const ends = 2 - candidate.ends
  const name = reasons.includes('another net')
    ? 2
    : reasons.includes('printed name') || reasons.includes('corrected name')
      ? 0
      : 1
  const spec = reasons.includes('spec') ? 0 : reasons.includes('colour only') ? 1 : 2
  // Suspect outranks everything: a 10.8 pt diagonal that happens to touch a pin is still not a
  // wire, and offering it above real ink is how a wrong line gets accepted.
  return suspect * 1000 + ends * 100 + name * 10 + spec
}

/** A tie-break within a tier for the runs nobody's pin landed on, so *closer* wins. */
function nearBy(candidate: Candidate): number {
  return candidate.fit === null ? Infinity : 0
}

/**
 * How many of the wire's ends land on this run's ends, and how badly.
 *
 * Both pairings are tried and the better one wins, because the ink has no direction: `C0080` runs
 * east to west and `W053` is recorded `[TB-120:3, BYPASS-CB:1]`, which is west to east. A matcher
 * that assumed the orders agreed would have missed half the sheet.
 *
 * A run's ends come from `ends[].point` — where the *extraction* said the run stops — and fall back
 * to the polyline's first and last vertex, which is the same pair on all 149 runs here but is an
 * assumption about one drawing rather than a fact about the format.
 */
function matchEnds(
  conductor: Conductor,
  wire: WireEnds,
): { ends: 0 | 1 | 2; fit: number | null } {
  const ink = inkEnds(conductor)
  const [from, to] = wire
  if (!ink.length) return { ends: 0, fit: null }

  const straight = pair(from, ink[0])
  const crossed = pair(from, ink[ink.length - 1])
  const straightTo = pair(to, ink[ink.length - 1])
  const crossedTo = pair(to, ink[0])

  const orders: [number | null, number | null][] = [
    [straight, straightTo],
    [crossed, crossedTo],
  ]
  let best: { ends: 0 | 1 | 2; fit: number | null } = { ends: 0, fit: null }
  for (const [a, b] of orders) {
    const hits = [a, b].filter((d): d is number => d !== null && d <= NEAR_PT)
    const ends = hits.length as 0 | 1 | 2
    const fit = hits.length ? Math.max(...hits) : null
    if (ends > best.ends || (ends === best.ends && fit !== null && (best.fit ?? Infinity) > fit)) {
      best = { ends, fit }
    }
  }
  return best
}

/** Where the ink stops, in order — the extraction's own endpoints, or the polyline's if it has
 * published none. */
function inkEnds(conductor: Conductor): [number, number][] {
  const bound = conductor.ends
    .map((end) => end.point)
    .filter((point): point is [number, number] => Array.isArray(point))
  if (bound.length >= 2) return bound
  const points = conductor.points
  return points.length >= 2 ? [points[0], points[points.length - 1]] : []
}

/** The closest either of the wire's placed pins comes to either end of this run, or null. */
function nearest(conductor: Conductor, wire: WireEnds): number | null {
  const distances: number[] = []
  for (const end of inkEnds(conductor)) {
    for (const pin of wire) {
      const d = pair(pin, end)
      if (d !== null) distances.push(d)
    }
  }
  return distances.length ? Math.min(...distances) : null
}

function pair(
  a: [number, number] | null | undefined,
  b: [number, number] | null | undefined,
): number | null {
  if (!a || !b) return null
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/**
 * Almost certainly not wiring: too short, or a closed loop.
 *
 * The closed loop is `C0115`, and it is the case that proves the demotion is worth having. It is a
 * 75.6 × 105.8 pt rectangle whose two endpoints are 0.4 pt apart — **the outline of the INFEED1
 * connector box** — with a `BLUE 16AWG` spec falsely bound from a label printed *inside* it.
 * Offering that as a candidate for a net-110 wire would hand a person a box outline to accept as a
 * conductor, which is the *"a wrong line is worse than no line"* failure the whole rule exists to
 * forbid.
 */
function suspect(conductor: Conductor): boolean {
  if (conductor.length !== undefined && conductor.length < MIN_RUN_PT) return true
  const ink = inkEnds(conductor)
  return ink.length >= 2 && (pair(ink[0], ink[ink.length - 1]) ?? 1) < 1
}

// -- what the sheet draws while you are choosing --------------------------------------------

/**
 * The runs to highlight for the armed row, **preferring the draft** — so accepting a candidate
 * paints it before the save has landed.
 *
 * `lib/paths.ts` `pathsFor` is the union rule and stays the union rule: this reads the same map for
 * a net's membership and only overrides what the draft has an opinion about. Two copies of *what is
 * net 120 made of* is exactly the drift that file exists to prevent.
 */
export function draftRuns(
  document: LocationsDocument,
  paths: PathIndex | null,
  entry: Designator | null,
): Polyline[] {
  if (!entry) return []
  const wires =
    entry.kind === 'wire' ? [entry.id] : entry.kind === 'net' ? (paths?.nets[entry.id] ?? []) : []
  const runs: Polyline[] = []
  for (const wire of wires) {
    const drafted = storedLabel(document, wire)?.path?.runs
    const saved = paths?.wires[wire]?.runs
    for (const run of drafted ?? saved ?? []) runs.push(run)
  }
  return runs
}

/** The runs of one candidate — what accepting it would write, and what hovering it lights up. */
export function runsOf(chosen: readonly Candidate[]): Polyline[] {
  return chosen.map((candidate) => candidate.conductor.points).filter((run) => run.length > 1)
}

/** Total length of a set of runs, along the ink, in points. What the panel shows beside an accepted
 * path so it can be compared with the straight line between the pins it is *not*. */
export function lengthOf(runs: readonly Polyline[]): number {
  let total = 0
  for (const run of runs) {
    for (let i = 1; i < run.length; i += 1) {
      total += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1])
    }
  }
  return Math.round(total * 10) / 10
}

/** The straight line between a wire's two placed pins — published **only** to be compared against
 * the ink, and never drawn. `W068`'s is 312 pt against 644 pt of conductor. */
export function chordOf(entry: Designator): number | null {
  const [from, to] = endsOf(entry)
  const d = pair(from, to)
  return d === null ? null : Math.round(d * 10) / 10
}
